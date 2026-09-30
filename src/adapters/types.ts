import type { ProtectionConfig } from '../core/protector';

export interface SiteAdapter {
  id: 'codeforces' | 'cses';
  matches(loc: Location): boolean;
  findStatementRoot(doc: Document): HTMLElement | null;
  /** Elementos hoja que forman una unidad de traducción con sentido. */
  blockSelector: string;
  protection: ProtectionConfig;
  /** Identificador estable del problema, para la caché. */
  problemKey(loc: Location): string;
  /** Dónde colgar el botón. */
  mountPoint(root: HTMLElement): HTMLElement;
}
