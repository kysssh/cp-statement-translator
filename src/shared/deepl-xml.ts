import { tokenRegex } from '../core/tokens';

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/**
 * ⟦n⟧ sin cierre → <x id="n"/>   (nodo protegido: DeepL no lo toca)
 * ⟦n⟧ … ⟦/n⟧     → <g id="n"> … </g>   (formato: el texto de dentro sí se traduce)
 * El resto del texto se escapa como XML.
 */
export function toDeeplXml(text: string): string {
  const closing = new Set<string>();
  for (const m of text.matchAll(tokenRegex())) if (m[1] === '/') closing.add(m[2]);

  let out = '';
  let cursor = 0;
  for (const m of text.matchAll(tokenRegex())) {
    out += escapeXml(text.slice(cursor, m.index));
    cursor = m.index + m[0].length;
    const [, slash, id] = m;
    if (slash === '/') out += '</g>';
    else if (closing.has(id)) out += `<g id="${id}">`;
    else out += `<x id="${id}"/>`;
  }
  return out + escapeXml(text.slice(cursor));
}

/** Inversa de toDeeplXml; tolera que DeepL escriba <x id="3"></x> en lugar de <x id="3"/>. */
export function fromDeeplXml(xml: string): string {
  const TAG = /<x id="(\d+)"\s*\/>|<x id="(\d+)"\s*>\s*<\/x>|<g id="(\d+)"\s*>|<\/g>/g;
  const stack: string[] = [];
  let out = '';
  let cursor = 0;
  for (const m of xml.matchAll(TAG)) {
    out += unescapeXml(xml.slice(cursor, m.index));
    cursor = m.index + m[0].length;
    if (m[1] ?? m[2]) out += `⟦${m[1] ?? m[2]}⟧`;
    else if (m[3]) {
      stack.push(m[3]);
      out += `⟦${m[3]}⟧`;
    } else {
      const id = stack.pop();
      if (id !== undefined) out += `⟦/${id}⟧`;
    }
  }
  return out + unescapeXml(xml.slice(cursor));
}
