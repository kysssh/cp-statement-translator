import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { extract, restore } from '../src/core/protector';
import { collectBlocks } from '../src/core/segmenter';
import { translateBlocks } from '../src/core/pipeline';
import { usaco } from '../src/adapters/usaco';

const FIXTURES = ['usaco-corto.html', 'usaco-formulas.html', 'usaco-tablas.html'];

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

function load(name: string): HTMLElement {
  document.body.innerHTML = readFileSync(`tests/fixtures/${name}`, 'utf8');
  return (document.querySelector('.markdown') ?? document.body.firstElementChild) as HTMLElement;
}

describe.each(FIXTURES)('round-trip USACO %s', (file) => {
  let root: HTMLElement;
  beforeEach(() => {
    root = load(file);
  });

  it('restore(extract()) conserva texto e identidad de los nodos protegidos', () => {
    const blocks = collectBlocks(root, usaco.blockSelector, usaco.protection);
    expect(blocks.length).toBeGreaterThan(0);

    for (const block of blocks) {
      const before = norm(block.textContent);
      const opaque = Array.from(block.querySelectorAll(usaco.protection.opaqueSelector));
      const { text, slots } = extract(block, usaco.protection);
      block.replaceChildren(restore(text, slots));
      expect(norm(block.textContent)).toBe(before);
      for (const node of opaque) {
        expect(block.contains(node)).toBe(true);
      }
    }
  });

  it('el texto a traducir no contiene etiquetas de fórmulas ni código opaco', () => {
    const blocks = collectBlocks(root, usaco.blockSelector, usaco.protection);
    for (const block of blocks) {
      const { text } = extract(block, usaco.protection);
      // No debe contener clases de KaTeX ni código HTML crudo filtrado
      expect(text).not.toContain('katex-html');
      expect(text).not.toContain('prism-code');
    }
  });

  it('el pipeline con [ES] no altera fórmulas, código ni tablas de problemas', async () => {
    const pres = Array.from(root.querySelectorAll('pre'));
    const math = Array.from(root.querySelectorAll('.language-math'));
    const problemTables = Array.from(root.querySelectorAll('table.no-markdown'));
    const htmlOf = (els: Element[]) => els.map((e) => e.outerHTML);
    const mathBefore = htmlOf(math);

    const blocks = collectBlocks(root, usaco.blockSelector, usaco.protection);
    const res = await translateBlocks(blocks, usaco.protection, async (t) =>
      t.map((s) => `[ES] ${s}`),
    );

    expect(res.skipped).toHaveLength(0);
    expect(res.translated).toBe(blocks.length);

    // pre instances remain identical
    pres.forEach((p, i) => expect(root.querySelectorAll('pre')[i]).toBe(p));

    // language-math instances are still in DOM and their outerHTML unchanged
    math.forEach((m) => expect(root.contains(m)).toBe(true));
    expect(htmlOf(math)).toEqual(mathBefore);

    // Tablas de problemas no se alteraron
    problemTables.forEach((t) => expect(root.contains(t)).toBe(true));
  });
});
