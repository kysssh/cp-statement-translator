import { extract, restore, type ProtectionConfig } from './protector';
import { isValid, normalizeTokens } from './validator';

/** Traduce N textos → N textos, mismo orden. Lo implementa el content script. */
export type TranslateFn = (texts: string[]) => Promise<string[]>;

export interface PipelineResult {
  translated: number;
  skipped: Element[];
}

/**
 * extract → translate → validar → (reintento aislado) → restore.
 * Un bloque inválido tras el reintento se queda en su idioma original, marcado.
 * Si `translate` lanza, no se ha tocado ningún bloque y el error sube al llamador.
 */
export async function translateBlocks(
  blocks: Element[],
  cfg: ProtectionConfig,
  translate: TranslateFn,
): Promise<PipelineResult> {
  const extractions = blocks.map((b) => extract(b, cfg));
  const raw = await translate(extractions.map((e) => e.text));
  if (raw.length !== blocks.length) throw new Error('La traducción no devolvió el número de bloques esperado.');

  const outs: (string | null)[] = raw.map((o, i) => {
    const fixed = normalizeTokens(o);
    return isValid(extractions[i].text, fixed) ? fixed : null;
  });

  // Un reintento aislado por cada bloque inválido.
  for (let i = 0; i < outs.length; i++) {
    if (outs[i] !== null) continue;
    try {
      const [again] = await translate([extractions[i].text]);
      const fixed = normalizeTokens(again ?? '');
      if (isValid(extractions[i].text, fixed)) outs[i] = fixed;
    } catch {
      /* se queda sin traducir */
    }
  }

  const skipped: Element[] = [];
  let translated = 0;
  blocks.forEach((block, i) => {
    const out = outs[i];
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

  return { translated, skipped };
}
