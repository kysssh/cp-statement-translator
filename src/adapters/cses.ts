import type { SiteAdapter } from './types';

// CSES renderiza con KaTeX en el cliente: cada fórmula es <span class="math ...">
// cuyo texto es el TeX crudo hasta que KaTeX lo reemplaza. En ambos estados
// el span sigue siendo opaco, así que no hace falta rawMathPattern.
export const cses: SiteAdapter = {
  id: 'cses',
  matches: (loc) => loc.hostname.endsWith('cses.fi'),
  findStatementRoot: (doc) => doc.querySelector<HTMLElement>('.content'),

  blockSelector: 'p, li, h1, h2, h3',

  protection: {
    opaqueSelector: [
      'pre', 'code', 'kbd', 'samp',
      '.math', '.katex',
      'script', 'style', 'link',
      'img', 'svg',
    ].join(','),
    inlineSelector: 'b, strong, i, em, u, a',
  },

  problemKey: (loc) => `cses${loc.pathname.replace(/\/$/, '')}`,
  mountPoint: (root) => root,
};
