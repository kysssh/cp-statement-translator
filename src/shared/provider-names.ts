/** Nombres cortos para chips y popup. Sin dependencias: lo importa también el content script. */
export const PROVIDER_NAMES: Record<string, string> = {
  'chrome-builtin': 'Chrome local',
  groq: 'Groq',
  gemini: 'Gemini',
  deepl: 'DeepL',
  anthropic: 'Claude Haiku',
};

export const providerName = (id: string): string => PROVIDER_NAMES[id] ?? id;
