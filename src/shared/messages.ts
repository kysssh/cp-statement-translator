export interface TranslateRequest {
  type: 'TRANSLATE';
  blocks: string[];
  cacheKey: string;
  /** Reintento de un bloque conflictivo: se le recuerda al modelo copiar los marcadores. */
  strict?: boolean;
}

export type TranslateResponse =
  | { ok: true; blocks: string[]; fromCache: boolean }
  | { ok: false; error: string; code?: number };
