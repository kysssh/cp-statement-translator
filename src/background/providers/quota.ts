import type { ProviderOptions } from './types';

/** Lo que devuelve un proveedor cuando además reporta la cuota consumida. */
export interface QuotaReport {
  remainingTokens: number | null;
  remainingRequests: number | null;
  resetTokensMs: number | null;
  resetRequestsMs: number | null;
}

/** Traduce un único lote y devuelve la cuota que queda. */
export interface BatchTranslator {
  (blocks: string[], o: ProviderOptions): Promise<{
    blocks: string[];
    quota: QuotaReport;
    /** Solo viene en 429; si no, null. */
    retryAfterMs: number | null;
  }>;
}
