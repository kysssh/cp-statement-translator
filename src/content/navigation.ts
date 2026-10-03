/**
 * Detección de navegación en SPAs (T41).
 *
 * USACO Guide es un SPA de Next.js: navegar entre módulos actualiza el DOM
 * sin recargar la página. La traducción colgada en el DOM desaparece porque
 * React reemplaza el contenedor .markdown completo.
 *
 * Estrategia: intentar Navigation API (disponible en Chrome 102+), y si no
 * existe, observar con MutationObserver la sustitución del contenedor de
 * contenido o comparar location.href periódicamente.
 */

export type NavigationCallback = (newHref: string) => void;

/**
 * Escucha cambios de ruta SPA en el documento actual.
 * Llama a `cb` cada vez que la URL cambia tras una navegación dentro de la app.
 * Devuelve una función de limpieza.
 */
export function onSpaNavigate(cb: NavigationCallback): () => void {
  // 1. Navigation API (Chrome 102+, disponible en Brave) — la más limpia.
  if ('navigation' in window) {
    const nav = (window as Window & { navigation: EventTarget }).navigation;
    const handler = () => cb(location.href);
    nav.addEventListener('navigatesuccess', handler);
    return () => nav.removeEventListener('navigatesuccess', handler);
  }

  // 2. MutationObserver: observa reemplazos en <body> como fallback.
  // Next.js reemplaza __NEXT_DATA__ y el árbol de la app, visible desde <body>.
  let lastHref = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      cb(lastHref);
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });

  // Escuchar pushState/replaceState como seguro adicional.
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = (...args) => {
    origPush(...args);
    if (location.href !== lastHref) {
      lastHref = location.href;
      cb(lastHref);
    }
  };
  history.replaceState = (...args) => {
    origReplace(...args);
    if (location.href !== lastHref) {
      lastHref = location.href;
      cb(lastHref);
    }
  };

  return () => {
    observer.disconnect();
    history.pushState = origPush;
    history.replaceState = origReplace;
  };
}

/**
 * Espera a que un elemento con `selector` esté presente en el DOM,
 * haciendo polling cada `intervalMs` ms con un máximo de `maxWaitMs` ms.
 * Usado para esperar a que Next.js monte el contenido nuevo tras navegar.
 */
export function waitForElement(
  selector: string,
  maxWaitMs = 5000,
  intervalMs = 100,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) {
      resolve(found);
      return;
    }

    let elapsed = 0;
    const id = setInterval(() => {
      const el = document.querySelector(selector);
      elapsed += intervalMs;
      if (el || elapsed >= maxWaitMs) {
        clearInterval(id);
        resolve(el);
      }
    }, intervalMs);
  });
}
