import { translateBySegments } from '../../core/segments';
import type { TranslationProvider } from './types';

const CFG = { sourceLanguage: 'en', targetLanguage: 'es' } as const;

let cached: Translator | null = null;

async function getTranslator(onProgress?: (m: string) => void): Promise<Translator> {
  if (cached) return cached;
  if (!('Translator' in self)) {
    throw new Error('Este navegador no expone el traductor local. Configura otro proveedor en Opciones.');
  }
  const estado = await Translator.availability(CFG);
  if (estado === 'unavailable') {
    throw new Error('El traductor local no está disponible para EN→ES en este navegador. Configura otro proveedor en Opciones.');
  }
  if (estado !== 'available') onProgress?.('Descargando el paquete de idioma (solo la primera vez)…');
  cached = await Translator.create({
    ...CFG,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) =>
        onProgress?.(`Descargando modelo: ${Math.round(((e as unknown as { loaded: number }).loaded ?? 0) * 100)}%`),
      );
    },
  });
  return cached;
}

/**
 * Traductor on-device de Chromium (138+). Se ejecuta en el content script:
 * la API está expuesta a `window`, y el clic del usuario cuenta como activación
 * para la descarga del modelo. No usa red ni claves.
 *
 * `strict` = modo aislado: los marcadores ⟦n⟧ nunca llegan al traductor.
 */
export const chromeBuiltin: TranslationProvider = {
  id: 'chrome-builtin',
  label: 'Traductor del navegador (local, gratis)',
  needsKey: false,
  supportsPrompt: false,
  free: true,

  async isAvailable() {
    if (!('Translator' in self)) return false;
    return (await Translator.availability(CFG)) !== 'unavailable';
  },

  async translate(blocks, o, onProgress) {
    const t = await getTranslator(onProgress);
    const out: string[] = [];
    for (const b of blocks) {
      out.push(o.strict ? await translateBySegments(b, (s) => t.translate(s)) : await t.translate(b));
    }
    return out;
  },
};
