import { resolveAdapter } from '../adapters';
import type { SiteAdapter } from '../adapters/types';
import { collectBlocks } from '../core/segmenter';
import { whenMathReady } from '../core/mathjax';
import { translateBlocks, type TranslateFn } from '../core/pipeline';
import { mountButton, setButtonState } from './button';

// Fase 2: traductor falso. La fase 3 lo sustituye por el service worker.
const fakeTranslate: TranslateFn = async (texts) => texts.map((t) => `[ES] ${t}`);

async function main() {
  const adapter = resolveAdapter(location);
  if (!adapter) return;

  const root = adapter.findStatementRoot(document);
  if (!root) return;

  await whenMathReady();
  mountButton(adapter.mountPoint(root), () => run(adapter, root));
}

async function run(adapter: SiteAdapter, root: HTMLElement) {
  setButtonState('loading');
  try {
    const blocks = collectBlocks(root, adapter.blockSelector, adapter.protection);
    const { translated, skipped } = await translateBlocks(blocks, adapter.protection, fakeTranslate);
    console.log(`[cpt] traducidos: ${translated}, omitidos: ${skipped.length}`);
    setButtonState('done');
  } catch (e) {
    setButtonState('error', e instanceof Error ? e.message : String(e));
  }
}

main();
