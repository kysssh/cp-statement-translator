import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { vjudge } from '../src/adapters/vjudge';
import { collectBlocks } from '../src/core/segmenter';
import { translateBlocks } from '../src/core/pipeline';
import { extract } from '../src/core/protector';
import { translateSegmentsBatch } from '../src/core/segments';

function alice() {
  document.body.innerHTML = readFileSync('tests/fixtures/vj-contest-a.html', 'utf8');
  const root = document.querySelector('#description-container')!;
  const blocks = collectBlocks(root, vjudge.blockSelector, vjudge.protection, vjudge.segmentation);
  const block = blocks.find(block => block.textContent?.startsWith('Alice has a cake'))!;
  expect(block).toBeDefined();
  return block;
}

describe('VJudge: respaldo del párrafo Alice and the Cake', () => {
  it('recupera el párrafo real cuando ambos intentos alteran los marcadores', async () => {
    const block = alice();
    const formulas = [...block.querySelectorAll('.katex')];
    const html = formulas.map(node => node.outerHTML);
    const translate = vi.fn(async (texts: string[]) => texts.map(text =>
      text.includes('⟦') ? 'Respuesta que perdió las fórmulas.' : 'ES: ' + text));
    const result = await translateBlocks([block], vjudge.protection, translate, undefined, { retryWithoutMarkers: true });
    expect(result.skipped).toHaveLength(0);
    expect(translate).toHaveBeenCalledTimes(3);
    const fragments = translate.mock.calls[2][0];
    expect(fragments.length).toBeGreaterThan(3);
    expect(fragments.every(text => !/[⟦⟧]/.test(text))).toBe(true);
    expect(fragments.join(' ')).toContain('Alice has a cake');
    expect(block.textContent).toContain('ES: Alice has a cake');
    expect([...block.querySelectorAll('.katex')]).toEqual(formulas);
    formulas.forEach((node, index) => {
      expect(block.contains(node)).toBe(true);
      expect(node.outerHTML).toBe(html[index]);
    });
  });

  it('reintenta una respuesta idéntica y una caché que conserva el inglés', async () => {
    const block = alice();
    const source = extract(block, vjudge.protection).text;
    const cache = { load: vi.fn(async () => [source]), save: vi.fn(async () => {}) };
    const translate = vi.fn(async (texts: string[]) => texts.map(text =>
      text.includes('⟦') ? text : 'ES: ' + text));
    const result = await translateBlocks([block], vjudge.protection, translate, cache, { retryWithoutMarkers: true });
    expect(result.fromCache).toBe(false);
    expect(result.skipped).toHaveLength(0);
    expect(translate).toHaveBeenCalledTimes(3);
    expect(cache.save).toHaveBeenCalledOnce();
  });

  it('conserva el original si el respaldo falla o devuelve marcadores nuevos', async () => {
    const block = alice();
    const before = block.innerHTML;
    const result = await translateBlocks([block], vjudge.protection,
      async texts => texts.map(() => '⟦999⟧'), undefined, { retryWithoutMarkers: true });
    expect(result.skipped).toEqual([block]);
    expect(block.innerHTML).toBe(before);
  });

  it('una cancelación durante el respaldo no aplica ni guarda respuestas', async () => {
    const block = alice();
    const before = block.innerHTML;
    const abort = new AbortController();
    const cache = { load: vi.fn(async () => null), save: vi.fn(async () => {}) };
    const translate = async (texts: string[]) => {
      if (!texts[0].includes('⟦')) abort.abort();
      return texts.map(text => text.includes('⟦') ? 'Marcadores perdidos' : 'ES: ' + text);
    };
    await expect(translateBlocks([block], vjudge.protection, translate, cache,
      { retryWithoutMarkers: true, signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(block.innerHTML).toBe(before);
    expect(cache.save).not.toHaveBeenCalled();
  });
});

describe('fragmentos en un lote', () => {
  it('conserva espacios, signos y marcadores anidados sin enviarlos al proveedor', async () => {
    const translate = vi.fn(async () => ['Hola', 'mundo']);
    expect(await translateSegmentsBatch(' Hello ⟦2⟧⟦1⟧⟦/2⟧ world. ', translate))
      .toBe(' Hola ⟦2⟧⟦1⟧⟦/2⟧ mundo ');
    expect(translate).toHaveBeenCalledWith(['Hello', 'world.']);
  });
  it('rechaza un lote incompleto o una respuesta vacía', async () => {
    await expect(translateSegmentsBatch('Hello ⟦0⟧ world', async () => ['Hola'])).rejects.toThrow();
    await expect(translateSegmentsBatch('Hello', async () => [''])).rejects.toThrow();
  });
});