/**
 * Adapter para USACO Guide (T42).
 *
 * Selectores extraídos de NOTAS-DOM.md (T32): todo comprobado en el DOM real,
 * ninguno copiado de otro adapter.
 *
 * Resumen:
 *  - Contenedor: .markdown (NO main, que incluye la navegación)
 *  - Tablas de problemas (class="no-markdown"): se excluyen enteras
 *  - Fórmulas: .language-math (el .katex interno nunca aparece sin él)
 *  - Código: pre, .prism-code, code.inline-code
 *  - No hay rawMathPattern (0 mjx-container, KaTeX renderiza todo)
 *  - No hay pestañas de lenguaje ([role="tab"]) en las páginas medidas
 */

import type { SiteAdapter } from './types';

export const usaco: SiteAdapter = {
  id: 'usaco',
  contentType: 'doc',
  requiresGroq: true,

  matches(loc) {
    return loc.hostname === 'usaco.guide';
  },

  findStatementRoot(doc) {
    // .markdown es el único contenedor de contenido — comprobado en T32.
    return doc.querySelector<HTMLElement>('.markdown');
  },

  /**
   * Qué se traduce:
   *   p, li — prosa principal
   *   h2, h3, h4 — encabezados (contienen código inline, ver §6 de NOTAS-DOM)
   *   td, th — celdas de tablas matemáticas (las de problemas quedan excluidas por opaqueSelector)
   *   blockquote — citas / notas
   *
   * Qué NO se pone aquí:
   *   - Las tablas de problemas: excluidas enteras por opaqueSelector (table.no-markdown)
   *   - El sumario de details: excluido por opaqueSelector (details > summary)
   */
  blockSelector: [
    '.markdown > p',
    '.markdown > ul > li',
    '.markdown > ol > li',
    '.markdown > blockquote p',
    '.markdown > h2',
    '.markdown > h3',
    '.markdown > h4',
    '.markdown > table:not(.no-markdown) td',
    '.markdown > table:not(.no-markdown) th',
    // También dentro de divs/secciones directas (algunos módulos usan wrappers)
    '.markdown div > p',
    '.markdown div > ul > li',
    '.markdown div > ol > li',
    '.markdown div > blockquote p',
    '.markdown div > h2',
    '.markdown div > h3',
    '.markdown div > h4',
    '.markdown div > table:not(.no-markdown) td',
    '.markdown div > table:not(.no-markdown) th',
  ].join(', '),

  protection: {
    /**
     * Elementos que NO se traducen ni se desciende en ellos.
     *
     * .language-math — envoltorio KaTeX (inline y display), comprobado en §2
     * pre, .prism-code — código de programa (§3)
     * code.inline-code — código inline en prosa y encabezados (§3, §6)
     * img, svg — imágenes e iconos
     * button — botones de UI que React controla
     * a.anchor — enlace de ancla decorativo en los h2/h3 (solo SVG, §6)
     * span.absolute — span de layout del ancla, sin texto (§6)
     * details > summary — el texto "Show Tags" de los desplegables (§4, §5)
     * table.no-markdown — tabla de problemas entera (decisión §4)
     */
    opaqueSelector: [
      '.language-math',
      '.math-display',
      'pre',
      '.prism-code',
      'code.inline-code',
      'img',
      'svg',
      'button',
      'a.anchor',
      'span.absolute',
      'details > summary',
      'table.no-markdown',
    ].join(', '),

    /**
     * Formato que conserva sus etiquetas pero cuyo texto SÍ se traduce.
     * strong, em — negrita y cursiva
     * a — enlaces (href se conserva porque restore() clona la etiqueta vacía)
     * Excluye a.anchor que ya está en opaqueSelector.
     */
    inlineSelector: 'strong, em, a:not(.anchor)',

    // No hay rawMathPattern: 0 mjx-container, KaTeX renderiza todo (§2)
  },

  /**
   * Clave de documento para la caché por bloque (T38).
   * Incluye el pathname sin el parámetro ?lang=cpp que solo cambia el código.
   */
  problemKey(loc) {
    return `usaco:${loc.pathname}`;
  },

  /**
   * El botón se cuelga de document.body (fuera de la raíz de Next.js) para
   * que T41 no lo pierda al navegar. La UI flota con position: fixed en la CSS.
   */
  mountPoint(_root) {
    return document.body;
  },
};
