import { STRICT_REMINDER, SYSTEM_PROMPT } from '../../shared/prompt';
import { chunkBlocks, ensureOk, fetchWithRetry, parseBlocks } from '../../shared/llm';
import type { TranslationProvider } from './types';

export const gemini: TranslationProvider = {
  id: 'gemini',
  label: 'Google Gemini (gratis, requiere key)',
  needsKey: true,
  supportsPrompt: true,
  free: true,

  async translate(blocks, o) {
    const model = o.model || 'gemini-2.5-flash';
    const out: string[] = [];
    for (const chunk of chunkBlocks(blocks)) {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey ?? '' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT + (o.strict ? STRICT_REMINDER : '') }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify({ blocks: chunk }) }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
        },
      );
      await ensureOk(res, 'Gemini');
      const data = await res.json();
      out.push(...parseBlocks(data.candidates[0].content.parts[0].text, chunk.length));
    }
    return out;
  },
};
