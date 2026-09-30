import { extract, restore, type ProtectionConfig } from './protector';
import { isValid, normalizeTokens } from './validator';

export interface TranslateOpts {
  /** Reintento: el traductor debe evitar enviar los marcadores (o ser más estricto). */
  isolated?: boolean;
}

/** Traduce N textos → N textos, mismo orden. Lo implementa el content script. */
export type TranslateFn = (texts: string[], opts?: TranslateOpts) => Promise<string[]>;

/** Caché de traducciones YA validadas, indexada por los textos fuente. */
export interface BlockCache {
  load(sourceTexts: string[]): Promise<string[] | null>;
  save(sourceTexts: string[], outs: string[]): Promise<void>;
}

export interface PipelineResult {
  translated: number;
  skipped: Element[];
  fromCache: boolean;
}

/**
 * extract → (caché) → translate → validar → (reintento aislado) → restore.
 * Un bloque inválido tras el reintento se queda en su idioma original, marcado.
 * Si `translate` lanza en la primera pasada, no se ha tocado ningún bloque.
 */
export async function translateBlocks(
  blocks: Element[],
  cfg: ProtectionConfig,
  translate: TranslateFn,
  cache?: BlockCache,
): Promise<PipelineResult> {
  const extractions = blocks.map((b) => extract(b, cfg));
  const sources = extractions.map((e) => e.text);

  let outs: (string | null)[] | null = null;
  let fromCache = false;

  // La caché nunca se da por buena sin revalidar.
  const cached = await cache?.load(sources);
  if (cached && cached.length === blocks.length && cached.every((o, i) => isValid(sources[i], o))) {
    outs = cached;
    fromCache = true;
  }

  if (!outs) {
    const raw = await translate(sources);
    if (raw.length !== blocks.length) throw new Error('La traducción no devolvió el número de bloques esperado.');

    outs = raw.map((o, i) => {
      const fixed = normalizeTokens(o);
      return isValid(sources[i], fixed) ? fixed : null;
    });

    // Un reintento aislado por cada bloque inválido.
    for (let i = 0; i < outs.length; i++) {
      if (outs[i] !== null) continue;
      try {
        const [again] = await translate([sources[i]], { isolated: true });
        const fixed = normalizeTokens(again ?? '');
        if (isValid(sources[i], fixed)) outs[i] = fixed;
      } catch {
        /* se queda sin traducir */
      }
    }

    // Solo se cachea si TODO quedó bien: nunca se congela un fallo.
    if (outs.every((o) => o !== null)) await cache?.save(sources, outs as string[]);
  }

  const skipped: Element[] = [];
  let translated = 0;
  blocks.forEach((block, i) => {
    const out = outs![i];
    if (out === null) {
      block.classList.add('cpt-skipped');
      block.setAttribute('title', 'No se pudo traducir con seguridad');
      skipped.push(block);
      return;
    }
    // El fragmento se construye ANTES de vaciar el bloque (restore mueve nodos).
    block.replaceChildren(restore(out, extractions[i].slots));
    translated++;
  });

  return { translated, skipped, fromCache };
}
