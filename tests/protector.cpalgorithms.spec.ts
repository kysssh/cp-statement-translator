import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cpalgorithms } from '../src/adapters/cpalgorithms';
import { collectBlocks } from '../src/core/segmenter';
import { extract, restore } from '../src/core/protector';
import { translateBlocks } from '../src/core/pipeline';
import { DocTranslationView } from '../src/content/doc-view';

const cfg = cpalgorithms.protection;
const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
const load = (name: string) => {
  document.body.innerHTML = readFileSync(`tests/fixtures/${name}`, 'utf8');
  return cpalgorithms.findStatementRoot(document)!;
};
const collect = (root: Element) => collectBlocks(root, cpalgorithms.blockSelector, cfg);
const snapshots = (root: Element) => Array.from(root.querySelectorAll(cfg.opaqueSelector)).map(node => ({ node, html: node.outerHTML }));
const expectPreserved = (root: Element, saved: ReturnType<typeof snapshots>) => {
  for (const { node, html } of saved) {
    expect(root.contains(node)).toBe(true);
    expect(node.outerHTML).toBe(html);
  }
};

// Real rendered captures from T48. Large MathJax fixtures need extra parsing time.
describe.each(['corto', 'codigo', 'pestanas'])('T50: CP-Algorithms real %s', name => {
  it('round-trip y traduccion conservan nodos opacos, atributos y prosa', async () => {
    const root = load(`cpalgorithms-${name}.html`);
    const blocks = collect(root);
    expect(blocks.length).toBeGreaterThan(10);
    const saved = snapshots(root);
    const links = Array.from(root.querySelectorAll('a:not(.headerlink)')).map(a => ({ href: a.getAttribute('href'), title: a.getAttribute('title'), rel: a.getAttribute('rel'), target: a.getAttribute('target') }));
    for (const block of blocks) {
      const before = norm(block.textContent);
      const result = extract(block, cfg);
      block.replaceChildren(restore(result.text, result.slots));
      expect(norm(block.textContent)).toBe(before);
    }
    expectPreserved(root, saved);
    const translator = vi.fn(async (texts: string[]) => texts.map(t => `[ES] ${t}`));
    const result = await translateBlocks(blocks, cfg, translator);
    expect(result.skipped).toHaveLength(0);
    expect(result.translated).toBe(blocks.length);
    expect(blocks.every(b => b.textContent?.startsWith('[ES]'))).toBe(true);
    expectPreserved(root, saved);
    expect(Array.from(root.querySelectorAll('a:not(.headerlink)')).map(a => ({ href: a.getAttribute('href'), title: a.getAttribute('title'), rel: a.getAttribute('rel'), target: a.getAttribute('target') }))).toEqual(links);
    expect(translator.mock.calls[0][0].join(' ')).not.toContain('¶');
  }, 60000);
});

describe('T50: casos sinteticos identificados como tales', () => {
  let root: HTMLElement;
  beforeEach(() => { root = load('cpalgorithms-casos-sinteticos.html'); });

  it('traduce avisos, summary, tablas y prosa de ambas pestanas sin cambiar controles', async () => {
    const saved = snapshots(root);
    const tabs = Array.from(root.querySelectorAll<HTMLInputElement>('.tabbed-set > input'));
    tabs[1].checked = true;
    const table = root.querySelector('table')!;
    const details = root.querySelector('details')!;
    details.open = true;
    let toggles = 0;
    let copies = 0;
    details.addEventListener('toggle', () => toggles++);
    const button = root.querySelector('button')!;
    button.addEventListener('click', () => copies++);
    const blocks = collect(root);
    const selected = ['.admonition-title', '#warning', 'summary', '#proof-text', 'th', 'td', '#cpp-explanation', '#python-explanation'];
    for (const selector of selected) expect(Array.from(root.querySelectorAll(selector)).every(n => blocks.includes(n))).toBe(true);
    const result = await translateBlocks(blocks, cfg, async texts => texts.map(t => `[ES] ${t}`));
    expect(result.skipped).toHaveLength(0);
    for (const selector of selected) expect(Array.from(root.querySelectorAll(selector)).every(n => n.textContent?.startsWith('[ES]'))).toBe(true);
    expectPreserved(root, saved);
    expect(root.querySelector('table')).toBe(table);
    expect(root.querySelector('details')).toBe(details);
    expect(details.open).toBe(true);
    expect(tabs.map(t => t.checked)).toEqual([false, true]);
    button.click();
    details.dispatchEvent(new Event('toggle'));
    expect(copies).toBe(1);
    expect(toggles).toBeGreaterThan(0);
  });

  it('protege las cuatro formas de LaTeX crudo y conserva enlaces con formato', async () => {
    const raw = root.querySelector('#unrendered')!;
    const before = norm(raw.textContent);
    const extracted = extract(raw, cfg);
    expect(extracted.text).not.toContain('x_i');
    expect(extracted.text).not.toContain('sum');
    expect(extracted.text).not.toContain('a+b');
    expect(extracted.text).not.toContain('c+d');
    expect(extracted.slots.size).toBe(4);
    raw.replaceChildren(restore(extracted.text, extracted.slots));
    expect(norm(raw.textContent)).toBe(before);
    await translateBlocks(collect(root), cfg, async texts => texts.map(t => `[ES] ${t}`));
    expect(raw.textContent).toBe(`[ES] ${before}`);
    const link = root.querySelector('#linked a')!;
    expect(link.getAttribute('href')).toBe('../algebra/binary-exp.html#implementation');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.querySelector('strong')!.textContent).toBe('this example');
  });

  it('alterna EN/ES sin perder formulas, codigo, anclas ni contenido de tablas', () => {
    const blocks = collect(root);
    const originals = blocks.map(b => norm(b.textContent));
    const saved = snapshots(root).map(s => s.html);
    const view = new DocTranslationView();
    for (const block of blocks) {
      view.recordOriginal(block);
      const result = extract(block, cfg);
      view.applyBlock(block, restore(`[ES] ${result.text}`, result.slots));
    }
    for (let i = 0; i < 3; i++) {
      view.showOriginal();
      expect(blocks.map(b => norm(b.textContent))).toEqual(originals);
      expect(snapshots(root).map(s => s.html)).toEqual(saved);
      view.showTranslated();
      expect(blocks.map(b => norm(b.textContent))).toEqual(originals.map(s => `[ES] ${s}`));
      expect(snapshots(root).map(s => s.html)).toEqual(saved);
    }
  });

  it('una respuesta que pierde marcadores deja el bloque original intacto', async () => {
    const block = root.querySelector('#warning')!;
    const original = block.innerHTML;
    const saved = snapshots(block);
    const result = await translateBlocks([block], cfg, async () => ['Translation without markers']);
    expect(result.translated).toBe(0);
    expect(result.skipped).toEqual([block]);
    expect(block.innerHTML).toBe(original);
    expectPreserved(block, saved);
  });
});
