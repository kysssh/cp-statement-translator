import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAdapter } from '../src/adapters';
import { cpalgorithms } from '../src/adapters/cpalgorithms';
import { collectBlocks } from '../src/core/segmenter';
import { extract } from '../src/core/protector';

const state = vi.hoisted(() => ({ callbacks: null as any, cached: false }));
vi.mock('../src/content/button', () => ({
  mountUi: vi.fn((_root, callbacks) => { state.callbacks = callbacks; }),
  setUi: vi.fn(), setThemeIcon: vi.fn(),
}));
vi.mock('../src/content/dark', () => ({ initDark: vi.fn(), isDark: () => false, onDarkChange: vi.fn() }));
vi.mock('../src/content/navigation', () => ({
  waitForElement: vi.fn(async (selector) => document.querySelector(selector)),
  onSpaNavigate: vi.fn(),
}));
vi.mock('../src/content/block-cache', () => ({
  blockCacheStore: () => ({ saveBlock: vi.fn() }),
  partitionByCache: vi.fn(async (sources: string[]) => ({
    hits: state.cached ? new Map(sources.map((s, i) => [i, `ES ${s}`])) : new Map(),
    missMask: sources.map(() => !state.cached),
  })),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.callbacks = null;
  state.cached = false;
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(async req => ({ ok: true, blocks: req.blocks.map((s: string) => `ES ${s}`) })) } });
});
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

const loc = (url: string) => new URL(url) as unknown as Location;

describe('T49: seleccion del adapter y contenido real', () => {
  it.each([
    ['https://cp-algorithms.com/graph/breadth-first-search.html', 'cpalgorithms'],
    ['https://usaco.guide/silver/prefix-sums', 'usaco'],
    ['https://codeforces.com/problemset/problem/1/A', 'codeforces'],
    ['https://cses.fi/problemset/task/1068', 'cses'],
    ['https://cp-algorithms.com.example.org/test', undefined],
  ])('resuelve %s', (url, id) => {
    expect(resolveAdapter(loc(url))?.id).toBe(id);
  });

  it.each(['corto', 'codigo', 'pestanas'])('extrae prosa del fixture %s sin controles ni formulas', name => {
    document.body.innerHTML = readFileSync(`tests/fixtures/cpalgorithms-${name}.html`, 'utf8');
    const root = cpalgorithms.findStatementRoot(document)!;
    const blocks = collectBlocks(root, cpalgorithms.blockSelector, cpalgorithms.protection);
    expect(blocks.length).toBeGreaterThan(10);
    expect(blocks.some(b => b.tagName === 'H1')).toBe(true);
    expect(blocks.every(b => !b.closest('.metadata, .tabbed-labels, .highlight, .arithmatex'))).toBe(true);
    const texts = blocks.map(b => extract(b, cpalgorithms.protection).text);
    expect(texts.join(' ')).not.toContain('¶');
    expect(texts.join(' ')).not.toContain('Last update:');
    expect(texts.join(' ')).not.toContain('Contributors:');
  }, 15000);
});

describe('T49: content script de documentos', () => {
  it.each([
    ['cpalgorithms', false], ['cpalgorithms', true], ['usaco', false],
  ])('traduce %s (cache=%s) con sus selectores y atribucion', async (site, cached) => {
    const cp = site === 'cpalgorithms';
    state.cached = cached;
    vi.stubGlobal('location', loc(cp ? 'https://cp-algorithms.com/algebra/test.html' : 'https://usaco.guide/general/test'));
    document.body.innerHTML = cp
      ? '<aside><p>Navigation untouched</p></aside><article class="md-content__inner"><ul class="metadata"><li>Author untouched</li></ul><h1>Title<a class="headerlink" href="#title">¶</a></h1><p>Read <code>x</code> with <span class="arithmatex">$x$</span>.</p><div class="tabbed-labels"><label>Python</label></div></article>'
      : '<aside><p>Navigation untouched</p></aside><div class="markdown"><h2>Title</h2><p>Read <code class="inline-code">x</code> with <span class="language-math">$x$</span>.</p></div>';
    const protectedHtml = Array.from(document.querySelectorAll('code, .arithmatex, .language-math, .headerlink, .metadata, .tabbed-labels')).map(n => n.outerHTML);
    await import('../src/content/docs');
    await vi.waitFor(() => expect(state.callbacks).not.toBeNull());
    state.callbacks.onTranslate();
    await vi.waitFor(() => expect(document.querySelector('.cpt-attribution')).not.toBeNull());
    const root = document.querySelector(cp ? 'article' : '.markdown')!;
    expect(root.querySelector('p')!.textContent).toMatch(/^ES Read/);
    expect(document.querySelector('aside p')!.textContent).toBe('Navigation untouched');
    expect(Array.from(document.querySelectorAll('code, .arithmatex, .language-math, .headerlink, .metadata, .tabbed-labels')).map(n => n.outerHTML)).toEqual(protectedHtml);
    const banner = root.querySelector('.cpt-attribution')!;
    expect(banner.textContent).toContain(cp ? 'CP-Algorithms' : 'USACO Guide');
    expect(banner.textContent).toContain(cp ? 'CC BY-SA 4.0' : 'CC BY-NC-SA 4.0');
    state.callbacks.onShow('en');
    expect(root.querySelector('p')!.textContent).toBe('Read x with $x$.');
    state.callbacks.onShow('es');
    expect(root.querySelector('p')!.textContent).toMatch(/^ES Read/);
    const { onSpaNavigate } = await import('../src/content/navigation');
    expect(onSpaNavigate).toHaveBeenCalledTimes(cp ? 0 : 1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(cached ? 0 : 1);
  });

  it('no monta el traductor de documentos en Codeforces', async () => {
    vi.stubGlobal('location', loc('https://codeforces.com/problemset/problem/1/A'));
    await import('../src/content/docs');
    expect(state.callbacks).toBeNull();
  });
});


describe('T50: respuestas incompletas en el content script real', () => {
  it.each(['cache', 'api'])('preserva formulas y codigo si %s pierde marcadores', async source => {
    vi.stubGlobal('location', loc('https://cp-algorithms.com/algebra/test.html'));
    document.body.innerHTML = '<article class="md-content__inner"><p>Read <code>x</code> with <span class="arithmatex">$x$</span>.</p></article>';
    const block = document.querySelector('p')!;
    const original = block.innerHTML;
    const code = block.querySelector('code')!;
    const math = block.querySelector('.arithmatex')!;
    if (source === 'cache') {
      const { partitionByCache } = await import('../src/content/block-cache');
      vi.mocked(partitionByCache).mockImplementationOnce(async sources => ({ hits: new Map(sources.map((_, i) => [i, 'Broken cached translation'])), missMask: sources.map(() => false) }));
    } else {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({ ok: true, blocks: ['Broken API translation'] });
    }
    await import('../src/content/docs');
    await vi.waitFor(() => expect(state.callbacks).not.toBeNull());
    state.callbacks.onTranslate();
    await vi.waitFor(() => expect(document.querySelector('.cpt-attribution')).not.toBeNull());
    expect(block.querySelector('code')).toBe(code);
    expect(block.querySelector('.arithmatex')).toBe(math);
    expect(block.textContent).toBe(source === 'cache' ? 'ES Read x with $x$.' : 'Read x with $x$.');
    if (source === 'api') expect(block.innerHTML).toBe(original);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });
});
