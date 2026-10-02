import { STRICT_REMINDER, SYSTEM_PROMPT } from '../../shared/prompt';
import { chunkBlocks, ensureOk, fetchWithRetry, parseBlocks } from '../../shared/llm';
import { PROVIDER_NAMES } from '../../shared/provider-names';
import { readRateLimit, readRetryAfterMs } from '../../shared/rate-limit';
import type { QuotaReport } from './quota';
import type { TranslationProvider } from './types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface BatchTranslation {
  blocks: string[];
  quota: QuotaReport;
  /** Solo viene en 429; si no, null. */
  retryAfterMs: number | null;
}

/**
 * Traduce un único lote y devuelve la cuota que queda, leída de las cabeceras.
 *
 * Es lo que consume la cola del content script (T36): un lote por llamada, sin
 * estado entre peticiones, porque el service worker de MV3 se puede detener.
 */
async function translateBatch(blocks: string[], o: { apiKey?: string; model?: string; strict?: boolean }): Promise<BatchTranslation> {
  const model = o.model || 'openai/gpt-oss-120b';
  const send = (jsonMode: boolean) =>
    fetchWithRetry(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${o.apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: 8192,
        // Los modelos GPT-OSS razonan antes de responder; con esfuerzo bajo no agotan el presupuesto.
        ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + (o.strict ? STRICT_REMINDER : '') },
          { role: 'user', content: JSON.stringify({ blocks }) },
        ],
      }),
    });

  let res = await send(true);
  // El modo JSON estricto rechaza salidas vacías o con formato raro: sin él, parseBlocks es tolerante.
  if (res.status === 400 && (await res.clone().text()).includes('json_validate_failed')) res = await send(false);

  const quota = readRateLimit(res.headers);
  const retryAfterMs = readRetryAfterMs(res.headers);
  if (res.status === 429) {
    const err = new Error('Groq: cuota agotada (429).') as Error & { status?: number };
    err.status = 429;
    throw err;
  }

  await ensureOk(res, 'Groq');
  const data = await res.json();
  return {
    blocks: parseBlocks(data.choices[0].message.content ?? '', blocks.length),
    quota: {
      remainingTokens: quota.remainingTokens,
      remainingRequests: quota.remainingRequests,
      resetTokensMs: quota.resetTokensMs,
      resetRequestsMs: quota.resetRequestsMs,
    },
    retryAfterMs,
  };
}

// API compatible con OpenAI: sirve para otros servicios cambiando URL y modelo.
export const groq: TranslationProvider = {
  id: 'groq',
  label: 'Groq (gratis, requiere key)',
  shortName: PROVIDER_NAMES.groq,
  tagline: 'LLM rápido y gratuito. Respeta el glosario de programación competitiva.',
  models: [
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (mejor calidad)' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (más rápido)' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  ],
  defaultModel: 'openai/gpt-oss-120b',
  async listModels(apiKey) {
    const res = await fetchWithRetry('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${apiKey}` } });
    await ensureOk(res, 'Groq');
    const data = (await res.json()) as { data: { id: string }[] };
    return data.data
      .filter((m) => !/whisper|guard|tts|orpheus|playai/i.test(m.id))
      .map((m) => ({ id: m.id, label: m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
  },
  keyUrl: 'https://console.groq.com/keys',
  keyHint: 'Sin tarjeta de crédito',
  needsKey: true,
  supportsPrompt: true,
  free: true,
  translateBatch,

  async translate(blocks, o) {
    const model = o.model || 'openai/gpt-oss-120b';
    const out: string[] = [];

    for (const chunk of chunkBlocks(blocks)) {
      const send = (jsonMode: boolean) =>
        fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${o.apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_completion_tokens: 8192,
            // Los modelos GPT-OSS razonan antes de responder; con esfuerzo bajo no agotan el presupuesto.
            ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
            messages: [
              { role: 'system', content: SYSTEM_PROMPT + (o.strict ? STRICT_REMINDER : '') },
              { role: 'user', content: JSON.stringify({ blocks: chunk }) },
            ],
          }),
        });

      let res = await send(true);
      // El modo JSON estricto rechaza salidas vacías o con formato raro: sin él, parseBlocks es tolerante.
      if (res.status === 400 && (await res.clone().text()).includes('json_validate_failed')) res = await send(false);

      await ensureOk(res, 'Groq');
      const data = await res.json();
      out.push(...parseBlocks(data.choices[0].message.content ?? '', chunk.length));
    }
    return out;
  },
};
