import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVjudge } from '../src/content/vjudge-controller';
import { vjudgePageKey, vjudgeTarget } from '../src/adapters/vjudge-context';
import { vjudge } from '../src/adapters/vjudge';
import { translateBlocks } from '../src/core/pipeline';
import { chromeBuiltin } from '../src/background/providers/chrome-builtin';

vi.mock('../src/background/providers/chrome-builtin', () => ({
  chromeBuiltin: { translate: vi.fn(async (texts: string[]) => texts.map(t => '[LOCAL] ' + t)) },
}));
let stop: (() => void) | undefined;
let store: Record<string, any>;
let loc: URL;
const read = (name: string) => readFileSync('tests/fixtures/' + name, 'utf8');
const locationOf = () => loc as unknown as Location;
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 100)); };
function shell() {
  // Captura real: iframe mismo origen reconstruido en jsdom sin descargar nada.
  document.body.innerHTML = read('vj-contest-shell-a.html');
  document.querySelectorAll('iframe:not(#frame-description-container iframe)').forEach(e => e.remove());
  const frame = document.querySelector<HTMLIFrameElement>('#frame-description-container iframe')!;
  frame.src = 'https://vjudge.net/problem/description/321177558442991?3551163336793';
  const child = frame.contentDocument!;
  Object.defineProperty(child, 'readyState', { value: 'complete', configurable: true });
  if (!child.documentElement) child.append(child.createElement('html'));
  if (!child.body) child.documentElement.append(child.createElement('body'));
  child.body.innerHTML = read('vj-contest-a.html');
  return frame;
}
function switchProblem(letter: 'A' | 'B', load = true) {
  loc.hash = '#problem/' + letter;
  const source = letter === 'A' ? 'CodeForces-1654C' : 'CodeForces-1279C';
  document.querySelector('#problem-title')!.innerHTML = '<a href="/problem/' + source + '">' + letter + '</a>';
  document.querySelectorAll('#problem-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('num') === letter));
  if (load) {
    const frame = document.querySelector<HTMLIFrameElement>('#frame-description-container iframe')!;
    const id = letter === 'A' ? '321177558442991' : '999999';
    document.querySelector<HTMLElement>('#prob-descs .active')!.dataset.key = id;
    frame.src = 'https://vjudge.net/problem/description/' + id;
    const child = frame.contentDocument!;
    Object.defineProperty(child, 'readyState', { value: 'complete', configurable: true });
    if (!child.documentElement) child.append(child.createElement('html'));
  if (!child.body) child.documentElement.append(child.createElement('body'));
  child.body.innerHTML = read(letter === 'A' ? 'vj-contest-a.html' : 'vj-contest-b.html');
    frame.dispatchEvent(new Event('load'));
  }
  window.dispatchEvent(new Event('hashchange'));
}
const click = () => (document.querySelector('.cpt-primary') as HTMLButtonElement).click();
const state = () => document.querySelector<HTMLElement>('.cpt-root')?.dataset.state;
const childRoot = () => document.querySelector<HTMLIFrameElement>('#frame-description-container iframe')!.contentDocument!.querySelector('#description-container')!;

beforeEach(() => {
  vi.clearAllMocks();
  store = { provider: 'groq' };
  loc = new URL('https://vjudge.net/contest/855562#problem/A');
  vi.stubGlobal('location', loc);
  vi.stubGlobal('chrome', {
    storage: { local: {
      get: vi.fn(async (keys: string | string[] | null) => keys === null ? { ...store } :
        Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, store[k]]))),
      set: vi.fn(async (items: any) => { Object.assign(store, items); }),
      remove: vi.fn(async (keys: string | string[]) => { for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k]; }),
    } },
    runtime: { sendMessage: vi.fn(async request => request.type === 'TRANSLATE' ?
      { ok: true, blocks: request.blocks.map((text: string) => '[ES] ' + text) } : {}) },
  });
});
afterEach(() => { stop?.(); stop = undefined; document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('V2: carcasa y origen reales', () => {
  it('resuelve el origen A/B desde tabla, pestaña y título', () => {
    shell();
    expect(vjudgePageKey(document, locationOf())).toBe('vj:CodeForces-1654C');
    expect(vjudge.problemKey(locationOf(), document)).toBe('vj:CodeForces-1654C');
    switchProblem('B');
    expect(vjudgePageKey(document, locationOf())).toBe('vj:CodeForces-1279C');
    expect(vjudgeTarget(document, locationOf())?.key).toBe('vj:CodeForces-1279C');
  });
  it('espera cuando título y pestaña todavía no corresponden al hash', () => {
    shell();
    loc.hash = '#problem/B';
    expect(vjudgeTarget(document, locationOf())).toBeNull();
  });
  it('una sola barra fuera del iframe y sin traducción automática', async () => {
    shell(); stop = startVjudge();
    expect(document.querySelectorAll('.cpt-root')).toHaveLength(1);
    expect(childRoot().querySelector('.cpt-root')).toBeNull();
    expect(document.querySelector('.cpt-msg')!.textContent).toContain('proveedor externo');
    document.querySelector('#problem-nav')!.append(document.createElement('span'));
    await settle();
    expect(document.querySelectorAll('.cpt-root')).toHaveLength(1);
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe('V2: traducción, navegación y caché', () => {
  it('traduce solo el abierto, alterna EN/ES y sirve A de caché tras A/B/A', async () => {
    shell(); stop = startVjudge(); click();
    await vi.waitFor(() => expect(state()).toBe('done'));
    const math = childRoot().querySelector('.katex');
    expect(childRoot().textContent).toContain('[ES]');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0]).toMatchObject({ cacheKey: 'vj:CodeForces-1654C' });
    const languageButtons = document.querySelectorAll<HTMLButtonElement>('.cpt-seg button');
    languageButtons[1].click();
    expect(childRoot().textContent).not.toContain('[ES]');
    languageButtons[0].click();
    expect(childRoot().querySelector('.katex')).toBe(math);
    switchProblem('B');
    expect(state()).toBe('idle');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    click(); await vi.waitFor(() => expect(state()).toBe('done'));
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    switchProblem('A'); click();
    await vi.waitFor(() => expect(state()).toBe('done'));
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.cpt-msg')!.textContent).toContain('caché');
  }, 20000);
  it('descarta respuestas tardías al cambiar de A a B', async () => {
    shell();
    let resolve!: (value: any) => void;
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    stop = startVjudge(); click();
    await vi.waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledOnce());
    const request = vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0] as any;
    switchProblem('B');
    const before = childRoot().innerHTML;
    resolve({ ok: true, blocks: request.blocks.map((t: string) => '[OLD A] ' + t) });
    await settle();
    expect(childRoot().innerHTML).toBe(before);
    expect(state()).toBe('idle');
    expect(Object.keys(store).filter(k => k.startsWith('cpt:'))).toHaveLength(0);
  });
  it('no muestra botón B mientras el iframe contiene A, incluso tras polling', async () => {
    shell(); stop = startVjudge();
    switchProblem('B', false);
    await settle();
    expect(document.querySelector('.cpt-root')).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(document.querySelector('.cpt-root')).toBeNull();
    switchProblem('B');
    await vi.waitFor(() => expect(state()).toBe('idle'));
  });
  it('cancelar evita aplicar la respuesta y permite reintentar', async () => {
    shell();
    let resolve!: (value: any) => void;
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    stop = startVjudge(); click();
    await vi.waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledOnce());
    const request = vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0] as any;
    (document.querySelector('.cpt-cancel') as HTMLButtonElement).click();
    resolve({ ok: true, blocks: request.blocks.map((t: string) => '[CANCELLED] ' + t) });
    await settle();
    expect(childRoot().textContent).not.toContain('[CANCELLED]');
    click(); await vi.waitFor(() => expect(state()).toBe('done'));
  });
  it('ignora un doble clic y cambios de DOM durante la petición', async () => {
    shell();
    let resolve!: (value: any) => void;
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    stop = startVjudge(); click(); click();
    await vi.waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledOnce());
    const request = vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0] as any;
    childRoot().querySelector('p')!.textContent = 'The statement has changed.';
    resolve({ ok: true, blocks: request.blocks.map((t: string) => '[OLD] ' + t) });
    await settle();
    expect(childRoot().textContent).not.toContain('[OLD]');
    expect(childRoot().textContent).toContain('The statement has changed.');
  });
});

