import { vjudge } from '../adapters/vjudge';
import { mostlySpanish, vjudgeTarget, type VjudgeTarget } from '../adapters/vjudge-context';
import { collectBlocks } from '../core/segmenter';
import { extract } from '../core/protector';
import { translateBlocks } from '../core/pipeline';
import { chromeBuiltin } from '../background/providers/chrome-builtin';
import { getProviderId, getVjudgeLocalOnly } from '../shared/settings';
import { providerName } from '../shared/provider-names';
import type { TranslateResponse } from '../shared/messages';
import { mountUi, unmountUi, setUi, setThemeIcon, type UiInfo } from './button';
import { storageCache } from './cache';
import { createView, snapshotBlocks, type TranslationView } from './toggle';

const notice = 'Con un motor en línea, el texto se envía al proveedor externo. Para contenido privado puedes activar «Solo local en VJudge» en Opciones. Las imágenes conservan su texto original.';

/** Un único controlador en la página padre: lee el iframe del mismo origen. */
export function startVjudge(): () => void {
  let target: VjudgeTarget | null = null;
  let lastTarget: VjudgeTarget | null = null;
  let observedHtml = '';
  let abort: AbortController | null = null;
  let view: TranslationView | null = null;
  let info: UiInfo = {};
  let busy = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let childObserver: MutationObserver | null = null;
  const frames = new Set<HTMLIFrameElement>();
  const same = (a: VjudgeTarget | null, b: VjudgeTarget | null) =>
    !!a && !!b && a.root === b.root && a.frame === b.frame &&
    a.key === b.key && a.src === b.src && a.language === b.language;

  const resizeFrame = () => {
    if (!target?.frame) return;
    const height = target.root.ownerDocument.body.scrollHeight;
    if (height > 0) target.frame.style.height = height + 'px';
  };
  const clear = () => {
    abort?.abort();
    if (view && target && target.root.innerHTML === observedHtml) view.showOriginal();
    abort = null;
    busy = false;
    view = null;
    childObserver?.disconnect();
    childObserver = null;
    unmountUi();
    target = null;
  };
  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => { timer = undefined; sync(); }, 40);
  };
  const sync = () => {
    if (stopped) return;
    for (const frame of document.querySelectorAll<HTMLIFrameElement>('#frame-description-container iframe')) {
      if (!frames.has(frame)) { frames.add(frame); frame.addEventListener('load', schedule); }
    }
    const next = vjudgeTarget(document, location);
    if (same(target, next) && next!.root.innerHTML === observedHtml &&
        document.querySelector('.cpt-root')) return;
    // Si cambió el origen y el iframe aún contiene el problema anterior,
    // esperar a su carga/reemplazo antes de ofrecer traducción del nuevo.
    const stale = lastTarget && next && lastTarget.key !== next.key &&
      lastTarget.root === next.root && lastTarget.src === next.src;
    clear();
    if (!next || stale) return;
    const blocks = collectBlocks(next.root, vjudge.blockSelector, vjudge.protection, vjudge.segmentation);
    if (!blocks.length) return;
    target = next;
    lastTarget = next;
    observedHtml = next.root.innerHTML;
    const container = document.querySelector<HTMLElement>('#problem-title')?.parentElement ??
      document.querySelector<HTMLElement>('#frame-description-container') ?? next.root.parentElement ?? next.root;
    mountUi(container, {
      onTranslate: () => void translate(),
      onCancel: () => {
        if (!busy) return;
        abort?.abort();
        busy = false;
        observedHtml = target?.root.innerHTML ?? '';
        setUi('idle', { note: 'Traducción cancelada. Una petición ya enviada puede consumir cuota.' });
      },
      onShow: lang => {
        if (!view || !same(target, vjudgeTarget(document, location))) return;
        if (lang === 'en') view.showOriginal(); else view.showTranslated();
        observedHtml = target!.root.innerHTML;
        resizeFrame();
        setUi('done', { ...info, lang });
      },
      onSettings: () => { void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }); },
      onTheme: () => {
        const ui = document.querySelector<HTMLElement>('.cpt-root');
        if (!ui) return;
        const dark = ui.dataset.cptTheme ? ui.dataset.cptTheme === 'dark' :
          document.documentElement.dataset.bsTheme === 'dark';
        ui.dataset.cptTheme = dark ? 'light' : 'dark';
        setThemeIcon(!dark);
      },
    });
    setThemeIcon(document.documentElement.dataset.bsTheme === 'dark');
    setUi('idle', { note: notice });
    childObserver = new MutationObserver(schedule);
    childObserver.observe(next.root, { childList: true, subtree: true, characterData: true });
  };

  const translate = async () => {
    if (!target || busy || view) return;
    const current = target;
    if (!same(current, vjudgeTarget(document, location))) { sync(); return; }
    const blocks = collectBlocks(current.root, vjudge.blockSelector, vjudge.protection, vjudge.segmentation);
    const texts = blocks.map(block => extract(block, vjudge.protection).text);
    if (/^es(?:-|$)/i.test(current.language) || mostlySpanish(texts.join(' '))) {
      setUi('error', { message: 'Este enunciado ya está en español. Selecciona la versión original de VJudge.' });
      return;
    }
    if (!blocks.length) { clear(); return; }
    const run = new AbortController();
    abort = run;
    busy = true;
    observedHtml = current.root.innerHTML;
    const before = observedHtml;
    const isCurrent = () => !stopped && abort === run && !run.signal.aborted &&
      same(current, vjudgeTarget(document, location)) && current.root.innerHTML === before;
    setUi('loading');
    try {
      const localOnly = await getVjudgeLocalOnly();
      const provider = localOnly ? 'chrome-builtin' : await getProviderId();
      if (!isCurrent()) return;
      const snapshot = snapshotBlocks(blocks);
      const result = await translateBlocks(blocks, vjudge.protection, async (sources, opts) => {
        if (!isCurrent()) throw new DOMException('Problema cambiado', 'AbortError');
        if (provider === 'chrome-builtin') return chromeBuiltin.translate(sources, { strict: opts?.isolated }, message => {
          if (isCurrent()) setUi('loading', { message });
        });
        const response: TranslateResponse | undefined = await chrome.runtime.sendMessage({
          type: 'TRANSLATE', blocks: sources, cacheKey: current.key, strict: opts?.isolated,
        });
        if (!response) throw new Error('El service worker no respondió.');
        if (!response.ok) throw new Error(response.error);
        return response.blocks;
      }, storageCache(current.key, provider), { signal: run.signal, isCurrent, retryWithoutMarkers: true });
      if (abort !== run || run.signal.aborted) return;
      view = createView(blocks, snapshot, result.skipped);
      observedHtml = current.root.innerHTML;
      resizeFrame();
      info = {
        provider: providerName(provider),
        note: [
          result.fromCache ? 'Desde la caché.' : '',
          result.skipped.length ? result.skipped.length + ' bloque(s) se dejaron en inglés por seguridad.' : '',
          current.root.querySelectorAll('img').length >= 2 ? 'Las imágenes conservan su texto original.' : '',
        ].filter(Boolean).join(' ') || undefined,
      };
      setUi('done', { ...info, lang: 'es' });
    } catch (error) {
      if (abort !== run || run.signal.aborted) return;
      if (!same(current, vjudgeTarget(document, location))) { sync(); return; }
      setUi('error', { message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (abort === run) busy = false;
    }
  };

  const parentObserver = new MutationObserver(schedule);
  parentObserver.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['src', 'href', 'class', 'data-lang', 'data-key', 'style', 'checked'],
  });
  // hashchange también invalida inmediatamente las peticiones en vuelo.
  const navigate = () => { abort?.abort(); sync(); };
  window.addEventListener('hashchange', navigate);
  window.addEventListener('popstate', navigate);
  const interval = setInterval(schedule, 500);
  sync();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    clearInterval(interval);
    parentObserver.disconnect();
    window.removeEventListener('hashchange', navigate);
    window.removeEventListener('popstate', navigate);
    frames.forEach(frame => frame.removeEventListener('load', schedule));
    clear();
  };
}
