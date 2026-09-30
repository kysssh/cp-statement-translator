import './ui.css';
import { resolveAdapter } from '../adapters';
import type { SiteAdapter } from '../adapters/types';
import { collectBlocks } from '../core/segmenter';
import { whenMathReady } from '../core/mathjax';
import { translateBlocks, type TranslateFn } from '../core/pipeline';
import { chromeBuiltin } from '../background/providers/chrome-builtin';
import { getProviderId, setThemeMode } from '../shared/settings';
import { providerName } from '../shared/provider-names';
import type { OpenOptionsRequest, TranslateRequest, TranslateResponse } from '../shared/messages';
import { mountUi, setThemeIcon, setUi, type Lang, type UiInfo } from './button';
import { initDark, isDark, onDarkChange } from './dark';
import { storageCache } from './cache';
import { createView, snapshotBlocks, type TranslationView } from './toggle';

function makeTranslate(provider: string, cacheKey: string): TranslateFn {
  return async (texts, opts) => {
    // El traductor local vive en la página: sin red y sin claves.
    if (provider === 'chrome-builtin') {
      return chromeBuiltin.translate(texts, { strict: opts?.isolated }, (m) => setUi('loading', { message: m }));
    }

    const req: TranslateRequest = { type: 'TRANSLATE', blocks: texts, cacheKey, strict: opts?.isolated };
    const res: TranslateResponse | undefined = await chrome.runtime.sendMessage(req);
    if (!res) throw new Error('El service worker no respondió.');
    if (!res.ok) throw new Error(res.error);
    return res.blocks;
  };
}

let view: TranslationView | null = null;
let doneInfo: UiInfo = {};

async function main() {
  const adapter = resolveAdapter(location);
  if (!adapter) return;

  const root = adapter.findStatementRoot(document);
  if (!root) return;

  await whenMathReady();
  mountUi(adapter.mountPoint(root), {
    onTranslate: () => void translate(adapter, root),
    onShow: showLang,
    onTheme: () => void setThemeMode(isDark() ? 'off' : 'on'),
    onSettings: () => {
      const req: OpenOptionsRequest = { type: 'OPEN_OPTIONS' };
      void chrome.runtime.sendMessage(req);
    },
  });
  void initDark();
  onDarkChange(setThemeIcon);
}

function showLang(lang: Lang) {
  if (!view) return;
  if (lang === 'en') view.showOriginal();
  else view.showTranslated();
  setUi('done', { ...doneInfo, lang });
}

async function translate(adapter: SiteAdapter, root: HTMLElement) {
  setUi('loading');
  try {
    const blocks = collectBlocks(root, adapter.blockSelector, adapter.protection);
    const provider = await getProviderId();
    const key = adapter.problemKey(location);
    const snapshot = snapshotBlocks(blocks);

    const result = await translateBlocks(
      blocks,
      adapter.protection,
      makeTranslate(provider, key),
      storageCache(key, provider),
    );

    view = createView(blocks, snapshot, result.skipped);
    doneInfo = {
      provider: providerName(provider),
      note:
        [
          result.fromCache ? 'Desde la caché.' : '',
          result.skipped.length
            ? `${result.skipped.length} bloque(s) se dejaron en inglés por seguridad (borde punteado).`
            : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined,
    };
    setUi('done', { ...doneInfo, lang: 'es' });
  } catch (e) {
    setUi('error', { message: e instanceof Error ? e.message : String(e) });
  }
}

main();
