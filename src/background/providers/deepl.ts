import { ensureOk, fetchWithRetry } from '../../shared/llm';
import { fromDeeplXml, toDeeplXml } from '../../shared/deepl-xml';
import { translateBySegments } from '../../core/segments';
import { PROVIDER_NAMES } from '../../shared/provider-names';
import type { TranslationProvider } from './types';

// Las keys gratuitas terminan en ":fx" y usan otro host.
const baseUrl = (key: string) => (key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com');
const MAX_TEXTS_PER_REQUEST = 50;

async function call(key: string, texts: string[], tagged: boolean): Promise<string[]> {
  const res = await fetchWithRetry(`${baseUrl(key)}/v2/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `DeepL-Auth-Key ${key}` },
    body: JSON.stringify({
      text: texts,
      source_lang: 'EN',
      target_lang: 'ES',
      ...(tagged
        ? { tag_handling: 'xml', non_splitting_tags: ['g', 'x'], outline_detection: false }
        : {}),
    }),
  });
  await ensureOk(res, 'DeepL');
  const data = (await res.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => t.text);
}

/**
 * Traductor neuronal determinista. No acepta prompt ni glosario, pero `tag_handling=xml`
 * protege los marcadores mejor que ningún otro: cada ⟦n⟧ viaja como una etiqueta XML.
 * En el reintento (strict) ni siquiera se envían: se traduce solo el texto entre marcadores.
 */
export const deepl: TranslationProvider = {
  id: 'deepl',
  label: 'DeepL API (gratis hasta 500 K caracteres/mes)',
  shortName: PROVIDER_NAMES.deepl,
  tagline: 'Traducción fluida y muy fiel con las fórmulas. Sin glosario.',
  needsKey: true,
  supportsPrompt: false,
  free: true,
  keyUrl: 'https://www.deepl.com/your-account/keys',
  keyHint: 'Las keys gratuitas terminan en :fx',

  async translate(blocks, o) {
    const key = o.apiKey ?? '';
    if (o.strict) {
      const out: string[] = [];
      for (const b of blocks) {
        out.push(await translateBySegments(b, async (s) => (await call(key, [s], false))[0]));
      }
      return out;
    }

    const out: string[] = [];
    for (let i = 0; i < blocks.length; i += MAX_TEXTS_PER_REQUEST) {
      const slice = blocks.slice(i, i + MAX_TEXTS_PER_REQUEST);
      const translated = await call(key, slice.map(toDeeplXml), true);
      out.push(...translated.map(fromDeeplXml));
    }
    return out;
  },
};
