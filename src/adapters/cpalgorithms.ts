import type { SiteAdapter } from './types';

/** Selectores comprobados en el DOM renderizado durante T48 (NOTAS-DOM.md). */
export const cpalgorithms: SiteAdapter = {
  id: 'cpalgorithms',
  contentType: 'doc',
  requiresGroq: true,
  documentation: {
    rootSelector: 'article.md-content__inner',
    // T48: cambiar de artículo carga un documento nuevo.
    spaNavigation: false,
    attribution: {
      siteName: 'CP-Algorithms',
      siteUrl: 'https://cp-algorithms.com',
      licenseName: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  },
  matches: (loc) => loc.hostname === 'cp-algorithms.com',
  findStatementRoot: (doc) => doc.querySelector<HTMLElement>('article.md-content__inner'),
  blockSelector: 'p, li, h1, h2, h3, h4, h5, h6, td, th, summary',
  protection: {
    opaqueSelector: [
      // El envoltorio existe antes y después de renderizar MathJax.
      '.arithmatex', 'mjx-container', '.MathJax',
      '.highlight', 'pre', 'code', 'kbd', 'samp',
      'a.headerlink', 'a[name]:not([href])', 'br', '.md-content__button', '.metadata',
      // Mantener inputs, etiquetas y enlaces de selección de lenguaje.
      '.tabbed-labels', 'input', 'button', 'select', 'textarea',
      'script', 'style', 'link', 'img', 'svg',
      '.cpt-root', '.cpt-attribution',
    ].join(', '),
    inlineSelector: 'b, strong, i, em, u, s, del, a:not(.headerlink)',
    // Respaldo para LaTeX fuera de .arithmatex antes de que cargue MathJax.
    rawMathPattern: /\$\$[\s\S]+?\$\$|(?<!\\)\$(?!\$)(?:\\.|[^$\\])+?(?<!\\)\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g,
  },
  problemKey: (loc) => `cpalgorithms:${loc.pathname}`,
  mountPoint: () => document.body,
};
