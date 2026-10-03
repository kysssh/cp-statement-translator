import { fnv1a } from '../core/hash';

/**
 * Caché por bloque individual para documentos largos (T38).
 *
 * A diferencia de storageCache() (que cachea el problema completo),
 * esta guarda cada bloque por separado. Con 200 000 tokens/día, permite
 * revisitar documentos sin gastar cuota en bloques ya traducidos.
 *
 * Clave = hash(texto_fuente) + ':' + glossaryVersion
 * Si se actualiza el glosario o el prompt, la versión cambia y los bloques
 * viejos dejan de coincidir solos.
 */

const INDEX_KEY = 'cpt:block-index';
const MAX_ENTRIES = 2000; // ~2-4 KB por entrada => ≤ 8 MB total
const PREFIX = 'cpt:b:';

function blockKey(sourceText: string, glossaryVersion: string): string {
  return `${PREFIX}${fnv1a(sourceText)}:${glossaryVersion}`;
}

export interface BlockCacheStore {
  /** Carga una traducción cacheada, o null si no existe. */
  loadBlock(sourceText: string): Promise<string | null>;
  /** Guarda la traducción de un bloque. */
  saveBlock(sourceText: string, translated: string): Promise<void>;
}

/**
 * Crea una caché de bloques ligada a una versión de glosario.
 * Usar la misma instancia para todos los bloques de una sesión.
 */
export function blockCacheStore(glossaryVersion: string): BlockCacheStore {
  return {
    async loadBlock(sourceText) {
      try {
        const key = blockKey(sourceText, glossaryVersion);
        const got = await chrome.storage.local.get(key);
        const v = got[key];
        return typeof v === 'string' ? v : null;
      } catch {
        return null;
      }
    },

    async saveBlock(sourceText, translated) {
      try {
        const key = blockKey(sourceText, glossaryVersion);
        const { [INDEX_KEY]: idx } = await chrome.storage.local.get(INDEX_KEY);
        const index: string[] = Array.isArray(idx) ? idx.filter((k) => k !== key) : [];
        index.push(key);
        // Evict entradas más antiguas si se supera el límite (LRU simple).
        const evicted = index.splice(0, Math.max(0, index.length - MAX_ENTRIES));
        if (evicted.length) await chrome.storage.local.remove(evicted);
        await chrome.storage.local.set({ [key]: translated, [INDEX_KEY]: index });
      } catch {
        /* la caché es opcional */
      }
    },
  };
}

/**
 * Dado un array de textos fuente y una caché, devuelve los índices que ya
 * están cacheados y sus traducciones, más los índices que hay que traducir.
 *
 * Uso típico antes de chunkBlocks():
 *   const { hits, misses } = await partitionByCache(sources, cache);
 *   // solo misses.texts van a la cola
 */
export interface CachePartition {
  /** Bloques ya cacheados: índice original → traducción. */
  hits: Map<number, string>;
  /** Índices de bloques que hay que traducir. */
  missMask: boolean[];
}

export async function partitionByCache(
  sources: string[],
  cache: BlockCacheStore,
): Promise<CachePartition> {
  const hits = new Map<number, string>();
  const missMask: boolean[] = [];

  await Promise.all(
    sources.map(async (src, i) => {
      const cached = await cache.loadBlock(src);
      if (cached !== null) {
        hits.set(i, cached);
        missMask[i] = false;
      } else {
        missMask[i] = true;
      }
    }),
  );

  return { hits, missMask };
}
