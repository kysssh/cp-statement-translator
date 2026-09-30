import { STRICT_REMINDER, SYSTEM_PROMPT } from '../../shared/prompt';
import { chunkBlocks, ensureOk, fetchWithRetry, parseBlocks } from '../../shared/llm';
import type { TranslationProvider } from './types';

// API compatible con OpenAI: sirve para otros servicios cambiando URL y modelo.
export const groq: TranslationProvider = {
  id: 'groq',
  label: 'Groq (gratis, requiere key)',
  needsKey: true,
  supportsPrompt: true,
  free: true,

  async translate(blocks, o) {
    const out: string[] = [];
    for (const chunk of chunkBlocks(blocks)) {
      const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${o.apiKey}` },
        body: JSON.stringify({
          model: o.model || 'openai/gpt-oss-120b',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT + (o.strict ? STRICT_REMINDER : '') },
            { role: 'user', content: JSON.stringify({ blocks: chunk }) },
          ],
        }),
      });
      await ensureOk(res, 'Groq');
      const data = await res.json();
      out.push(...parseBlocks(data.choices[0].message.content, chunk.length));
    }
    return out;
  },
};
