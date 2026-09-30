/** Marcador ⟦n⟧ / ⟦/n⟧ (U+27E6 / U+27E7). Ver plan §2.5. */
export const TOKEN_SOURCE = '⟦(\\/?)(\\d+)⟧';

/** Regex nuevo en cada llamada: las regex globales guardan `lastIndex`. */
export const tokenRegex = (): RegExp => new RegExp(TOKEN_SOURCE, 'g');

export const openToken = (id: number): string => `⟦${id}⟧`;
export const closeToken = (id: number): string => `⟦/${id}⟧`;

export function tokensOf(s: string): string[] {
  return s.match(tokenRegex()) ?? [];
}

/**
 * Los traductores automáticos suelen "respirar" los marcadores: `⟦ 3 ⟧`, `⟦/ 3⟧`.
 * Los devuelve a la forma canónica sin tocar nada más.
 */
export function normalizeTokens(s: string): string {
  return s.replace(/⟦\s*(\/?)\s*(\d+)\s*⟧/g, (_m, slash: string, id: string) => `⟦${slash}${id}⟧`);
}
