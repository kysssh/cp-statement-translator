import { extract, restore, type ProtectionConfig } from './protector';
import { isValid, normalizeTokens } from './validator';
import { translateSegmentsBatch } from './segments';

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
  options: { signal?: AbortSignal; isCurrent?: () => boolean; retryWithoutMarkers?: boolean } = {},
): Promise<PipelineResult> {
  const assertCurrent = () => {
    if (options.signal?.aborted || (options.isCurrent && !options.isCurrent())) {
      throw new DOMException('La traducción ya no pertenece al problema visible.', 'AbortError');
    }
  };
  assertCurrent();
  const accepts = (source: string, out: string) => isValid(source, out) &&
    !(options.retryWithoutMarkers && /\p{L}/u.test(source) && source.trim() === out.trim());
  const extractions = blocks.map((b) => extract(b, cfg));
  const sources = extractions.map((e) => e.text);

  let outs: (string | null)[] | null = null;
  let fromCache = false;

  // La caché nunca se da por buena sin revalidar.
  const cached = await cache?.load(sources);
  assertCurrent();
  if (cached && cached.length === blocks.length && cached.every((o, i) => accepts(sources[i], o))) {
    outs = cached;
    fromCache = true;
  }

  if (!outs) {
    const raw = await translate(sources);
    assertCurrent();
    if (raw.length !== blocks.length) throw new Error('La traducción no devolvió el número de bloques esperado.');

    outs = raw.map((o, i) => {
      const fixed = normalizeTokens(o);
      return accepts(sources[i], fixed) ? fixed : null;
    });

    // Un reintento aislado por cada bloque inválido.
    for (let i = 0; i < outs.length; i++) {
      assertCurrent();
      if (outs[i] !== null) continue;
      try {
        const [again] = await translate([sources[i]], { isolated: true });
        assertCurrent();
        const fixed = normalizeTokens(again ?? '');
        if (accepts(sources[i], fixed)) outs[i] = fixed;
      } catch {
        assertCurrent(); // Cancelación no debe convertirse en un bloque omitido.
        /* se queda sin traducir */
      }
    }

    // VJudge: último respaldo sin exponer marcadores al proveedor.
    if (options.retryWithoutMarkers) {
      for (let i = 0; i < outs.length; i++) {
        assertCurrent();
        if (outs[i] !== null) continue;
        try {
          const segmented = await translateSegmentsBatch(sources[i], async texts => {
            assertCurrent();
            const response = await translate(texts, { isolated: true });
            assertCurrent();
            return response;
          });
          if (accepts(sources[i], segmented)) outs[i] = segmented;
        } catch {
          assertCurrent();
          // Un fallo sigue dejando el bloque original intacto.
        }
      }
    }

    // Solo se cachea si TODO quedó bien: nunca se congela un fallo.
    assertCurrent();
    if (outs.every((o) => o !== null)) await cache?.save(sources, outs as string[]);
  }

  assertCurrent();
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
