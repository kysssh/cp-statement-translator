import { describe, expect, it, vi } from 'vitest';
import { codeforces } from '../src/adapters/codeforces';
import { translateBlocks } from '../src/core/pipeline';
import { snapshotBlocks, createView } from '../src/content/toggle';

const options = { retryWithoutMarkers: true, preserveFailedSegments: true };
function setup() {
  document.body.innerHTML = '<p><b>Void Absorption</b> Assume that the dragon\'s current hit point is <span class="tex-span">h</span>, after casting this spell its hit point will become <span class="tex-span">⌊h/2⌋+10</span>. Here <span class="tex-span">⌊h/2⌋</span> denotes <span class="tex-span">h</span> divided by two, rounded down.</p>';
  return document.querySelector('p')!;
}
const spanish: Record<string, string> = {
  'Void Absorption': 'Absorción del vacío',
  "Assume that the dragon's current hit point is": 'Supongamos que la vida actual del dragón es',
  ', after casting this spell its hit point will become': ', tras lanzar este hechizo su vida será',
  '. Here': '. Aquí',
  'denotes': 'representa',
  'divided by two, rounded down.': 'dividido entre dos, redondeado hacia abajo.',
};

describe('Codeforces: recuperación por fragmentos', () => {
  it('traduce el hechizo sin enviar fórmulas al respaldo y conserva sus nodos', async () => {
    const block = setup();
    const formulas = [...block.querySelectorAll('.tex-span')];
    const html = formulas.map(node => node.outerHTML);
    const translate = vi.fn(async (texts: string[]) => texts.map(text =>
      text.includes('⟦') ? 'Respuesta sin marcadores' : spanish[text]));
    const result = await translateBlocks([block], codeforces.protection, translate, undefined, options);
    expect(result.skipped).toEqual([]);
    expect(result.partial).toEqual([]);
    expect(translate).toHaveBeenCalledTimes(3);
    expect(translate.mock.calls[2][0]).toEqual(Object.keys(spanish));
    expect(block.querySelector('b')?.textContent).toBe('Absorción del vacío');
    expect(block.textContent).toContain('dividido entre dos, redondeado hacia abajo.');
    expect([...block.querySelectorAll('.tex-span')]).toEqual(formulas);
    expect(formulas.map(node => node.outerHTML)).toEqual(html);
  });

  it('conserva solo el fragmento fallido, no cachea y permite alternar idiomas', async () => {
    const block = setup();
    const before = block.innerHTML;
    const snapshot = snapshotBlocks([block]);
    const cache = { load: vi.fn(async () => null), save: vi.fn(async () => {}) };
    const translate = vi.fn(async (texts: string[]) => texts.map(text =>
      text.includes('⟦') || text === 'denotes' ? '⟦999⟧' : spanish[text]));
    const result = await translateBlocks([block], codeforces.protection, translate, cache, options);
    expect(result.partial).toEqual([block]);
    expect(result.skipped).toEqual([]);
    expect(block.textContent).toContain('denotes');
    expect(block.textContent).toContain('Supongamos que la vida actual del dragón es');
    expect(block.textContent).not.toContain('999');
    expect(cache.save).not.toHaveBeenCalled();
    const translated = block.innerHTML;
    const view = createView([block], snapshot, result.skipped);
    view.showOriginal();
    expect(block.innerHTML).toBe(before);
    view.showTranslated();
    expect(block.innerHTML).toBe(translated);
  });

  it('recupera individualmente los fragmentos si falla el lote', async () => {
    const block = setup();
    const result = await translateBlocks([block], codeforces.protection, async texts => {
      if (texts.some(text => text.includes('⟦'))) return texts.map(() => '');
      if (texts.length > 1) throw new Error('Fallo de lote');
      if (texts[0] === 'denotes') throw new Error('Fallo de fragmento');
      return [spanish[texts[0]]];
    }, undefined, options);
    expect(result.partial).toEqual([block]);
    expect(block.textContent).toContain('denotes');
    expect(block.textContent).toContain('dividido entre dos, redondeado hacia abajo.');
  });

  it('no da por traducido un bloque que el proveedor devuelve idéntico', async () => {
    const block = setup();
    const before = block.innerHTML;
    const result = await translateBlocks([block], codeforces.protection, async texts => texts, undefined, options);
    expect(result.skipped).toEqual([block]);
    expect(result.partial).toEqual([]);
    expect(block.innerHTML).toBe(before);
  });

  it('una cancelación en el respaldo parcial no modifica ni cachea el bloque', async () => {
    const block = setup();
    const before = block.innerHTML;
    const abort = new AbortController();
    const cache = { load: vi.fn(async () => null), save: vi.fn(async () => {}) };
    await expect(translateBlocks([block], codeforces.protection, async texts => {
      if (!texts[0].includes('⟦')) abort.abort();
      return texts.map(() => '');
    }, cache, { ...options, signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(block.innerHTML).toBe(before);
    expect(cache.save).not.toHaveBeenCalled();
  });
});
