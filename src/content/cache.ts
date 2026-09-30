import { fnv1a } from '../core/hash';
import type { BlockCache } from '../core/pipeline';

const INDEX_KEY = 'cpt:index';
const MAX_ENTRIES = 200;

/**
 * Caché de traducciones ya validadas. La clave incluye juez+problema, proveedor
 * y el hash del texto fuente: si el enunciado cambia o se cambia de proveedor,
 * la entrada deja de coincidir sola.
 */
export function storageCache(problemKey: string, provider: string): BlockCache {
  const keyFor = (texts: string[]) => `cpt:${problemKey}:${provider}:${fnv1a(texts.join('\u0000'))}`;

  return {
    async load(texts) {
      try {
        const key = keyFor(texts);
        const got = await chrome.storage.local.get(key);
        const v = got[key];
        return Array.isArray(v) && v.length === texts.length ? (v as string[]) : null;
      } catch {
        return null;
      }
    },
    async save(texts, outs) {
      try {
        const key = keyFor(texts);
        const { [INDEX_KEY]: idx } = await chrome.storage.local.get(INDEX_KEY);
        const index: string[] = Array.isArray(idx) ? idx.filter((k) => k !== key) : [];
        index.push(key);
        const evicted = index.splice(0, Math.max(0, index.length - MAX_ENTRIES));
        if (evicted.length) await chrome.storage.local.remove(evicted);
        await chrome.storage.local.set({ [key]: outs, [INDEX_KEY]: index });
      } catch {
        /* la caché es opcional */
      }
    },
  };
}