describe('V2: privacidad y estados especiales', () => {
  it('solo local no envía mensajes de traducción al worker', async () => {
    shell(); store.vjudgeLocalOnly = true;
    stop = startVjudge(); click();
    await vi.waitFor(() => expect(state()).toBe('done'));
    expect(chromeBuiltin.translate).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(childRoot().textContent).toContain('[LOCAL]');
  });
  it('metadata es bloquea retraducción antes de usar proveedor', async () => {
    shell();
    document.querySelector<HTMLElement>('#prob-descs .active')!.dataset.lang = 'es';
    stop = startVjudge(); click();
    expect(state()).toBe('error');
    expect(document.querySelector('.cpt-msg')!.textContent).toContain('ya está en español');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
  it('heurística bloquea texto español sin metadata', () => {
    const frame = shell();
    document.querySelector<HTMLElement>('#prob-descs .active')!.dataset.lang = '';
    frame.contentDocument!.querySelector('#description-container')!.innerHTML =
      '<p>Para cada entrada dado el valor de los números, la salida debe indicar el resultado de cada una.</p>';
    stop = startVjudge(); click();
    expect(state()).toBe('error');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
  it.each(['pdf', 'empty', 'error', 'no-access', 'overview'])('sin botón funcional en %s', mode => {
    const frame = shell();
    if (mode === 'pdf') frame.contentDocument!.body.innerHTML = read('vj-uva.html');
    if (mode === 'empty') frame.contentDocument!.querySelector('#description-container')!.replaceChildren();
    if (mode === 'error') frame.contentDocument!.querySelector('#description-container')!.innerHTML = '<p role="alert">Error loading statement</p>';
    if (mode === 'no-access') document.querySelector('#frame-description-container')!.replaceChildren();
    if (mode === 'overview') loc.hash = '#overview';
    stop = startVjudge();
    expect(document.querySelector('.cpt-root')).toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe('pipeline: cancelación aditiva', () => {
  it('abortar antes de la caché no invoca al traductor', async () => {
    const controller = new AbortController(); controller.abort();
    const translate = vi.fn();
    await expect(translateBlocks([], vjudge.protection, translate, undefined, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(translate).not.toHaveBeenCalled();
  });
});
