import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chunkBlocks, flatten } from '../src/core/chunker';
import { estimateTokens } from '../src/core/estimate-tokens';
import { collectBlocks } from '../src/core/segmenter';

/**
 * Verificación de T35 con un fixture real: los lotes nunca pasan el presupuesto
 * y la suma reconstruye el documento en el mismo orden.
 */
describe('chunkBlocks sobre un módulo real de USACO', () => {
  const html = readFileSync('tests/fixtures/usaco-tablas.html', 'utf8');

  it('el documento se reagrupa sin perder ni reordenar bloques', () => {
    document.body.innerHTML = html;
    const root = document.querySelector('.markdown') as HTMLElement;
    const bloques = collectBlocks(
      root,
      '.markdown p, .markdown li, .markdown h2, .markdown h3',
      { opaqueSelector: 'pre, code, .language-math, img, svg, table', inlineSelector: 'strong, em, a' },
    );
    expect(bloques.length).toBeGreaterThan(20);

    const original = bloques.map((b) => b.textContent);
    const lotes = chunkBlocks(bloques.map((b) => ({ text: b.textContent ?? '' })), 1500, 500);

    expect(flatten(lotes).map((b) => b.text)).toEqual(original);
    expect(lotes.length).toBeGreaterThan(1);
  });

  it('ningún lote se pasa del presupuesto', () => {
    document.body.innerHTML = html;
    const root = document.querySelector('.markdown') as HTMLElement;
    const bloques = collectBlocks(root, '.markdown p, .markdown li, .markdown h2, .markdown h3', {
      opaqueSelector: 'pre, code, .language-math, img, svg, table',
      inlineSelector: 'strong, em, a',
    });
    const lotes = chunkBlocks(bloques.map((b) => ({ text: b.textContent ?? '' })), 1500, 500);

    for (const lote of lotes) {
      const calculado = 500 + lote.blocks.reduce((a, b) => a + estimateTokens(b.text), 0);
      // puede exceder si hubo un bloque enorme, pero solo en un lote aislado
      if (lote.blocks.length > 1) expect(calculado).toBeLessThanOrEqual(1500);
    }
  });

  it('con presupuesto 3000 un módulo real cabe en un solo lote', () => {
    document.body.innerHTML = html;
    const root = document.querySelector('.markdown') as HTMLElement;
    const bloques = collectBlocks(root, '.markdown p, .markdown li, .markdown h2, .markdown h3', {
      opaqueSelector: 'pre, code, .language-math, img, svg, table',
      inlineSelector: 'strong, em, a',
    });
    // Medido (T35): usaco-tablas son 47 bloques / ~1250 tokens de entrada,
    // así que con 3000 de presupuesto entra en un único lote.
    const lotes = chunkBlocks(bloques.map((b) => ({ text: b.textContent ?? '' })), 3000, 500);
    expect(lotes).toHaveLength(1);
    expect(lotes[0].indices).toHaveLength(bloques.length);
  });
});
