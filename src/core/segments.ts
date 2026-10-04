import { tokenRegex } from './tokens';

/**
 * Modo "aislado" para traductores que estropean los marcadores: los marcadores
 * NUNCA se envían al traductor. Se traduce solo el texto entre ellos y se
 * reensambla. Pierde algo de contexto gramatical, pero las fórmulas no pueden
 * moverse ni alterarse.
 */
export async function translateBySegments(
  text: string,
  translateOne: (s: string) => Promise<string>,
): Promise<string> {
  const re = tokenRegex();
  const parts: { token: boolean; s: string }[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) parts.push({ token: false, s: text.slice(cursor, m.index) });
    parts.push({ token: true, s: m[0] });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) parts.push({ token: false, s: text.slice(cursor) });

  const out: string[] = [];
  for (const p of parts) {
    if (p.token || !/\p{L}/u.test(p.s)) {
      out.push(p.s);
      continue;
    }
    const lead = /^\s*/.exec(p.s)![0];
    const trail = /\s*$/.exec(p.s)![0];
    out.push(lead + (await translateOne(p.s.trim())) + trail);
  }
  return out.join('');
}

/** Respaldo en un lote: los marcadores permanecen locales y se traduce la prosa. */
export async function translateSegmentsBatch(
  text: string,
  translateMany: (texts: string[]) => Promise<string[]>,
): Promise<string> {
  const re = tokenRegex();
  const parts: { source: string; index?: number }[] = [];
  const sources: string[] = [];
  const addText = (source: string) => {
    if (!/\p{L}/u.test(source)) { parts.push({ source }); return; }
    parts.push({ source, index: sources.length });
    sources.push(source.trim());
  };
  let cursor = 0;
  for (const match of text.matchAll(re)) {
    addText(text.slice(cursor, match.index));
    parts.push({ source: match[0] });
    cursor = match.index! + match[0].length;
  }
  addText(text.slice(cursor));
  if (!sources.length) return text;
  const outs = await translateMany(sources);
  if (outs.length !== sources.length || outs.some(out =>
      !out.trim() || tokenRegex().test(out) || /⟦|⟧/.test(out))) {
    throw new Error('El respaldo no devolvió todos los fragmentos de texto sin marcadores.');
  }
  return parts.map(part => part.index === undefined ? part.source :
    /^\s*/.exec(part.source)![0] + outs[part.index].trim() + /\s*$/.exec(part.source)![0]).join('');
}