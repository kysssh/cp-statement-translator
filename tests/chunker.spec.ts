import { describe, expect, it } from 'vitest';
import { chunkBlocks, flatten } from '../src/core/chunker';
import { estimateTokens } from '../src/core/estimate-tokens';

const mk = (n: number, len = 40) => ({ text: 'a'.repeat(len), id: n });

describe('chunkBlocks', () => {
  it('lista vacía devuelve lista vacía', () => {
    expect(chunkBlocks([], 100)).toEqual([]);
  });

  it('un solo bloque cabe en un lote', () => {
    const c = chunkBlocks([mk(0)], 100);
    expect(c).toHaveLength(1);
    expect(c[0].indices).toEqual([0]);
  });

  it('un bloque más grande que el presupuesto va solo en su lote', () => {
    const enorme = { text: 'x'.repeat(4000), id: 'enorme' };
    const c = chunkBlocks([mk(0), enorme, mk(2)], 100);
    expect(c).toHaveLength(3);
    expect(c[1].blocks).toEqual([enorme]);
    expect(c[1].indices).toEqual([1]);
    // los vecinos no se mezclan con el enorme
    expect(c[0].indices).toEqual([0]);
    expect(c[2].indices).toEqual([2]);
  });

  it('nunca supera el presupuesto (salvo bloques imposibles)', () => {
    const bloques = Array.from({ length: 50 }, (_, i) => mk(i, 200));
    const c = chunkBlocks(bloques, 200);
    for (const lote of c) {
      const total = lote.blocks.reduce((a, b) => a + estimateTokens(b.text), 0);
      expect(total).toBeLessThanOrEqual(200);
    }
  });

  it('conserva el orden: los índices van en orden creciente y contiguos', () => {
    const bloques = Array.from({ length: 20 }, (_, i) => mk(i, 60));
    const c = chunkBlocks(bloques, 100);
    const todos = c.flatMap((l) => l.indices);
    expect(todos).toEqual([...todos].sort((a, b) => a - b));
    expect(todos).toEqual(bloques.map((_, i) => i));
  });

  it('la suma de los lotes reconstruye la lista original', () => {
    const bloques = Array.from({ length: 30 }, (_, i) => mk(i, 100));
    const c = chunkBlocks(bloques, 250);
    expect(flatten(c)).toEqual(bloques);
  });

  it('bloques justo en el límite no dividen lotes por lo justo', () => {
    // 10 tokens exactos cada uno, presupuesto 20 -> caben 2 exactos por lote
    const bloques = [{ text: 'a'.repeat(40) }, { text: 'b'.repeat(40) }, { text: 'c'.repeat(40) }];
    const c = chunkBlocks(bloques, 20);
    expect(c[0].blocks).toHaveLength(2);
    expect(c[1].blocks).toHaveLength(1);
  });

  it('el prompt del sistema cuenta contra el presupuesto', () => {
    const bloques = Array.from({ length: 10 }, () => ({ text: 'a'.repeat(40) })); // 10 tokens cada uno
    const sinPrompt = chunkBlocks(bloques, 50);
    const conPrompt = chunkBlocks(bloques, 50, 30);
    expect(sinPrompt[0].blocks).toHaveLength(5);
    expect(conPrompt[0].blocks).toHaveLength(2);
    expect(conPrompt[0].estimatedTokens).toBe(50);
  });

  it('reported estimatedTokens coincide con la suma real del lote', () => {
    const bloques = [{ text: 'hola mundo' }, { text: 'otra frase' }];
    const c = chunkBlocks(bloques, 1000, 5);
    const esperado = 5 + bloques.reduce((a, b) => a + estimateTokens(b.text), 0);
    expect(c[0].estimatedTokens).toBe(esperado);
  });

  it('no muta la entrada', () => {
    const bloques = [mk(0), mk(1)];
    const copia = JSON.stringify(bloques);
    chunkBlocks(bloques, 10);
    expect(JSON.stringify(bloques)).toBe(copia);
  });
});
