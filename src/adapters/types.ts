import type { ProtectionConfig } from '../core/protector';
import type { SegmentationOptions } from '../core/segmenter';

export interface SiteAdapter {
  id: 'codeforces' | 'cses' | 'usaco' | 'cpalgorithms' | 'vjudge';
  /**
   * Tipo de contenido del sitio.
   * - 'problem': enunciado corto, una sola llamada a la API.
   * - 'doc': artículo largo; requiere cola, lotes y glosario de documentos.
   * Opcional: si no se declara, se asume 'problem' para compatibilidad.
   */
  contentType?: 'problem' | 'doc';
  /**
   * Si true, el sistema usa Groq obligatoriamente y muestra un mensaje claro
   * si no hay key configurada (el traductor local no admite glosario ni lotes).
   * Opcional: si no se declara, el sistema usa el proveedor configurado.
   */
  requiresGroq?: boolean;
  /** Configuración exclusiva del content script de documentos. */
  documentation?: {
    rootSelector: string;
    spaNavigation?: boolean;
    attribution?: {
      siteName: string;
      siteUrl: string;
      licenseName: string;
      licenseUrl: string;
    };
  };
  matches(loc: Location): boolean;
  findStatementRoot(doc: Document): HTMLElement | null;
  /** Elementos hoja que forman una unidad de traducción con sentido. */
  blockSelector: string;
  protection: ProtectionConfig;
  segmentation?: SegmentationOptions;
  /** Identificador estable del problema o documento, para la caché. */
  problemKey(loc: Location, doc?: Document): string;
  /** Dónde colgar el botón. */
  mountPoint(root: HTMLElement): HTMLElement;
}
