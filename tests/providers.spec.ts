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

import { fromDeeplXml, toDeeplXml } from '../src/shared/deepl-xml';

describe('DeepL XML', () => {
  const src = 'If ⟦0⟧ < 5 & ⟦2⟧the ⟦1⟧ value⟦/2⟧ is odd.';
  it('opaco → <x/>, formato → <g>, y escapa XML', () => {
    expect(toDeeplXml(src)).toBe('If <x id="0"/> &lt; 5 &amp; <g id="2">the <x id="1"/> value</g> is odd.');
  });
  it('ida y vuelta exacta', () => {
    expect(fromDeeplXml(toDeeplXml(src))).toBe(src);
  });
  it('tolera <x id="n"></x> y conserva el orden', () => {
    expect(fromDeeplXml('Si <x id="0"></x> es <g id="1">par</g>.')).toBe('Si ⟦0⟧ es ⟦1⟧par⟦/1⟧.');
  });
});
