import { describe, expect, it } from 'vitest';
import { parseDurationMs, readRateLimit, readRetryAfterMs, hasRoomFor, waitFor } from '../src/shared/rate-limit';
import { TranslationQueue, type BatchResult } from '../src/content/queue';
import { EMPTY_RATE_LIMIT, type RateLimitSnapshot } from '../src/shared/rate-limit';

const h = (obj: Record<string, string>) => new Headers(obj);

describe('parseDurationMs', () => {
  it('lee segundos pelados', () => {
    expect(parseDurationMs('7')).toBe(7000);
    expect(parseDurationMs('7.66')).toBe(7660);
  });

  it('lee el formato de Groq (h/m/s)', () => {
    expect(parseDurationMs('2m59.56s')).toBe(179560);
    expect(parseDurationMs('1h0m0s')).toBe(3600000);
    expect(parseDurationMs('1m0s')).toBe(60000);
  });

  it('devuelve null si no es una duración', () => {
    expect(parseDurationMs(null)).toBeNull();
    expect(parseDurationMs('')).toBeNull();
    expect(parseDurationMs('pronto')).toBeNull();
  });
});

describe('readRateLimit', () => {
  it('lee las seis cabeceras de Groq', () => {
    const s = readRateLimit(
      h({
        'x-ratelimit-limit-requests': '1000',
        'x-ratelimit-remaining-requests': '997',
        'x-ratelimit-reset-requests': '2m59.56s',
        'x-ratelimit-limit-tokens': '8000',
        'x-ratelimit-remaining-tokens': '6123',
        'x-ratelimit-reset-tokens': '7.66s',
      }),
    );
    expect(s.limitRequests).toBe(1000);
    expect(s.remainingRequests).toBe(997);
    expect(s.resetRequestsMs).toBe(179560);
    expect(s.limitTokens).toBe(8000);
    expect(s.remainingTokens).toBe(6123);
    expect(s.resetTokensMs).toBe(7660);
  });

  it('todo null si no viene ninguna', () => {
    expect(readRateLimit(h({}))).toEqual(EMPTY_RATE_LIMIT);
  });

  it('los valores no numéricos se ignoran en vez de romper', () => {
    const s = readRateLimit(h({ 'x-ratelimit-remaining-tokens': 'muchos' }));
    expect(s.remainingTokens).toBeNull();
  });

  it('retry-after solo se lee cuando viene (Groq solo lo manda en 429)', () => {
    expect(readRetryAfterMs(h({}))).toBeNull();
    expect(readRetryAfterMs(h({ 'retry-after': '3' }))).toBe(3000);
  });
});

describe('hasRoomFor / waitFor', () => {
  const snap = (p: Partial<RateLimitSnapshot>): RateLimitSnapshot => ({ ...EMPTY_RATE_LIMIT, ...p });

  it('sin cabeceras se supone que cabe (para no bloquear la cola)', () => {
    expect(hasRoomFor(EMPTY_RATE_LIMIT, 100000)).toBe(true);
  });

  it('con cuota restante se comporta según el margen', () => {
    expect(hasRoomFor(snap({ remainingTokens: 8000 }), 1000)).toBe(true);
    expect(hasRoomFor(snap({ remainingTokens: 8000 }), 7000)).toBe(false); // 7000*1.15 > 8000
  });

  it('la espera es la del reinicio más próximo', () => {
    expect(waitFor(snap({ resetTokensMs: 7000 }))).toBe(7000);
    expect(waitFor(snap({ resetTokensMs: 7000, resetRequestsMs: 200000 }))).toBe(7000);
    expect(waitFor(EMPTY_RATE_LIMIT)).toBe(0);
  });
});

