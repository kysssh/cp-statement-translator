import { STRICT_REMINDER, SYSTEM_PROMPT } from '../../shared/prompt';
import { chunkBlocks, ensureOk, fetchWithRetry, parseBlocks } from '../../shared/llm';
import { PROVIDER_NAMES } from '../../shared/provider-names';
import type { TranslationProvider } from './types';

export const anthropic: TranslationProvider = {
  id: 'anthropic',
  label: 'Claude Haiku 4.5 (de pago, máxima calidad)',
  shortName: PROVIDER_NAMES.anthropic,
  tagline: 'La mejor calidad. De pago por uso: unos 0,01 USD por enunciado.',
  models: [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido y barato)' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (máxima calidad)' },
  ],
  defaultModel: 'claude-haiku-4-5',
  async listModels(apiKey) {
    const res = await fetchWithRetry('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    });
    await ensureOk(res, 'Anthropic');
    const data = (await res.json()) as { data: { id: string; display_name?: string }[] };
    return data.data.map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
  },
  keyUrl: 'https://console.anthropic.com/settings/keys',
  keyHint: 'Requiere saldo prepagado',
  needsKey: true,
  supportsPrompt: true,
  free: false,

  async translate(blocks, o) {
    const out: string[] = [];
    for (const chunk of chunkBlocks(blocks)) {
      const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': o.apiKey ?? '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: o.model || 'claude-haiku-4-5',
          max_tokens: 8192,
          system: SYSTEM_PROMPT + (o.strict ? STRICT_REMINDER : ''),
          messages: [{ role: 'user', content: JSON.stringify({ blocks: chunk }) }],
        }),
      });
      await ensureOk(res, 'Anthropic');
      const data = await res.json();
      const text = (data.content as { type: string; text?: string }[])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');
      out.push(...parseBlocks(text, chunk.length));
    }
    return out;
  },
};
