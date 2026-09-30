import { existsSync, readFileSync, statSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { extract, restore } from '../src/core/protector';
import { isValid, normalizeTokens } from '../src/core/validator';
import { collectBlocks } from '../src/core/segmenter';
import { translateBlocks } from '../src/core/pipeline';
import { fnv1a } from '../src/core/hash';
import { codeforces } from '../src/adapters/codeforces';
import { cses } from '../src/adapters/cses';
import type { SiteAdapter } from '../src/adapters/types';

const real = (f: string) => existsSync(`tests/fixtures/${f}`) && statSync(`tests/fixtures/${f}`).size > 0;

const FIXTURES: [string, SiteAdapter][] = [
  ['cf-1030a.html', codeforces],
  ['cf-formulas.html', codeforces],
  ...((real('cf-2268e.html') ? [['cf-2268e.html', codeforces]] : []) as [string, SiteAdapter][]),
  ['cses-1068.html', cses],
];

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

function load(name: string): HTMLElement {
  document.body.innerHTML = readFileSync(`tests/fixtures/${name}`, 'utf8');
  return document.body.firstElementChild as HTMLElement;
}

describe.each(FIXTURES)('round-trip %s', (file, adapter) => {
  let root: HTMLElement;
  beforeEach(() => {
    root = load(file);
  });

  it('restore(extract()) conserva texto e identidad de los nodos protegidos', () => {
    const blocks = collectBlocks(root, adapter.blockSelector, adapter.protection);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const before = norm(block.textContent);
      const opaque = Array.from(block.querySelectorAll(adapter.protection.opaqueSelector));
      const { text, slots } = extract(block, adapter.protection);
      block.replaceChildren(restore(text, slots));
      expect(norm(block.textContent)).toBe(before);
      for (const node of opaque) expect(block.contains(node)).toBe(true);
    }
  });

  it('el texto a traducir no contiene fórmulas ni código', () => {
    const blocks = collectBlocks(root, adapter.blockSelector, adapter.protection);
    const leaks = ['$', '\\le', '\\rightarrow', '10^', 'katex'];
    for (const block of blocks) {
      const { text } = extract(block, adapter.protection);
      for (const l of leaks) expect(text).not.toContain(l);
    }
  });

  it('el pipeline con [ES] no altera fórmulas ni <pre>', async () => {
    const pres = Array.from(root.querySelectorAll('pre'));
    const math = Array.from(root.querySelectorAll(adapter.protection.opaqueSelector));
    const htmlOf = (els: Element[]) => els.map((e) => e.outerHTML);
    const mathBefore = htmlOf(math);
    const blocks = collectBlocks(root, adapter.blockSelector, adapter.protection);
    const res = await translateBlocks(blocks, adapter.protection, async (t) => t.map((s) => `[ES] ${s}`));
    expect(res.skipped).toHaveLength(0);
    expect(res.translated).toBe(blocks.length);
    expect(Array.from(root.querySelectorAll('pre'))).toEqual(pres);
    pres.forEach((p, i) => expect(root.querySelectorAll('pre')[i]).toBe(p));
    math.forEach((m) => expect(root.contains(m)).toBe(true));
    expect(htmlOf(math)).toEqual(mathBefore);
  });
});

describe('extract', () => {
  const cfg = codeforces.protection;
  const mk = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.replaceChildren(div);
    return div;
  };

  it('protege nodos opacos sin descender', () => {
    const b = mk('<p>Use <code>a[i]</code> and <span class="tex-span">n \\le 5</span>.</p>').firstElementChild!;
    const { text, slots } = extract(b, cfg);
    expect(text).toBe('Use ⟦0⟧ and ⟦1⟧.');
    expect(slots.size).toBe(2);
  });

  it('opaco gana sobre inline; inline conserva formato con fórmula dentro', () => {
    const b = mk('<p><b>the value <span class="tex-span">x</span> is</b> <span class="tex-font-style-tt">tt</span></p>').firstElementChild!;
    const { text } = extract(b, cfg);
    expect(text).toBe('⟦1⟧the value ⟦0⟧ is⟦/1⟧ ⟦2⟧');
  });

  it('protege LaTeX crudo $$$…$$$ aunque contenga letras', () => {
    const b = mk('<p>Given $$$n$$$ items and $$$a_i \\le 10$$$ values</p>').firstElementChild!;
    const { text, slots } = extract(b, cfg);
    expect(text).toBe('Given ⟦0⟧ items and ⟦1⟧ values');
    const frag = restore(text, slots);
    expect(frag.textContent).toBe('Given $$$n$$$ items and $$$a_i \\le 10$$$ values');
  });
});

