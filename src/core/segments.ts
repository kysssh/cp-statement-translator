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
