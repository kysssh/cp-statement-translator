import { resolveAdapter } from '../adapters';
import type { SiteAdapter } from '../adapters/types';
import { collectBlocks } from '../core/segmenter';
import { whenMathReady } from '../core/mathjax';
import { translateBlocks, type TranslateFn } from '../core/pipeline';
import { chromeBuiltin } from '../background/providers/chrome-builtin';
import { getProviderId } from '../shared/settings';
import type { TranslateRequest, TranslateResponse } from '../shared/messages';
import { mountButton, setButtonState, type ButtonState } from './button';
import { storageCache } from './cache';
import { createView, snapshotBlocks, type TranslationView } from './toggle';

function makeTranslate(provider: string, cacheKey: string): TranslateFn {
  return async (texts, opts) => {
    // El traductor local vive en la página: sin red y sin claves.
    if (provider === 'chrome-builtin') {
      return chromeBuiltin.translate(texts, { strict: opts?.isolated }, (m) => setButtonState('loading', m));
    }

    const req: TranslateRequest = { type: 'TRANSLATE', blocks: texts, cacheKey, strict: opts?.isolated };
    const res: TranslateResponse | undefined = await chrome.runtime.sendMessage(req);
    if (!res) throw new Error('El service worker no respondió.');
    if (!res.ok) throw new Error(res.error);
    return res.blocks;
  };
}

let view: TranslationView | null = null;
let doneNote: string | undefined;

async function main() {
  const adapter = resolveAdapter(location);
  if (!adapter) return;

  const root = adapter.findStatementRoot(document);
  if (!root) return;

  await whenMathReady();
  mountButton(adapter.mountPoint(root), (state) => onClick(state, adapter, root));
}

function onClick(state: ButtonState, adapter: SiteAdapter, root: HTMLElement) {
  if (state === 'loading') return;
  if (state === 'done' && view) {
    view.showOriginal();
    setButtonState('original', 'Mostrando el enunciado original');
  } else if (state === 'original' && view) {
    view.showTranslated();
    setButtonState('done', doneNote);
  } else {
    void translate(adapter, root);
  }
}

async function translate(adapter: SiteAdapter, root: HTMLElement) {
  setButtonState('loading');
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
    doneNote = [
      result.fromCache ? 'Desde la caché.' : '',
      result.skipped.length ? `${result.skipped.length} bloque(s) sin traducir (borde punteado).` : '',
    ].filter(Boolean).join(' ') || undefined;
    setButtonState('done', doneNote);
  } catch (e) {
    setButtonState('error', e instanceof Error ? e.message : String(e));
  }
}

main();
