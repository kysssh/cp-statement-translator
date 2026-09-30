export const DEFAULT_PROVIDER_ID = 'chrome-builtin';

export interface Settings {
  provider: string;
  keys: Record<string, string>;
  models: Record<string, string>;
}

/**
 * Solo el id del proveedor. El content script usa ESTA función: nunca debe
 * leer las API keys.
 */
export async function getProviderId(): Promise<string> {
  const { provider } = await chrome.storage.local.get('provider');
  return typeof provider === 'string' && provider ? provider : DEFAULT_PROVIDER_ID;
}

export async function getSettings(): Promise<Settings> {
  const s = await chrome.storage.local.get(['provider', 'keys', 'models']);
  return {
    provider: typeof s.provider === 'string' && s.provider ? s.provider : DEFAULT_PROVIDER_ID,
    keys: (s.keys as Record<string, string>) ?? {},
    models: (s.models as Record<string, string>) ?? {},
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ provider: s.provider, keys: s.keys, models: s.models });
}
