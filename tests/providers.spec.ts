import { describe, expect, it } from 'vitest';
import { chunkBlocks, parseBlocks } from '../src/shared/llm';
import { translateBySegments } from '../src/core/segments';

describe('chunkBlocks', () => {
  it('respeta el máximo y no parte bloques', () => {
    const chunks = chunkBlocks(['a'.repeat(4000), 'b'.repeat(4000), 'c'], 6000);
    expect(chunks).toEqual([['a'.repeat(4000)], ['b'.repeat(4000), 'c']]);
  });
});

describe('parseBlocks', () => {
  it('acepta objeto, array y backticks', () => {
    expect(parseBlocks('{"blocks":["x","y"]}', 2)).toEqual(['x', 'y']);
    expect(parseBlocks('```json\n["x"]\n```', 1)).toEqual(['x']);
  });
  it('rechaza cantidad distinta o basura', () => {
    expect(() => parseBlocks('{"blocks":["x"]}', 2)).toThrow();
    expect(() => parseBlocks('hola', 1)).toThrow();
  });
});

describe('translateBySegments', () => {
  it('no envía marcadores al traductor y conserva espacios', async () => {
    const sent: string[] = [];
    const out = await translateBySegments('Given ⟦0⟧ integers ⟦1⟧x⟦/1⟧ 5', async (s) => {
      sent.push(s);
      return s.toUpperCase();
    });
    expect(sent).toEqual(['Given', 'integers', 'x']);
    expect(out).toBe('GIVEN ⟦0⟧ INTEGERS ⟦1⟧X⟦/1⟧ 5');
  });
});
