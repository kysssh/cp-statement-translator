const PREFIX = 'cpt:';

/** Claves de caché de traducciones (incluye el índice). */
async function cacheKeys(): Promise<string[]> {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all).filter((k) => k.startsWith(PREFIX));
}

export async function cacheEntries(): Promise<number> {
  return (await cacheKeys()).filter((k) => k !== `${PREFIX}index`).length;
}

export async function clearCache(): Promise<void> {
  await chrome.storage.local.remove(await cacheKeys());
}
