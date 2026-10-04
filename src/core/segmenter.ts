import type { ProtectionConfig } from './protector';

export interface SegmentationOptions {
  /** Opt-in de VJudge: prosa directa aislada de los bloques hijos. */
  looseText?: boolean;
}

/** El comportamiento histórico no modifica el DOM y sigue siendo el predeterminado. */
export function collectBlocks(
  root: Element,
  blockSelector: string,
  cfg: ProtectionConfig,
  options: SegmentationOptions = {},
): Element[] {
  if (options.looseText) return collectLooseBlocks(root, blockSelector, cfg);
  const candidates = Array.from(root.querySelectorAll(blockSelector));
  return candidates.filter((el) => {
    if (el.closest(cfg.opaqueSelector)) return false;
    if (el.querySelector(blockSelector)) return false;
    return hasTranslatableText(el, cfg);
  });
}

/** En contenedores mixtos envuelve solamente las secuencias de prosa entre bloques. */
function collectLooseBlocks(root: Element, selector: string, cfg: ProtectionConfig): Element[] {
  const blocks: Element[] = [];
  const containers = 'div, dd, section, article, span.mathjax';
  const boundary = (el: Element) => {
    if (el.matches(cfg.opaqueSelector)) return false;
    return el.matches(selector) || el.matches(containers) ||
      Array.from(el.querySelectorAll(selector + ', ' + containers))
        .some(child => !child.closest(cfg.opaqueSelector));
  };
  const visit = (el: Element) => {
    if (el.closest(cfg.opaqueSelector)) return;
    const children = Array.from(el.childNodes);
    const split = children.some(node => node.nodeType === Node.ELEMENT_NODE && boundary(node as Element));
    if (!split) {
      if (hasTranslatableText(el, cfg)) blocks.push(el);
      return;
    }
    let run: Node[] = [];
    const flush = () => {
      if (!run.length) return;
      const probe = el.ownerDocument.createElement('span');
      for (const node of run) probe.appendChild(node.cloneNode(true));
      if (hasTranslatableText(probe, cfg)) {
        const wrapper = el.ownerDocument.createElement('span');
        wrapper.setAttribute('data-cpt-segment', '');
        el.insertBefore(wrapper, run[0]);
        for (const node of run) wrapper.appendChild(node);
        blocks.push(wrapper);
      }
      run = [];
    };
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE && boundary(child as Element)) {
        flush();
        visit(child as Element);
      } else run.push(child);
    }
    flush();
  };
  visit(root);
  return blocks;
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
