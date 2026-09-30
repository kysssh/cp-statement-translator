import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectBlocks } from '../src/core/segmenter';
import { codeforces } from '../src/adapters/codeforces';
import { cses } from '../src/adapters/cses';

function load(name: string): HTMLElement {
  document.body.innerHTML = readFileSync(`tests/fixtures/${name}`, 'utf8');
  return document.body.firstElementChild as HTMLElement;
}

describe('collectBlocks', () => {
  it('Codeforces: nada dentro de <pre>, sin anidados, sin bloques vacíos', () => {
    const root = load('cf-1030a.html');
    const blocks = collectBlocks(root, codeforces.blockSelector, codeforces.protection);
    expect(blocks.length).toBeGreaterThan(5);
    for (const b of blocks) {
      expect(b.closest('pre')).toBeNull();
      expect(blocks.some((o) => o !== b && b.contains(o))).toBe(false);
    }
    const titles = blocks.map((b) => b.textContent);
    expect(titles).toContain('Input');
  });

  it('CSES: incluye párrafos y encabezados, excluye <li> solo de fórmula', () => {
    const root = load('cses-1068.html');
    const blocks = collectBlocks(root, cses.blockSelector, cses.protection);
    const tags = blocks.map((b) => b.tagName);
    expect(tags.filter((t) => t === 'H1')).toHaveLength(4);
    expect(blocks.some((b) => b.textContent?.includes('1 \\le n'))).toBe(false);
    expect(blocks.every((b) => !b.closest('pre'))).toBe(true);
  });
});
