/**
 * Cuota de Groq leída de las cabeceras de respuesta (T36).
 *
 * Groq devuelve el estado del límite en cada respuesta, no solo al fallar:
 *   x-ratelimit-limit-requests     peticiones por día permitidas
 *   x-ratelimit-remaining-requests  peticiones por día restantes
 *   x-ratelimit-reset-requests      tiempo hasta el reinicio diario ("2m59.56s")
 *   x-ratelimit-limit-tokens        tokens por minuto permitidos
 *   x-ratelimit-remaining-tokens   tokens por minuto restantes
 *   x-ratelimit-reset-tokens       tiempo hasta el reinicio por minuto ("7.66s")
 *   retry-after                     segundos a esperar; SOLO en respuestas 429
 *
 * Las cabeceras de requests describen peticiones/día y las de tokens, tokens/minuto.
 * Groq también aplica límites de tokens/día, que no se exponen en estas cabeceras.
 * Consulta los límites de la cuenta para el modelo elegido.
 *
 * Los tokens en caché no cuentan para el límite, así que si el prompt del sistema
 * va primero y es idéntico en cada llamada, el consumo real puede ser menor.
 *
 * Fuente: https://console.groq.com/docs/rate-limits
 */

export interface RateLimitSnapshot {
  /** Tokens por minuto que quedan. `null` si la cabecera no vino. */
  remainingTokens: number | null;
  /** Tokens por minuto permitidos. */
  limitTokens: number | null;
  /** Milisegundos hasta el reinicio del límite por minuto. */
  resetTokensMs: number | null;
  /** Peticiones por día que quedan. */
  remainingRequests: number | null;
  /** Peticiones por día permitidas. */
  limitRequests: number | null;
  /** Milisegundos hasta el reinicio del límite diario. */
  resetRequestsMs: number | null;
}

export const EMPTY_RATE_LIMIT: RateLimitSnapshot = {
  remainingTokens: null,
  limitTokens: null,
  resetTokensMs: null,
  remainingRequests: null,
  limitRequests: null,
  resetRequestsMs: null,
};

const num = (v: string | null): number | null => {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Convierte el formato de duración de Groq ("7.66s", "2m59.56s", "1h0m0s") a ms.
 * Devuelve null si no parece una duración.
 */
export function parseDurationMs(raw: string | null): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000); // segundos pelados
  const re = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/;
  const m = re.exec(s);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const [, h, min, sec] = m;
  return (Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(sec ?? 0)) * 1000;
}

/** Lee la cuota de una respuesta. Todas las claves son opcionales. */
export function readRateLimit(headers: Headers): RateLimitSnapshot {
  return {
    remainingTokens: num(headers.get('x-ratelimit-remaining-tokens')),
    limitTokens: num(headers.get('x-ratelimit-limit-tokens')),
    resetTokensMs: parseDurationMs(headers.get('x-ratelimit-reset-tokens')),
    remainingRequests: num(headers.get('x-ratelimit-remaining-requests')),
    limitRequests: num(headers.get('x-ratelimit-limit-requests')),
    resetRequestsMs: parseDurationMs(headers.get('x-ratelimit-reset-requests')),
  };
}

/** Cuánto esperar tras un 429: la cabecera si viene, si no null. */
export function readRetryAfterMs(headers: Headers): number | null {
  return parseDurationMs(headers.get('retry-after'));
}

/**
 * ¿Cabe `needed` tokens en la cuota restante?
 * Sin cabeceras no se puede saber, así que se supone que sí (de lo contrario la
 * cola se bloquearía sola con proveedores que no las envían).
 */
export function hasRoomFor(snapshot: RateLimitSnapshot, needed: number, safety = 1.15): boolean {
  if (snapshot.remainingTokens === null) return true;
  return snapshot.remainingTokens >= needed * safety;
}

/** Espera a que se libere la cuota: devuelve los ms que hay que dormir. */
export function waitFor(snapshot: RateLimitSnapshot): number {
  const candidates = [snapshot.resetTokensMs, snapshot.resetRequestsMs].filter(
    (v): v is number => typeof v === 'number' && v > 0,
  );
  if (!candidates.length) return 0;
  return Math.min(...candidates);
}
