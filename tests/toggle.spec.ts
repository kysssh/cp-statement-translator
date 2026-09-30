import { describe, expect, it } from 'vitest';
import { codeforces } from '../src/adapters/codeforces';
import { translateBlocks } from '../src/core/pipeline';
import { createView, snapshotBlocks } from '../src/content/toggle';

describe('toggle ES ↔ EN', () => {
  it('alterna sin perder las fórmulas originales y es idempotente', async () => {
    document.body.innerHTML =
      '<div><p>Given <b>the <span class="tex-span">n</span> value</b> now.</p><p>Skip <span class="tex-span">z</span> me</p></div>';
    const blocks = Array.from(document.querySelectorAll('p'));
    const originalHtml = blocks.map((b) => b.innerHTML);
    const math = document.querySelector('.tex-span')!;

    const snap = snapshotBlocks(blocks);
    const res = await translateBlocks(blocks, codeforces.protection, async (t) =>
      t.map((s) => (s.startsWith('Skip') ? 'roto' : `[ES] ${s}`)),
    );
    expect(res.skipped).toHaveLength(1);
    const view = createView(blocks, snap, res.skipped);

    const es = blocks.map((b) => b.innerHTML);
    expect(blocks[0].textContent).toContain('[ES]');
    expect(blocks[0].contains(math)).toBe(true);

    view.showOriginal();
    view.showOriginal();
    expect(blocks.map((b) => b.innerHTML)).toEqual([originalHtml[0], blocks[1].innerHTML]);
    expect(blocks[0].textContent).not.toContain('[ES]');

    view.showTranslated();
    view.showTranslated();
    expect(blocks.map((b) => b.innerHTML)).toEqual(es);
    expect(blocks[0].contains(math)).toBe(true);
  });
});
