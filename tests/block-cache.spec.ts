import { beforeEach, describe, expect, it } from 'vitest';
import { blockCacheStore, partitionByCache } from '../src/content/block-cache';

describe('blockCacheStore & partitionByCache (T38)', () => {
  const storage = new Map<string, any>();

  beforeEach(() => {
    storage.clear();
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: async (keys: string | string[]) => {
            if (typeof keys === 'string') {
              return { [keys]: storage.get(keys) };
            }
            const res: Record<string, any> = {};
            for (const k of keys) {
              if (storage.has(k)) res[k] = storage.get(k);
            }
            return res;
          },
          set: async (items: Record<string, any>) => {
            for (const [k, v] of Object.entries(items)) {
              storage.set(k, v);
            }
          },
          remove: async (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) storage.delete(k);
          },
        },
      },
    };
  });

  it('guarda y recupera bloques con versión de glosario', async () => {
    const cacheV1 = blockCacheStore('v1');
    await cacheV1.saveBlock('Hello world', 'Hola mundo');

    const loaded = await cacheV1.loadBlock('Hello world');
    expect(loaded).toBe('Hola mundo');

    // Con otra versión de glosario, no debe encontrarlo (invalida automáticamente)
    const cacheV2 = blockCacheStore('v2');
    const loadedV2 = await cacheV2.loadBlock('Hello world');
    expect(loadedV2).toBeNull();
  });

  it('partitionByCache separa correctamente hits y missMask', async () => {
    const cache = blockCacheStore('v1');
    await cache.saveBlock('Block A', 'Bloque A traducido');
    await cache.saveBlock('Block C', 'Bloque C traducido');

    const sources = ['Block A', 'Block B', 'Block C', 'Block D'];
    const { hits, missMask } = await partitionByCache(sources, cache);

    expect(hits.size).toBe(2);
    expect(hits.get(0)).toBe('Bloque A traducido');
    expect(hits.get(2)).toBe('Bloque C traducido');

    expect(missMask).toEqual([false, true, false, true]);
  });
});
