import { STRICT_REMINDER, SYSTEM_PROMPT } from '../../shared/prompt';
import { chunkBlocks, ensureOk, fetchWithRetry, parseBlocks } from '../../shared/llm';
import type { TranslationProvider } from './types';

export const anthropic: TranslationProvider = {
  id: 'anthropic',
  label: 'Claude Haiku 4.5 (de pago, máxima calidad)',
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
          temperature: 0,
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