describe('restore', () => {
  const cfg = codeforces.protection;

  it('reconstruye en orden: "Hola ⟦0⟧ mundo"', () => {
    const p = document.createElement('p');
    p.innerHTML = 'x <span class="tex-span">m</span> y';
    const math = p.querySelector('.tex-span'); // restore lo MUEVE fuera de <p>
    const { slots } = extract(p, cfg);
    const frag = restore('Hola ⟦0⟧ mundo', slots);
    expect(frag.childNodes).toHaveLength(3);
    expect(frag.childNodes[1]).toBe(math);
  });

  it('tolera marcadores inventados, cierres sueltos y aperturas sin cierre', () => {
    const p = document.createElement('p');
    p.innerHTML = '<b>bold</b> <span class="tex-span">m</span>';
    const { slots } = extract(p, cfg);
    expect(() => restore('a ⟦9⟧ b ⟦/0⟧ c ⟦0⟧ d ⟦1⟧ ⟦1⟧ ⟦/1⟧', slots)).not.toThrow();
    expect(restore('sin marcadores', slots).textContent).toBe('sin marcadores');
  });

  it('nunca interpreta HTML de la traducción', () => {
    const frag = restore('<img src=x onerror=alert(1)>', new Map());
    expect(frag.querySelector('img')).toBeNull();
    expect(frag.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('isValid / normalizeTokens', () => {
  const src = 'a ⟦0⟧ b ⟦1⟧x⟦/1⟧';
  it('igual ✔', () => expect(isValid(src, 'á ⟦0⟧ é ⟦1⟧y⟦/1⟧')).toBe(true));
  it('falta uno ✘', () => expect(isValid(src, 'a ⟦0⟧ b ⟦1⟧x')).toBe(false));
  it('desordenados ✘', () => expect(isValid(src, '⟦1⟧x⟦/1⟧ a ⟦0⟧')).toBe(false));
  it('inventado ✘', () => expect(isValid(src, 'a ⟦0⟧ ⟦5⟧ b ⟦1⟧x⟦/1⟧')).toBe(false));
  it('normaliza marcadores con espacios', () => {
    expect(normalizeTokens('a ⟦ 0 ⟧ b ⟦ / 1⟧')).toBe('a ⟦0⟧ b ⟦/1⟧');
  });
});

describe('pipeline: traductor que rompe cosas', () => {
  const cfg = codeforces.protection;
  const setup = () => {
    document.body.innerHTML =
      '<div><p>Given <span class="tex-span">n</span> numbers.</p><p>Print <span class="tex-span">m</span> lines.</p></div>';
    return Array.from(document.querySelectorAll('p'));
  };

  it('bloque que pierde un marcador se queda en inglés y marcado', async () => {
    const blocks = setup();
    const res = await translateBlocks(blocks, cfg, async (t) => t.map((s) => s.replace(/⟦\d+⟧/g, '')));
    expect(res.skipped).toHaveLength(2);
    expect(blocks[0].classList.contains('cpt-skipped')).toBe(true);
    expect(blocks[0].querySelector('.tex-span')).not.toBeNull();
  });

  it('marcadores con espacios se reparan y el reintento salva bloques', async () => {
    const blocks = setup();
    let calls = 0;
    const res = await translateBlocks(blocks, cfg, async (t) => {
      calls++;
      return t.map((s, i) => (calls === 1 && i === 1 ? 'roto' : s.replace(/⟦(\d+)⟧/g, '⟦ $1 ⟧')));
    });
    expect(res.skipped).toHaveLength(0);
    expect(calls).toBe(2);
    expect(blocks[1].querySelector('.tex-span')?.textContent).toBe('m');
  });

  it('si translate lanza, no se toca ningún bloque', async () => {
    const blocks = setup();
    const html = document.body.innerHTML;
    await expect(translateBlocks(blocks, cfg, async () => { throw new Error('red'); })).rejects.toThrow('red');
    expect(document.body.innerHTML).toBe(html);
  });
});

describe('fnv1a', () => {
  it('valores conocidos', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
  });
});

describe('caché del pipeline', () => {
  const cfg = codeforces.protection;
  const setup = () => {
    document.body.innerHTML = '<div><p>Given <span class="tex-span">n</span> numbers.</p></div>';
    return Array.from(document.querySelectorAll('p'));
  };
  const memory = () => {
    const store = new Map<string, string[]>();
    return {
      store,
      load: async (t: string[]) => store.get(t.join('|')) ?? null,
      save: async (t: string[], o: string[]) => void store.set(t.join('|'), o),
    };
  };

  it('segunda visita: cero llamadas al traductor', async () => {
    const cache = memory();
    let calls = 0;
    const tr = async (t: string[]) => (calls++, t.map((s) => `[ES] ${s}`));
    await translateBlocks(setup(), cfg, tr, cache);
    const res = await translateBlocks(setup(), cfg, tr, cache);
    expect(calls).toBe(1);
    expect(res.fromCache).toBe(true);
    expect(document.querySelector('.tex-span')?.textContent).toBe('n');
  });

  it('entrada de caché corrupta se ignora; los fallos no se cachean', async () => {
    const cache = memory();
    cache.store.set('Given ⟦0⟧ numbers.', ['sin marcadores']);
    let calls = 0;
    await translateBlocks(setup(), cfg, async (t) => (calls++, t.map((s) => `[ES] ${s}`)), cache);
    expect(calls).toBe(1);

    const bad = memory();
    await translateBlocks(setup(), cfg, async (t) => t.map(() => 'roto'), bad);
    expect(bad.store.size).toBe(0);
  });
});

describe('Codeforces con MathJax renderizado', () => {
  it('cada fórmula (Preview + MathJax + script) es UN solo marcador', () => {
    const root = load('cf-formulas.html');
    const blocks = collectBlocks(root, codeforces.blockSelector, codeforces.protection);
    let formulas = 0;
    for (const b of blocks) {
      const { text, slots } = extract(b, codeforces.protection);
      expect(text).not.toMatch(/⟦\d+⟧⟦\d+⟧/);
      for (const s of slots.values()) if (s.kind === 'opaque' && s.nodes.length === 3) formulas++;
    }
    expect(formulas).toBeGreaterThan(10);
  });

  it('el título de los ejemplos se traduce sin arrastrar el botón Copy', () => {
    const root = load('cf-1030a.html');
    const blocks = collectBlocks(root, codeforces.blockSelector, codeforces.protection);
    const t = blocks.find((b) => b.matches('.sample-test .title'))!;
    expect(extract(t, codeforces.protection).text).toMatch(/^Input ?⟦\d+⟧$/);
  });
});
