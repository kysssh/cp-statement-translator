/**
 * Estimación de tokens (T34).
 *
 * Es una HEURÍSTICA, no un dato exacto: sirve para decidir cuántos bloques
 * caben en un lote sin gastar una llamada midiendo. La autoridad es el campo
 * `usage` de la respuesta del proveedor.
 *
 * English/code se acerca a ~4 caracteres por token.
 *
 * Para la SALIDA no se toca el divisor, sino el numerador: una traducción al
 * español ocupa más caracteres para el mismo contenido (artículos, preposiciones
 * y la "-ción"/"-dad" que el inglés no tiene), así que la salida se estima un
 * 15 % por encima de la entrada.
 */
export const CHARS_PER_TOKEN = 4;
export const OUTPUT_EXPANSION = 1.15;

/** Tokens estimados de entrada para un texto que ya va a enviarse. */
export function estimateTokens(text: string, charsPerToken: number = CHARS_PER_TOKEN): number {
  if (!text) return 0;
  return Math.ceil(text.length / charsPerToken);
}

/** Tokens estimados de salida al traducir ese texto al español. */
export function estimateOutputTokens(text: string): number {
  return Math.ceil(estimateTokens(text) * OUTPUT_EXPANSION);
}

/**
 * Coste total de una petición que envía `blocks` más `systemPrompt`, suponiendo
 * que la traducción en español sale aproximadamente como el texto de entrada.
 */
export interface RequestCost {
  input: number;
  output: number;
  total: number;
}

export function estimateRequestCost(systemPrompt: string, blocks: readonly string[]): RequestCost {
  const prompt = estimateTokens(systemPrompt);
  const body = blocks.reduce((acc, b) => acc + estimateTokens(b), 0);
  const out = blocks.reduce((acc, b) => acc + estimateOutputTokens(b), 0);
  return { input: prompt + body, output: out, total: prompt + body + out };
}
