/** Parte los bloques en lotes de como máximo `maxChars` caracteres (un bloque nunca se parte). */
export function chunkBlocks(blocks: string[], maxChars = 6000): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const b of blocks) {
    if (cur.length && size + b.length > maxChars) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += b.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Extrae `blocks` de la respuesta del modelo, tolerando backticks y texto alrededor. */
export function parseBlocks(raw: string, expected: number): string[] {
  const clean = raw.replace(/```(?:json)?/gi, '').trim();
  const start = Math.min(...['{', '['].map((c) => clean.indexOf(c)).filter((i) => i >= 0));
  let data: unknown;
  try {
    data = JSON.parse(clean.slice(Number.isFinite(start) ? start : 0));
  } catch {
    throw new Error('La respuesta del modelo no es JSON válido.');
  }
  const arr = Array.isArray(data) ? data : (data as { blocks?: unknown })?.blocks;
  if (!Array.isArray(arr) || arr.length !== expected || !arr.every((x) => typeof x === 'string')) {
    throw new Error('La respuesta no coincide con el número de bloques enviados.');
  }
  return arr as string[];
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** fetch con backoff exponencial para 429 y 5xx. */
export async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) return res;
    const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, Math.min(wait, 8000)));
  }
}

export async function ensureOk(res: Response, name: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401 || res.status === 403) throw new HttpError(res.status, `${name}: API key inválida o sin permiso.`);
  if (res.status === 429) throw new HttpError(429, `${name}: cuota agotada. Reintenta más tarde o cambia de proveedor en Opciones.`);
  throw new HttpError(res.status, `${name} ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
