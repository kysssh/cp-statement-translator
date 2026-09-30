import type { ProtectionConfig } from './protector';

/**
 * Bloques traducibles dentro de `root`: elementos de `blockSelector` que
 * - no están dentro de un nodo opaco (p. ej. un <p> dentro de un <pre>),
 * - no contienen a otro bloque (evita traducir el mismo texto dos veces),
 * - tienen texto real fuera de fórmulas y código.
 */
export function collectBlocks(
  root: Element,
  blockSelector: string,
  cfg: ProtectionConfig,
): Element[] {
  const candidates = Array.from(root.querySelectorAll(blockSelector));
  return candidates.filter((el) => {
    if (el.closest(cfg.opaqueSelector)) return false;
    if (el.querySelector(blockSelector)) return false;
    return hasTranslatableText(el, cfg);
  });
}

function hasTranslatableText(el: Element, cfg: ProtectionConfig): boolean {
  const visit = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.textContent ?? '';
      if (cfg.rawMathPattern) t = t.replace(cfg.rawMathPattern, '');
      return /\p{L}/u.test(t);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if ((node as Element).matches(cfg.opaqueSelector)) return false;
    return Array.from(node.childNodes).some(visit);
  };
  return Array.from(el.childNodes).some(visit);
}
