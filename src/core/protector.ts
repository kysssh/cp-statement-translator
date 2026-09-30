import { closeToken, openToken, tokenRegex } from './tokens';

/** Configuración de protección; la rellena cada adapter. */
export interface ProtectionConfig {
  /** Nodos que jamás se traducen ni se recorren (código, fórmulas, imágenes). */
  opaqueSelector: string;
  /** Formato que se conserva pero cuyo texto sí se traduce. */
  inlineSelector: string;
  /** LaTeX aún sin renderizar dentro de nodos de texto. */
  rawMathPattern?: RegExp;
}

export type Slot =
  | { kind: 'opaque'; node: Node } // nodo congelado (fórmula, <pre>, imagen)
  | { kind: 'inline'; el: Element }; // envoltorio de formato con texto dentro

export interface Extraction {
  /** Texto con marcadores ⟦n⟧ listo para traducir. */
  text: string;
  /** id → nodo ORIGINAL (referencia viva, no copia). */
  slots: Map<number, Slot>;
}

/**
 * Recorre el bloque y lo convierte en texto plano donde todo lo que no debe
 * traducirse (fórmulas, código, imágenes) es un marcador ⟦n⟧. Los ids son por bloque.
 */
export function extract(block: Element, cfg: ProtectionConfig): Extraction {
  const slots = new Map<number, Slot>();
  let next = 0;
  const alloc = (s: Slot): number => {
    const id = next++;
    slots.set(id, s);
    return id;
  };

  const protectRawMath = (text: string): string => {
    if (!cfg.rawMathPattern) return text;
    // Regex propio: una global compartida arrastraría `lastIndex` entre llamadas.
    const re = new RegExp(cfg.rawMathPattern.source, cfg.rawMathPattern.flags.includes('g') ? cfg.rawMathPattern.flags : cfg.rawMathPattern.flags + 'g');
    return text.replace(re, (match) => openToken(alloc({ kind: 'opaque', node: document.createTextNode(match) })));
  };

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return protectRawMath(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;

    // Opaco primero: gana sobre inline y NO se desciende (aquí vive la garantía).
    if (el.matches(cfg.opaqueSelector)) {
      return openToken(alloc({ kind: 'opaque', node: el }));
    }
    if (el.tagName === 'BR') return ' ';

    const inner = Array.from(el.childNodes).map(walk).join('');

    if (inner.trim() && el.matches(cfg.inlineSelector)) {
      const id = alloc({ kind: 'inline', el });
      return `${openToken(id)}${inner}${closeToken(id)}`;
    }
    return inner; // estructural: transparente
  };

  const text = Array.from(block.childNodes).map(walk).join('');
  return { text: text.replace(/\s+/g, ' ').trim(), slots };
}

/**
 * Reconstruye un árbol a partir del texto traducido, MOVIENDO los nodos
 * originales a su sitio. Nunca interpreta el texto como HTML.
 * Tolera marcadores inventados, duplicados, cierres sueltos y aperturas sin cierre.
 */
export function restore(translated: string, slots: Map<number, Slot>): DocumentFragment {
  const root = document.createDocumentFragment();
  const stack: Node[] = [root];
  const top = () => stack[stack.length - 1];
  const used = new Set<number>();

  const re = tokenRegex();
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(translated)) !== null) {
    const plain = translated.slice(cursor, m.index);
    if (plain) top().appendChild(document.createTextNode(plain));
    cursor = m.index + m[0].length;

    const closing = m[1] === '/';
    const id = Number(m[2]);
    const slot = slots.get(id);
    if (!slot) continue; // inventado por el traductor

    if (slot.kind === 'opaque') {
      if (closing || used.has(id)) continue;
      used.add(id);
      top().appendChild(slot.node);
      continue;
    }

    if (!closing) {
      if (used.has(id)) continue;
      used.add(id);
      const shell = slot.el.cloneNode(false);
      top().appendChild(shell);
      stack.push(shell);
    } else if (stack.length > 1) {
      stack.pop();
    }
  }

  const tail = translated.slice(cursor);
  if (tail) top().appendChild(document.createTextNode(tail));
  return root;
}
