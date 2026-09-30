import { tokensOf } from './tokens';

export { tokensOf, normalizeTokens } from './tokens';

/**
 * La traducción es segura solo si conserva los mismos marcadores, en el mismo
 * orden y sin LaTeX crudo colado (`$$$`). Ante la duda: inválida.
 */
export function isValid(src: string, out: string): boolean {
  const a = tokensOf(src);
  const b = tokensOf(out);
  if (a.length !== b.length || !a.every((t, i) => t === b[i])) return false;
  if (!src.includes('$$$') && out.includes('$$$')) return false;
  return true;
}
