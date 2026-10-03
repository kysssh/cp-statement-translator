import { getSettings } from '../shared/settings';
import { PROVIDERS, DEFAULT_PROVIDER } from './providers';
import { HttpError } from '../shared/llm';
import type {
  OpenOptionsRequest,
  TranslateRequest,
  TranslateResponse,
  TranslateDocBatchRequest,
  TranslateDocBatchResponse,
} from '../shared/messages';
import { groq } from './providers/groq';
import { DOC_SYSTEM_PROMPT, DOC_STRICT_REMINDER } from '../shared/doc-prompt';

// Único contexto que ve las API keys y hace peticiones de red.
chrome.runtime.onMessage.addListener(
  (msg: TranslateRequest | TranslateDocBatchRequest | OpenOptionsRequest, _sender, sendResponse) => {
    if (msg?.type === 'OPEN_OPTIONS') {
      void chrome.runtime.openOptionsPage();
      return;
    }

    if (msg?.type === 'TRANSLATE_DOC_BATCH') {
      handleDocBatch(msg)
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ ok: false, error: String(e?.message ?? e) } satisfies TranslateDocBatchResponse));
      return true;
    }

    if (msg?.type !== 'TRANSLATE') return;

    handle(msg)
      .then((blocks) => sendResponse({ ok: true, blocks, fromCache: false } satisfies TranslateResponse))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: String(e?.message ?? e),
          code: e instanceof HttpError ? e.status : undefined,
        } satisfies TranslateResponse),
      );

    return true; // mantiene abierto el canal para la respuesta asíncrona
  },
);

async function handleDocBatch(msg: TranslateDocBatchRequest): Promise<TranslateDocBatchResponse> {
  const s = await getSettings();

  // El traductor local no admite glosario ni lotes: forzamos Groq.
  if (!groq.needsKey || s.provider !== 'groq') {
    if (s.provider !== 'groq') {
      return {
        ok: false,
        error:
          'La traducción de documentos requiere Groq (plan gratuito, sin tarjeta). ' +
          'Configura tu API key en Opciones.',
      };
    }
  }

  const apiKey = s.keys['groq'];
  if (!apiKey) {
    return {
      ok: false,
      error: 'Groq necesita una API key para traducir documentos. Configúrala en Opciones.',
    };
  }

  try {
    const result = await groq.translateBatch!(msg.blocks, {
      apiKey,
      model: s.models['groq'],
      strict: msg.strict,
      systemPrompt: DOC_SYSTEM_PROMPT + (msg.strict ? DOC_STRICT_REMINDER : ''),
    });
    return {
      ok: true,
      blocks: result.blocks,
      rateLimit: result.quota,
      retryAfterMs: result.retryAfterMs,
    };
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return {
      ok: false,
      error: String(err.message ?? e),
      retryAfterMs: err.status === 429 ? 0 : undefined,
    };
  }
}

async function handle(msg: TranslateRequest): Promise<string[]> {
  const s = await getSettings();
  const engine = PROVIDERS[s.provider] ?? PROVIDERS[DEFAULT_PROVIDER];

  if (engine.id === 'chrome-builtin') {
    throw new Error('El traductor local se ejecuta en la página, no en el service worker.');
  }
  const apiKey = s.keys[engine.id];
  if (engine.needsKey && !apiKey) {
    throw new Error(`"${engine.label}" necesita una API key. Configúrala en Opciones.`);
  }
  return engine.translate(msg.blocks, { apiKey, model: s.models[engine.id], strict: msg.strict });
}

