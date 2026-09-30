import { STRICT_REMINDER, SYSTEM_PROMPT } from '../../shared/prompt';
import { chunkBlocks, ensureOk, fetchWithRetry, parseBlocks } from '../../shared/llm';
import { PROVIDER_NAMES } from '../../shared/provider-names';
import type { TranslationProvider } from './types';

export const gemini: TranslationProvider = {
  id: 'gemini',
  label: 'Google Gemini (gratis, requiere key)',
  shortName: PROVIDER_NAMES.gemini,
  tagline: 'LLM de Google con plan gratuito. Aplica el glosario. Las peticiones gratuitas pueden usarse para entrenar.',
  models: [{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }],
  defaultModel: 'gemini-3.8-flash',
  async listModels(apiKey) {
    const res = await fetchWithRetry('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': apiKey },
    });
    await ensureOk(res, 'Gemini');
    const data = (await res.json()) as { models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
    return data.models
      .filter((m) => m.name.startsWith('models/gemini') && m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => ({ id: m.name.replace('models/', ''), label: m.displayName ?? m.name }))
      .sort((a, b) => b.id.localeCompare(a.id));
  },
  keyUrl: 'https://aistudio.google.com/apikey',
  keyHint: 'Se obtiene en Google AI Studio',
  needsKey: true,
  supportsPrompt: true,
  free: true,

  async translate(blocks, o) {
    const model = o.model || 'gemini-3.8-flash';
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
