import { describe, expect, it } from 'vitest';
import { DocTranslationView, ensureDocAttribution } from '../src/content/doc-view';
import { splitIntoSections } from '../src/content/sections';

describe('DocTranslationView & splitIntoSections (T46 & T47)', () => {
  it('splitIntoSections agrupa bloques por <h2>', () => {
    document.body.innerHTML = `
      <div class="markdown">
        <p>Intro block 1</p>
        <p>Intro block 2</p>
        <h2>First Section</h2>
        <p>Section 1 text</p>
        <h2>Second Section</h2>
        <p>Section 2 text</p>
      </div>
    `;

    const blocks = Array.from(document.querySelectorAll('.markdown > *'));
    const sections = splitIntoSections(blocks);

    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe('Introducción');
    expect(sections[0].blocks).toHaveLength(2);

    expect(sections[1].title).toBe('First Section');
    expect(sections[1].blocks).toHaveLength(2); // h2 + p

    expect(sections[2].title).toBe('Second Section');
    expect(sections[2].blocks).toHaveLength(2); // h2 + p
  });

  it('DocTranslationView alterna entre ES y EN preservando nodos', () => {
    document.body.innerHTML = '<div class="markdown"><p>Original <code>x</code> text</p></div>';
    const p = document.querySelector('p')!;
    const originalHtml = p.innerHTML;

    const view = new DocTranslationView();
    const frag = document.createDocumentFragment();
    const span = document.createElement('span');
    span.textContent = 'Texto traducido con ';
    const code = document.createElement('code');
    code.textContent = 'x';
    frag.append(span, code);

    view.applyBlock(p, frag);

    expect(p.textContent).toBe('Texto traducido con x');
    expect(view.currentLang).toBe('es');

    view.showOriginal();
    expect(p.innerHTML).toBe(originalHtml);
    expect(view.currentLang).toBe('en');

    view.showTranslated();
    expect(p.textContent).toBe('Texto traducido con x');
    expect(view.currentLang).toBe('es');
  });

  it('ensureDocAttribution inserta aviso con licencia y enlaces', () => {
    document.body.innerHTML = '<div class="markdown"></div>';
    const root = document.querySelector('.markdown') as HTMLElement;

    const banner = ensureDocAttribution(root);
    expect(root.contains(banner)).toBe(true);
    expect(banner.textContent).toContain('CC BY-NC-SA 4.0');
    expect(banner.textContent).toContain('USACO Guide');

    // Idempotente
    const banner2 = ensureDocAttribution(root);
    expect(banner2).toBe(banner);
    expect(root.querySelectorAll('.cpt-attribution')).toHaveLength(1);
  });
});
