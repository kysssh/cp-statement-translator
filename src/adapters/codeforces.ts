import type { SiteAdapter } from './types';

export const codeforces: SiteAdapter = {
  id: 'codeforces',
  matches: (loc) => loc.hostname.endsWith('codeforces.com'),
  findStatementRoot: (doc) => doc.querySelector<HTMLElement>('.problem-statement'),

  blockSelector: 'p, li, .section-title, .property-title, .header .title',

  protection: {
    // .tex-span envuelve cada fórmula ($$$...$$$) antes y después de MathJax;
    // el resto cubre los distintos renderizados de MathJax/KaTeX.
    opaqueSelector: [
      'pre', 'code', 'kbd', 'samp',
      '.tex-span', '.tex-font-style-tt',
      '.MathJax', '.MathJax_Preview', '.MathJax_Display', '.MathJax_SVG', '.MathJax_CHTML',
      'mjx-container', '.mjx-chtml',
      'script', 'style',
      '.katex',
      'img', 'svg',
    ].join(','),
    inlineSelector: 'b, strong, i, em, u, a, .tex-font-style-bf, .tex-font-style-it',
    rawMathPattern: /\$\$\$[\s\S]*?\$\$\$/g,
  },

  problemKey: (loc) => `cf${loc.pathname}`,
  mountPoint: (root) => root.querySelector<HTMLElement>('.header') ?? root,
};
