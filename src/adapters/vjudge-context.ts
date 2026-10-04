import { vjudge } from './vjudge';

export { vjudgePageKey, vjudgeSourceKey } from './vjudge-identity';
import { vjudgePageKey } from './vjudge-identity';

export interface VjudgeTarget {
  frame: HTMLIFrameElement | null;
  root: HTMLElement;
  key: string;
  src: string;
  language: string;
}

/** Solo el iframe seleccionado, nunca todos los problemas ni versiones juntas. */
export function vjudgeTarget(doc: Document, loc: Location): VjudgeTarget | null {
  const key = vjudgePageKey(doc, loc);
  if (!key) return null;
  const frames = [...doc.querySelectorAll<HTMLIFrameElement>('#frame-description-container iframe')];
  const selected = doc.querySelector<HTMLElement>('#prob-descs .problem-description-item.active');
  const selectedId = selected?.dataset.key;
  const frame = frames.find(frame => {
    const path = new URL(frame.getAttribute('src') ?? '', loc.href).pathname;
    return selectedId ? path === '/problem/description/' + selectedId : /^\/problem\/description\/\d+$/.test(path);
  }) ?? null;
  if (frames.length && !frame) return null;
  try {
    const frameDoc = frame ? frame.contentDocument : doc;
    if (!frameDoc || (frame && frameDoc.readyState === 'loading')) return null;
    const root = vjudge.findStatementRoot(frameDoc);
    if (!root || !root.textContent?.trim() ||
        root.querySelector('[role="alert"], .alert-danger, .error-message')) return null;
    const src = frame ? new URL(frame.getAttribute('src')!, loc.href).href : loc.href;
    if (frame && frameDoc.URL !== src && frameDoc.URL !== 'about:blank') return null;
    // Un about:blank real aún no contiene la descripción; las pruebas pueden
    // representar la carga explícitamente con un DOM capturado.
    const language = selected?.dataset.lang ?? root.getAttribute('lang') ?? '';
    return { frame, root, key, src, language };
  } catch { return null; }
}

export function mostlySpanish(text: string): boolean {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const es = new Set(['el', 'los', 'las', 'una', 'que', 'del', 'para', 'cada', 'debe', 'dado', 'entrada', 'salida']);
  const en = new Set(['the', 'and', 'of', 'is', 'are', 'for', 'each', 'given', 'input', 'output', 'print']);
  const spanish = words.filter(word => es.has(word)).length;
  const english = words.filter(word => en.has(word)).length;
  return spanish >= 4 && spanish >= english * 2 + 2;
}
