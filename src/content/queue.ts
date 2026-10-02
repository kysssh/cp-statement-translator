import {
  EMPTY_RATE_LIMIT,
  hasRoomFor,
  readRateLimit,
  readRetryAfterMs,
  waitFor,
  type RateLimitSnapshot,
} from '../shared/rate-limit';

/** Envía un lote al service worker, que es quien tiene la key y hace el fetch. */
export type BatchSender = (blocks: string[]) => Promise<BatchResult>;

export interface BatchResult {
  ok: boolean;
  blocks?: string[];
  error?: string;
  /** 429 con la cabecera de espera, si la hubo. */
  retryAfterMs?: number | null;
  rateLimit?: RateLimitSnapshot;
}

export interface QueueOptions {
  /** Tokens estimados del prompt del sistema, para no pasar el límite por arriba. */
  promptTokens?: number;
  /** Margen de seguridad sobre la cuota restante (1,15 = 15 %). */
  safety?: number;
  /** Reintentos por lote antes de rendirse. */
  maxAttempts?: number;
  /** Espera inicial si no hay cabecera que la indique. */
  backoffBaseMs?: number;
  /** Inyectable para los tests: si no se pasa, usa temporizadores reales. */
  sleep?: (ms: number) => Promise<void>;
  /** Inyectable para los tests: sólo notifica; no manda nada. */
  onSend?: BatchSender;
}

export interface QueueEvents {
  /** Un lote terminó bien. */
  onBatch?: (index: number, total: number, translations: string[]) => void;
  /** Antes de dormir por cuota o 429. */
  onWaiting?: (ms: number, reason: 'quota' | 'rate-limit') => void;
  /** La cola se quedó sin reintentos. */
  onError?: (message: string, batchIndex: number) => void;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Cola que envía los lotes uno a uno respetando el límite de tasa de Groq.
 *
 * Vive en el CONTENT SCRIPT a propósito: en MV3 el service worker se detiene tras
 * un rato sin actividad, y una cola que espere decenas de segundos dentro de él
 * puede morir a mitad. El content script sigue vivo mientras la pestaña esté
 * abierta; el service worker queda sin estado (recibe un lote, responde).
 */
export class TranslationQueue {
  private cancelled = false;
  private rateLimit: RateLimitSnapshot = EMPTY_RATE_LIMIT;
  private readonly batches: readonly string[][];
  private readonly estimatedTokensPerBatch: readonly number[];
  private readonly events: QueueEvents;
  private readonly options: QueueOptions;

  constructor(batches: readonly string[][], estimatedTokensPerBatch: readonly number[], events: QueueEvents = {}, options: QueueOptions = {}) {
    this.batches = batches;
    this.estimatedTokensPerBatch = estimatedTokensPerBatch;
    this.events = events;
    this.options = options;
  }

  get quota(): RateLimitSnapshot {
    return this.rateLimit;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Ejecuta la cola. Aplica cada lote en cuanto llega (no al final) para que el
   * usuario vea avanzar la traducción. Lo ya traducido se conserva si se cancela.
   */
  async run(): Promise<void> {
    const {
      promptTokens = 0,
      safety = 1.15,
      maxAttempts = 3,
      backoffBaseMs = 4000,
      sleep = realSleep,
      onSend,
    } = this.options;
    const send = onSend ?? this.defaultSender();
    const total = this.batches.length;

    for (let i = 0; i < total; i++) {
      if (this.cancelled) return;

      const batch = this.batches[i];
      const needed = (this.estimatedTokensPerBatch[i] ?? 0) + promptTokens;

      // 1. ¿Cabe en la cuota restante? Si no, dormir hasta el reinicio.
      if (!hasRoomFor(this.rateLimit, needed, safety)) {
        const wait = waitFor(this.rateLimit);
        if (wait > 0) {
          this.events.onWaiting?.(wait, 'quota');
          await sleep(wait);
        }
        if (this.cancelled) return;
      }

      // 2. Enviar, con reintentos ante 429.
      let attempt = 0;
      for (;;) {
        if (this.cancelled) return;
        const result = await send(batch);
        if (result.rateLimit) this.rateLimit = result.rateLimit;

        if (result.ok) {
          this.events.onBatch?.(i, total, result.blocks ?? []);
          break;
        }

        const isRateLimit = result.retryAfterMs !== undefined && result.retryAfterMs !== null;
        const last = attempt >= maxAttempts;
        if (!isRateLimit || last) {
          this.events.onError?.(result.error ?? 'Error desconocido.', i);
          return;
        }

        // La cabecera manda; si no viene, backoff exponencial con un poco de jitter.
        const wait = result.retryAfterMs || backoffBaseMs * 2 ** attempt + Math.random() * 500;
        this.events.onWaiting?.(wait, 'rate-limit');
        await sleep(wait);
        attempt++;
      }
    }
  }

  /** El content script no tiene la key: delega en el service worker. */
  private defaultSender(): BatchSender {
    return async (blocks) => {
      const res = await chrome.runtime.sendMessage({ type: 'TRANSLATE_DOC_BATCH', blocks });
      return res as BatchResult;
    };
  }
}

/** Extrae la cuota y el retry-after de una respuesta HTTP, para los tests. */
export function quotaFromResponse(res: Response): { rateLimit: RateLimitSnapshot; retryAfterMs: number | null } {
  return { rateLimit: readRateLimit(res.headers), retryAfterMs: readRetryAfterMs(res.headers) };
}
