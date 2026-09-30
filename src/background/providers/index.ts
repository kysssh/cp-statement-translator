import { chromeBuiltin } from './chrome-builtin';
import { groq } from './groq';
import { gemini } from './gemini';
import { anthropic } from './anthropic';
import { deepl } from './deepl';
import type { TranslationProvider } from './types';

export const PROVIDERS: Record<string, TranslationProvider> = {
  'chrome-builtin': chromeBuiltin,
  groq,
  gemini,
  deepl,
  anthropic,
};

export { DEFAULT_PROVIDER_ID as DEFAULT_PROVIDER } from '../../shared/settings';
