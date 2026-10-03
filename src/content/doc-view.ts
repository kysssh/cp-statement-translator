/**
 * Gestión del toggle EN ↔ ES y atribución para documentos largos (T47).
 *
 * En documentos largos traducidos por tramos o bajo demanda:
 *  - Cada bloque guarda su snapshot original antes de ser reemplazado.
 *  - Guarda también su snapshot traducido una vez generado.
 *  - showOriginal() y showTranslated() permiten alternar instantáneamente
 *    en cualquier momento, incluso con traducción a medias.
 *  - ensureAttribution() añade el aviso de atribución y licencia exigido.
 */

export class DocTranslationView {
  private showing: 'es' | 'en' = 'es';
  private readonly original = new Map<Element, Element>();
  private readonly translated = new Map<Element, Element>();

  get currentLang(): 'es' | 'en' {
    return this.showing;
  }

  get translatedCount(): number {
    return this.translated.size;
  }

  /**
   * Guarda el contenido original del bloque si todavía no se ha registrado.
   */
  recordOriginal(block: Element): void {
    if (!this.original.has(block)) {
      this.original.set(block, block.cloneNode(true) as Element);
    }
  }

  /**
   * Aplica un fragmento traducido al bloque, guardando antes el original
   * y registrando la traducción para alternar entre idiomas.
   */
  applyBlock(block: Element, fragment: DocumentFragment): void {
    this.recordOriginal(block);
    block.replaceChildren(fragment);
    this.translated.set(block, block.cloneNode(true) as Element);

    // Si el usuario tiene seleccionado ver el original en este momento,
    // revertimos inmediatamente el bloque al inglés.
    if (this.showing === 'en') {
      const orig = this.original.get(block);
      if (orig) {
        block.replaceChildren(...Array.from(orig.cloneNode(true).childNodes));
      }
    }
  }

  showOriginal(): void {
    this.showing = 'en';
    for (const [block, orig] of this.original) {
      block.replaceChildren(...Array.from(orig.cloneNode(true).childNodes));
    }
  }

  showTranslated(): void {
    this.showing = 'es';
    for (const [block, tr] of this.translated) {
      block.replaceChildren(...Array.from(tr.cloneNode(true).childNodes));
    }
  }

  clear(): void {
    this.original.clear();
    this.translated.clear();
    this.showing = 'es';
  }
}

/**
 * Inserta o asegura la presencia del aviso de atribución y licencia al final del artículo.
 */
export function ensureDocAttribution(
  root: HTMLElement,
  options: {
    siteName?: string;
    siteUrl?: string;
    licenseName?: string;
    licenseUrl?: string;
  } = {},
): HTMLElement {
  let banner = root.querySelector<HTMLElement>('.cpt-attribution');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'cpt-attribution';
    banner.setAttribute('role', 'note');

    const site = options.siteName ?? 'USACO Guide';
    const siteUrl = options.siteUrl ?? 'https://usaco.guide';
    const lic = options.licenseName ?? 'CC BY-NC-SA 4.0';
    const licUrl = options.licenseUrl ?? 'https://creativecommons.org/licenses/by-nc-sa/4.0/';

    banner.innerHTML = `
      <span class="cpt-attribution-text">
        Traducción automática generada con IA. Contenido original de
        <a href="${siteUrl}" target="_blank" rel="noopener noreferrer">${site}</a>,
        bajo licencia <a href="${licUrl}" target="_blank" rel="noopener noreferrer">${lic}</a>.
      </span>
    `;
    root.append(banner);
  }
  return banner;
}
