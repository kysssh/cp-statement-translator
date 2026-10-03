/**
 * Segmentación de documentos por secciones y observación para traducción bajo demanda (T46).
 *
 * Cada <h2> delimita una sección temática. Dividir el documento en secciones permite:
 *  1. Traducir todo de golpe (modo 'all').
 *  2. Traducir solo lo que el usuario va leyendo al hacer scroll (modo 'scroll').
 *     Con 8 000 tokens/min y 200 000 tokens/día, esto ahorra cuota sustancial si
 *     el usuario solo consulta una parte del módulo.
 */

export interface DocSection {
  id: string;
  title: string;
  anchor: Element;
  blocks: Element[];
  state: 'pending' | 'translating' | 'translated';
}

/**
 * Agrupa los bloques extraídos por encabezados <h2>.
 * Los bloques antes del primer <h2> forman la sección de introducción.
 */
export function splitIntoSections(blocks: Element[]): DocSection[] {
  if (!blocks.length) return [];

  const sections: DocSection[] = [];
  let currentTitle = 'Introducción';
  let currentAnchor: Element = blocks[0];
  let currentBlocks: Element[] = [];
  let secIndex = 0;

  for (const block of blocks) {
    const isH2 = block.tagName.toLowerCase() === 'h2';

    if (isH2) {
      if (currentBlocks.length > 0) {
        sections.push({
          id: `sec-${secIndex++}`,
          title: currentTitle,
          anchor: currentAnchor,
          blocks: currentBlocks,
          state: 'pending',
        });
      }
      currentTitle = block.textContent?.trim() || `Sección ${secIndex + 1}`;
      currentAnchor = block;
      currentBlocks = [block];
    } else {
      currentBlocks.push(block);
    }
  }

  if (currentBlocks.length > 0) {
    sections.push({
      id: `sec-${secIndex++}`,
      title: currentTitle,
      anchor: currentAnchor,
      blocks: currentBlocks,
      state: 'pending',
    });
  }

  return sections;
}

/**
 * Observa las secciones con IntersectionObserver y notifica cuando entran en pantalla
 * (con margen para traducir con antelación antes de que el usuario llegue).
 */
export class SectionObserver {
  private observer: IntersectionObserver;
  private readonly sectionMap = new Map<Element, DocSection>();
  private readonly onIntersect: (section: DocSection) => void;

  constructor(
    onIntersect: (section: DocSection) => void,
    rootMargin = '300px 0px',
  ) {
    this.onIntersect = onIntersect;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sec = this.sectionMap.get(entry.target);
            if (sec && sec.state === 'pending') {
              this.observer.unobserve(entry.target);
              this.onIntersect(sec);
            }
          }
        }
      },
      { rootMargin },
    );
  }

  observe(sections: DocSection[]): void {
    for (const sec of sections) {
      if (sec.state === 'pending') {
        this.sectionMap.set(sec.anchor, sec);
        this.observer.observe(sec.anchor);
      }
    }
  }

  unobserve(section: DocSection): void {
    this.observer.unobserve(section.anchor);
    this.sectionMap.delete(section.anchor);
  }

  disconnect(): void {
    this.observer.disconnect();
    this.sectionMap.clear();
  }
}
