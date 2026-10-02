import type { BatchTranslator } from './quota';

export interface ProviderOptions {
  apiKey?: string;
  model?: string;
  /** Reintento de un bloque conflictivo. */
  strict?: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface TranslationProvider {
  id: string;
  /** Nombre largo, para el desplegable y las tarjetas. */
  label: string;
  /** Nombre corto, para chips. */
  shortName: string;
  /** Una línea que explica cuándo conviene usarlo. */
  tagline: string;
  needsKey: boolean;
  supportsPrompt: boolean;
  free: boolean;

  /** Traduce un único lote y devuelve la cuota restante (lo usa la cola, T36). */
  translateBatch?: BatchTranslator;

  /** Modelos sugeridos (el usuario puede escribir otro). */
  models?: ModelInfo[];
  defaultModel?: string;
  /** Dónde sacar la API key. */
  keyUrl?: string;
  keyHint?: string;

  /** Pregunta a la API qué modelos ofrece esta key (los nombres cambian con frecuencia). */
  listModels?(apiKey: string): Promise<ModelInfo[]>;

  /** Detección en runtime (solo el traductor local puede no estar). */
  isAvailable?(): Promise<boolean>;

  translate(
    blocks: string[],
    o: ProviderOptions,
    onProgress?: (mensaje: string) => void,
  ): Promise<string[]>;
}
