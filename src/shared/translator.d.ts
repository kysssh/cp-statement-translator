// Tipos mínimos de la Translator API de Chrome (on-device), no incluidos en @types/chrome.
type TranslatorAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslatorCreateOptions extends TranslatorOptions {
  monitor?(m: EventTarget): void;
}

declare class Translator {
  static availability(o: TranslatorOptions): Promise<TranslatorAvailability>;
  static create(o: TranslatorCreateOptions): Promise<Translator>;
  translate(text: string): Promise<string>;
  destroy(): void;
}
