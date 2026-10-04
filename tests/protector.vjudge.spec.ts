import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { vjudge } from '../src/adapters/vjudge';
import { collectBlocks } from '../src/core/segmenter';
import { extract, restore } from '../src/core/protector';
import { translateBlocks } from '../src/core/pipeline';
import { isValid } from '../src/core/validator';

const fixtures = [
  'vj-atcoder.html', 'vj-codeforces.html', 'vj-codechef.html', 'vj-gym.html',
  'vj-hackerrank.html', 'vj-kattis.html', 'vj-poj.html', 'vj-usaco.html',
  'vj-contest-a.html', 'vj-contest-b.html',
];
function load(file: string): HTMLElement {
  document.body.innerHTML = readFileSync('tests/fixtures/' + file, 'utf8');
  const captured = document.body.firstElementChild as HTMLElement;
  if (captured.id === 'description-container') return captured;
  // Tres capturas comienzan en dd: reconstrucción explícita de la carcasa
  // observada en los otros fixtures, sin modificar el archivo original.
  const container = document.createElement('div');
  container.id = 'description-container';
  captured.replaceWith(container);
  container.append(captured);
  return container;
}
const collect = (root: Element) => collectBlocks(root, vjudge.blockSelector, vjudge.protection, vjudge.segmentation);
const opaque = (root: Element) => [...root.querySelectorAll(vjudge.protection.opaqueSelector)];
const locationOf = (url: string) => new URL(url) as unknown as Location;

describe.each(fixtures)('VJudge %s', (file) => {
  it('selecciona toda la prosa una sola vez y conserva el orden', () => {
    const root = load(file);
    const textBefore = root.textContent;
    expect(vjudge.findStatementRoot(document)).toBe(root);
    const blocks = collect(root);
    expect(blocks.length).toBeGreaterThan(0);
    expect(root.textContent).toBe(textBefore);
    for (const block of blocks) {
      expect(block.closest(vjudge.protection.opaqueSelector)).toBeNull();
      expect(blocks.some(other => other !== block && block.contains(other))).toBe(false);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!/\p{L}/u.test(node.textContent ?? '') ||
          node.parentElement?.closest(vjudge.protection.opaqueSelector)) continue;
      expect(blocks.filter(block => block.contains(node))).toHaveLength(1);
    }
    const prepared = root.innerHTML;
    expect(collect(root)).toEqual(blocks);
    expect(root.innerHTML).toBe(prepared);
  });

  it('round-trip exacto después de segmentar, con los mismos nodos opacos', () => {
    const root = load(file);
    const originalText = root.textContent;
    const blocks = collect(root);
    const before = root.innerHTML;
    const nodes = opaque(root);
    const html = nodes.map(node => node.outerHTML);
    for (const block of blocks) {
      const extraction = extract(block, vjudge.protection);
      expect(isValid(extraction.text, extraction.text)).toBe(true);
      block.replaceChildren(restore(extraction.text, extraction.slots));
    }
    expect(root.innerHTML).toBe(before);
    expect(root.textContent).toBe(originalText);
    const after = opaque(root);
    expect(after).toHaveLength(nodes.length);
    after.forEach((node, index) => {
      expect(node).toBe(nodes[index]);
      expect(node.outerHTML).toBe(html[index]);
    });
  });

  it('el pipeline no envía fórmulas, estilos ni ejemplos y preserva sus instancias', async () => {
    const root = load(file);
    const blocks = collect(root);
    const nodes = opaque(root);
    const html = nodes.map(node => node.outerHTML);
    const result = await translateBlocks(blocks, vjudge.protection, async texts => {
      for (const text of texts) {
        expect(text).not.toMatch(/\$|\\le|\\frac|\\begin|window\.katexOptions|font-family|katex/);
      }
      return texts.map(text => '[ES] ' + text);
    });
    expect(result.skipped).toHaveLength(0);
    expect(result.translated).toBe(blocks.length);
    opaque(root).forEach((node, index) => {
      expect(node).toBe(nodes[index]);
      expect(node.outerHTML).toBe(html[index]);
    });
  });
});

