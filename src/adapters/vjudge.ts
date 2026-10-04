import type { SiteAdapter } from './types';

/** Selectores de las capturas de V0; documento de enunciado dentro de un iframe. */
export const vjudge: SiteAdapter = {
  id: 'vjudge',
  contentType: 'problem',
  matches: (loc) => loc.hostname === 'vjudge.net' &&
    /^\/problem\/(?:description\/\d+|[^/]+-[^/]+)\/?$/.test(loc.pathname),
  findStatementRoot: (doc) => {
    if (doc.querySelector('.vjudge-pdf-viewer-container, .vjudge-pdf-viewer')) return null;
    return doc.querySelector<HTMLElement>('#description-container');
  },
  blockSelector: 'p, li, h1, h2, h3, h4, h5, h6, td, th, caption, blockquote, [data-cpt-segment]',
  segmentation: { looseText: true },
  protection: {
    opaqueSelector: [
      'pre', 'code', 'kbd', 'samp', '.vjudge_sample',
      '.katex', 'math', 'mjx-container', '.MathJax', '.MathJax_SVG',
      '.MathJax_Preview', '.MathJax_Display', '.MathJax_CHTML', '.mjx-chtml',
      '.tex-span', '.tex-font-style-tt',
      'br', 'sub', 'sup', 'img', 'svg', 'canvas',
      'script', 'style', 'link', 'input', 'button', 'select', 'textarea',
      '.copier', '.cpt-root', '.vjudge-pdf-viewer-container', '.vjudge-pdf-viewer',
    ].join(','),
    inlineSelector: 'b, strong, i, em, u, s, del, a, .tex-font-style-bf, .tex-font-style-it',
    preserveStructure: true,
    // Los importes sueltos $5 y $10 no se interpretan como fórmulas.
    rawMathPattern: /\${6}[\s\S]+?\${6}|\${3}[\s\S]+?\${3}|\$\$[\s\S]+?\$\$|(?<!\\)\$(?![\s$]|\d+(?:[.,]\d+)?(?:\s|$))(?:\\.|[^$\\\n])+?(?<![\s\\])\$(?![\d$])|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g,
  },
  problemKey: (loc, doc) => {
    const sourceKey = (url: string) => {
      const parsed = new URL(url, 'https://vjudge.net');
      if (parsed.hostname !== 'vjudge.net') return null;
      const source = /^\/problem\/(?!description\/)([^/]+-[^/]+)\/?$/.exec(parsed.pathname);
      return source ? 'vj:' + source[1] : null;
    };
    const direct = sourceKey(loc.href);
    if (direct) return direct;
    if (doc?.referrer) {
      const referrer = sourceKey(doc.referrer);
      if (referrer) return referrer;
    }
    try {
      const parent = doc?.defaultView?.parent;
      if (parent && parent !== doc?.defaultView) {
        const key = sourceKey(parent.location.href);
        if (key) return key;
      }
    } catch { /* Padre de otro origen. */ }
    // V0 no incluye los metadatos de origen del contest. Fallback separado
    // por descripción, nunca por contest/letra. V2 resolverá juez/id desde el padre.
    const description = /^\/problem\/description\/(\d+)\/?$/.exec(loc.pathname);
    if (description) return 'vj:description:' + description[1];
    throw new Error('No se pudo identificar el problema de VJudge.');
  },
  mountPoint: (root) => root,
};
