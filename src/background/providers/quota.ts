import type { ProviderOptions } from './types';
import type { RateLimitSnapshot } from '../../shared/rate-limit';

/** Lo que devuelve un proveedor cuando además reporta la cuota consumida. */
export type QuotaReport = RateLimitSnapshot;

/** Opciones extendidas para traducción por lotes (admite prompt personalizado). */
export interface BatchOptions extends ProviderOptions {
  /** Prompt del sistema completo. Si no se pasa, el proveedor usa su default. */
  systemPrompt?: string;
}

/** Traduce un único lote y devuelve la cuota que queda. */
export interface BatchTranslator {
  (blocks: string[], o: BatchOptions): Promise<{
    blocks: string[];
    quota: QuotaReport;
    /** Solo viene en 429; si no, null. */
    retryAfterMs: number | null;
  }>;
}