describe('VJudge: casos específicos', () => {
  it('POJ recoge descripción, entrada y salida sin párrafos', () => {
    const root = load('vj-poj.html');
    expect(root.querySelector('p')).toBeNull();
    const texts = collect(root).map(block => extract(block, vjudge.protection).text);
    expect(texts.some(text => text.includes('Here comes the problem'))).toBe(true);
    expect(texts.some(text => text.includes('There are several test cases'))).toBe(true);
    expect(texts.some(text => text.includes('output the maximum brightness'))).toBe(true);
  });

  it('USACO conserva la prosa dentro de span.mathjax', () => {
    const root = load('vj-usaco.html');
    const texts = collect(root).map(block => extract(block, vjudge.protection).text);
    expect(texts.some(text => text.includes('Farmer John'))).toBe(true);
  });

  it('caso sintético mixto: texto directo, formato, párrafos, listas y tabla', () => {
    document.body.innerHTML = '<div id="description-container">Before <b>bold</b><p>Middle <code>x</code></p> After <span><p>Nested paragraph</p>Tail</span><ul><li>Item<p>Details</p>Suffix</li></ul><table><tbody><tr><td>Cell</td></tr></tbody></table>End</div>';
    const root = document.body.firstElementChild!;
    const original = root.textContent;
    const blocks = collect(root);
    const sent = blocks.map(block => extract(block, vjudge.protection).text).join('|');
    for (const phrase of ['Before', 'bold', 'Middle', 'After', 'Nested paragraph', 'Tail', 'Item', 'Details', 'Suffix', 'Cell', 'End']) {
      expect(sent.split(phrase)).toHaveLength(2);
    }
    const before = root.innerHTML;
    for (const block of blocks) {
      const { text, slots } = extract(block, vjudge.protection);
      block.replaceChildren(restore(text, slots));
    }
    expect(root.innerHTML).toBe(before);
    expect(root.textContent).toBe(original);
  });

  it('caso sintético: conserva br, sub/sup, comentarios y envoltorios vacíos', () => {
    document.body.innerHTML = '<div id="description-container"><p>Limit 10<sup>5</sup><br>Value a<sub>i</sub><!-- keep --><span data-x="1"></span><u>underlined</u></p></div>';
    const root = document.body.firstElementChild!;
    const blocks = collect(root);
    const before = root.innerHTML;
    const nodes = [...root.querySelectorAll('br,sub,sup')];
    const { text, slots } = extract(blocks[0], vjudge.protection);
    expect(text).not.toContain('5');
    expect(text).not.toContain('keep');
    blocks[0].replaceChildren(restore(text, slots));
    expect(root.innerHTML).toBe(before);
    [...root.querySelectorAll('br,sub,sup')].forEach((node, index) => expect(node).toBe(nodes[index]));
  });

  it('protege seis delimitadores de LaTeX y deja importes sueltos como texto', () => {
    const root = document.createElement('div');
    root.textContent = String.raw`Given $n \le 10^5$, $$x$$, $$$a_i$$$, $$$$$$b_i$$$$$$, \(c_i\), \[d_i\]. Pay $5 and $10.`;
    const before = root.textContent;
    const { text, slots } = extract(root, vjudge.protection);
    expect(text).not.toMatch(/\\le|a_i|b_i|c_i|d_i/);
    expect(text).toContain('Pay $5 and $10.');
    expect(slots.size).toBe(6);
    root.replaceChildren(restore(text, slots));
    expect(root.textContent).toBe(before);
  });

  it('PDF no se selecciona aunque el visor tenga capa de texto', () => {
    document.body.innerHTML = readFileSync('tests/fixtures/vj-uva.html', 'utf8');
    expect(document.querySelector('.textLayer')?.textContent).toBeTruthy();
    expect(vjudge.findStatementRoot(document)).toBeNull();
    expect(collect(document.body.firstElementChild!)).toHaveLength(0);
  });

  it('sin contenedor no selecciona anuncios, páginas sin acceso ni dd ajenos', () => {
    document.body.innerHTML = '<div id="contest-description"><p>Organizer announcement</p></div><dl><dd>Not a statement</dd></dl>';
    expect(vjudge.findStatementRoot(document)).toBeNull();
    expect(vjudge.matches(locationOf('https://vjudge.net/contest/855562#overview'))).toBe(false);
    expect(vjudge.matches(locationOf('https://vjudge.net.evil.test/problem/CodeForces-1876C'))).toBe(false);
    expect(vjudge.matches(locationOf('https://vjudge.net/problem/description/321177558442991?123'))).toBe(true);
  });

  it('clave de origen estable para página suelta e iframe con referrer del problema', () => {
    const source = 'https://vjudge.net/problem/CodeForces-1876C';
    expect(vjudge.problemKey(locationOf(source))).toBe('vj:CodeForces-1876C');
    const doc = document.implementation.createHTMLDocument();
    Object.defineProperty(doc, 'referrer', { value: source });
    expect(vjudge.problemKey(locationOf('https://vjudge.net/problem/description/123?987'), doc)).toBe('vj:CodeForces-1876C');
  });

  it('fallback de descripción ignora query y separa versiones sin metadatos de origen', () => {
    const a = vjudge.problemKey(locationOf('https://vjudge.net/problem/description/123?111'));
    expect(a).toBe('vj:description:123');
    expect(vjudge.problemKey(locationOf('https://vjudge.net/problem/description/123?222'))).toBe(a);
    expect(vjudge.problemKey(locationOf('https://vjudge.net/problem/description/124'))).not.toBe(a);
  });
});
