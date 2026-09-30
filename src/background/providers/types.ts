export interface ProviderOptions {
  apiKey?: string;
  model?: string;
  /** Reintento de un bloque conflictivo. */
  strict?: boolean;
}

export interface TranslationProvider {
  id: string;
  label: string;
  needsKey: boolean;
  supportsPrompt: boolean;
  free: boolean;

  /** Detección en runtime (solo el traductor local puede no estar). */
  isAvailable?(): Promise<boolean>;

  translate(
    blocks: string[],
    o: ProviderOptions,
    onProgress?: (mensaje: string) => void,
  ): Promise<string[]>;
}
