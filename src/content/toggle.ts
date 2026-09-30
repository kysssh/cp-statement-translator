export interface TranslationView {
  readonly showing: 'es' | 'en';
  showOriginal(): void;
  showTranslated(): void;
}

/**
 * Copia profunda de cada bloque ANTES de traducir. Hay que hacerlo antes porque
 * restore() MUEVE las fórmulas del bloque original al árbol traducido.
 */
export function snapshotBlocks(blocks: Element[]): Map<Element, Element> {
  return new Map(blocks.map((b) => [b, b.cloneNode(true) as Element]));
}

/**
 * Alterna entre el árbol traducido (los nodos vivos, con las fórmulas originales)
 * y una réplica del original. Es idempotente: pulsarlo N veces seguidas es seguro.
 * Los bloques omitidos (`skipped`) no cambiaron y no se tocan.
 */
export function createView(
  blocks: Element[],
  snapshot: Map<Element, Element>,
  skipped: Element[] = [],
): TranslationView {
  const changed = blocks.filter((b) => !skipped.includes(b));
  const es = new Map(changed.map((b) => [b, Array.from(b.childNodes)]));
  let showing: 'es' | 'en' = 'es';

  return {
    get showing() {
      return showing;
    },
    showOriginal() {
      if (showing === 'en') return;
      for (const b of changed) {
        const copy = snapshot.get(b)!.cloneNode(true) as Element;
        b.replaceChildren(...Array.from(copy.childNodes));
      }
      showing = 'en';
    },
    showTranslated() {
      if (showing === 'es') return;
      for (const b of changed) b.replaceChildren(...es.get(b)!);
      showing = 'es';
    },
  };
}
