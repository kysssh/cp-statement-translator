import { estimateTokens } from './estimate-tokens';

/** Un bloque de texto listo para traducir, con su posición original. */
export interface Chunkable {
  text: string;
}

export interface Chunk<T extends Chunkable> {
  /** Los bloques del lote, en el orden en que se.leyeron. */
  blocks: T[];
  /** Índices originales de cada bloque, para colocar las traducciones. */
  indices: number[];
  /** Tokens estimados de entrada (bloques + prompt), sin la salida. */
  estimatedTokens: number;
}

/**
 * Agrupa bloques en lotes que no superen `budgetTokens` de entrada.
 *
 * Reglas:
 *  - nunca parte un bloque;
 *  - un bloque que por sí solo supera el presupuesto va SOLO en su lote
 *    (es mejor pedirlo una vez y arriesgarse que trocear la traducción);
 *  - se conserva el orden original;
 *  - cada lote recuerda los índices originales para poder remapear.
 *
 *voraz y secuencial: es el comportamiento correcto aquí, porque el orden de
 * lectura es lo que importa y trocear un párrafo arruina la traducción.
 */
export function chunkBlocks<T extends Chunkable>(
  blocks: readonly T[],
  budgetTokens: number,
  promptTokens = 0,
): Chunk<T>[] {
  const chunks: Chunk<T>[] = [];
  let current: T[] = [];
  let currentIndices: number[] = [];
  let currentTokens = promptTokens;

  const flush = () => {
    if (current.length) chunks.push({ blocks: current, indices: currentIndices, estimatedTokens: currentTokens });
    current = [];
    currentIndices = [];
    currentTokens = promptTokens;
  };

  blocks.forEach((block, index) => {
    const tokens = estimateTokens(block.text);

    if (tokens > budgetTokens) {
      // Bloque enorme: va solo en su lote, sin consultar el presupuesto.
      flush();
      chunks.push({ blocks: [block], indices: [index], estimatedTokens: tokens });
      return;
    }

    if (currentTokens + tokens > budgetTokens) flush();

    current.push(block);
    currentIndices.push(index);
    currentTokens += tokens;
  });

  flush();
  return chunks;
}

/** Reconstruye la lista original a partir de los lotes. Sirve para los tests. */
export function flatten<T extends Chunkable>(chunks: readonly Chunk<T>[]): T[] {
  return chunks.flatMap((c) => c.blocks);
}
