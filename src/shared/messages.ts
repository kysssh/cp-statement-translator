export interface TranslateRequest {
  type: 'TRANSLATE';
  blocks: string[];
  cacheKey: string;
  /** Reintento de un bloque conflictivo: se le recuerda al modelo copiar los marcadores. */
  strict?: boolean;
}

/**
 * Petición de un único lote desde la cola del content script (T40).
 * El service worker traduce el lote y devuelve el resultado + cuota.
 */
export interface TranslateDocBatchRequest {
  type: 'TRANSLATE_DOC_BATCH';
  blocks: string[];
  strict?: boolean;
}

export interface OpenOptionsRequest {
  type: 'OPEN_OPTIONS';
}

import type { RateLimitSnapshot } from './rate-limit';

export type TranslateResponse =
  | { ok: true; blocks: string[]; fromCache: boolean }
  | { ok: false; error: string; code?: number };

/**
 * Respuesta al TRANSLATE_DOC_BATCH: incluye la cuota restante para que la cola
 * del content script (TranslationQueue) pueda planificar los siguientes lotes.
 */
export type TranslateDocBatchResponse =
  | {
      ok: true;
      blocks: string[];
      /** Cuota restante de Groq para que la cola planifique el siguiente lote. */
      rateLimit?: RateLimitSnapshot;
      retryAfterMs?: number | null;
    }
  | { ok: false; error: string; retryAfterMs?: number | null };

