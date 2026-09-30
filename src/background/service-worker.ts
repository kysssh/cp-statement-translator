import { getSettings } from '../shared/settings';
import { PROVIDERS, DEFAULT_PROVIDER } from './providers';
import { HttpError } from '../shared/llm';
import type { OpenOptionsRequest, TranslateRequest, TranslateResponse } from '../shared/messages';

// Único contexto que ve las API keys y hace peticiones de red.
chrome.runtime.onMessage.addListener(
  (msg: TranslateRequest | OpenOptionsRequest, _sender, sendResponse: (r: TranslateResponse) => void) => {
    if (msg?.type === 'OPEN_OPTIONS') {
      void chrome.runtime.openOptionsPage();
      return;
    }
    if (msg?.type !== 'TRANSLATE') return;

    handle(msg)
      .then((blocks) => sendResponse({ ok: true, blocks, fromCache: false }))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: String(e?.message ?? e),
          code: e instanceof HttpError ? e.status : undefined,
        }),
      );

    return true; // mantiene abierto el canal para la respuesta asíncrona
  },
);

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