describe('TranslationQueue', () => {
  const lotes = Array.from({ length: 10 }, (_, i) => [`bloque ${i}`]);

  it('envía los 10 lotes uno a uno, en orden, sin saltar ninguno', async () => {
    const enviados: string[][] = [];
    const recibidos: number[] = [];
    const q = new TranslationQueue(
      lotes,
      lotes.map(() => 100),
      {
        onBatch: (i, total, tr) => {
          recibidos.push(i);
          expect(total).toBe(10);
          expect(tr).toEqual([`es-${tr.length}`]);
        },
      },
      {
        sleep: async () => {},
        onSend: async (b) => {
          enviados.push(b);
          return { ok: true, blocks: b.map(() => 'es-1') };
        },
      },
    );
    await q.run();
    expect(enviados).toHaveLength(10);
    expect(recibidos).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('un 429 provoca espera y reintento del mismo lote, sin perderlo', async () => {
    const esperas: number[] = [];
    const enviados: string[][] = [];
    let intentos = 0;
    const q = new TranslationQueue(
      lotes,
      lotes.map(() => 100),
      { onWaiting: (ms) => esperas.push(ms) },
      {
        maxAttempts: 3,
        sleep: async (ms) => {
          esperas.push(ms);
        },
        onSend: async (b) => {
          enviados.push(b);
          intentos++;
          if (intentos === 1) return { ok: false, error: '429', retryAfterMs: 5000 };
          return { ok: true, blocks: b.map(() => 'ok') };
        },
      },
    );
    await q.run();
    // el primer lote se intentó 2 veces; el resto, 1
    expect(enviados).toHaveLength(11);
    expect(enviados[0]).toEqual(enviados[1]);
    expect(esperas).toContain(5000); // usó la cabecera, no el backoff
    expect(esperas).toHaveLength(2); // una espera real + la del onWaiting
  });

  it('superar el máximo de intentos produce un error claro y para la cola', async () => {
    const errores: string[] = [];
    const enviados: string[][] = [];
    const q = new TranslationQueue(
      lotes,
      lotes.map(() => 100),
      { onError: (m) => errores.push(m) },
      {
        maxAttempts: 2,
        sleep: async () => {},
        onSend: async (b) => {
          enviados.push(b);
          return { ok: false, error: 'Cuota agotada', retryAfterMs: 1000 };
        },
      },
    );
    await q.run();
    expect(errores).toEqual(['Cuota agotada']);
    expect(enviados).toHaveLength(3); // intento 1 + 2 reintentos, y para
  });

  it('un error que NO es 429 no se reintenta', async () => {
    const errores: string[] = [];
    const enviados: string[][] = [];
    const q = new TranslationQueue(
      lotes,
      lotes.map(() => 100),
      { onError: (m) => errores.push(m) },
      {
        sleep: async () => {},
        onSend: async (b) => {
          enviados.push(b);
          return { ok: false, error: 'API key inválida' }; // sin retryAfterMs
        },
      },
    );
    await q.run();
    expect(enviados).toHaveLength(1);
    expect(errores).toEqual(['API key inválida']);
  });

  it('espera por cuota antes de enviar si no cabe', async () => {
    const esperas: number[] = [];
    const enviados: string[][] = [];
    const q = new TranslationQueue(
      lotes,
      lotes.map(() => 3000), // pide 3000 + 500 de prompt
      { onWaiting: (ms, r) => { esperas.push(ms); expect(r).toBe('quota'); } },
      {
        promptTokens: 500,
        sleep: async () => {},
        onSend: async (b) => {
          enviados.push(b);
          // tras el primer envío la cuota queda justa para el segundo
          return {
            ok: true,
            blocks: b.map(() => 'ok'),
            rateLimit: { ...EMPTY_RATE_LIMIT, remainingTokens: 3200, resetTokensMs: 9000 },
          };
        },
      },
    );
    // Cuota inicial casi vacía -> la primera espera también debería ocurrir
    Object.defineProperty(q, 'rateLimit', { value: { ...EMPTY_RATE_LIMIT, remainingTokens: 100, resetTokensMs: 5000 }, writable: true });
    await q.run();
    expect(esperas).toContain(5000);
    expect(esperas).toContain(9000);
    expect(enviados).toHaveLength(10);
  });

  it('cancelar a mitad deja lo ya traducido y no envía el resto', async () => {
    const recibidos: number[] = [];
    const enviados: string[][] = [];
    const q = new TranslationQueue(
      lotes,
      lotes.map(() => 100),
      { onBatch: (i) => { recibidos.push(i); if (i === 2) q.cancel(); } },
      {
        sleep: async () => {},
        onSend: async (b) => { enviados.push(b); return { ok: true, blocks: b.map(() => 'ok') }; },
      },
    );
    await q.run();
    expect(recibidos).toEqual([0, 1, 2]);
    expect(enviados).toHaveLength(3);
    expect(q.isCancelled).toBe(true);
  });

  it('cancelar antes de empezar no envía nada', async () => {
    let enviados = 0;
    const q = new TranslationQueue(lotes, lotes.map(() => 100), {}, {
      sleep: async () => {},
      onSend: async () => { enviados++; return { ok: true, blocks: [] }; },
    });
    q.cancel();
    await q.run();
    expect(enviados).toBe(0);
  });

  it('aplica cada lote al llegar, no al final', async () => {
    const orden: string[] = [];
    let loteActual = 0;
    const q = new TranslationQueue(
      lotes,
      lotes.map(() => 100),
      { onBatch: (i) => orden.push(`aplicado-${i}`) },
      {
        sleep: async () => {},
        onSend: async (b) => {
          orden.push(`enviado-${loteActual}`);
          loteActual++;
          return { ok: true, blocks: b.map(() => 'ok') } as BatchResult;
        },
      },
    );
    await q.run();
    // cada envío va seguido de su aplicación, sin agrupar al final
    expect(orden).toEqual(Array.from({ length: 10 }, (_, i) => [`enviado-${i}`, `aplicado-${i}`]).flat());
  });
});
