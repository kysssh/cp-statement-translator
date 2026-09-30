import { getThemeMode, normalizeTheme, THEME_KEY, type ThemeMode } from '../shared/settings';

const CACHE_KEY = 'cpt-theme-mode'; // localStorage de la página: lectura síncrona para evitar el parpadeo blanco
const isCses = location.hostname.endsWith('cses.fi');

let mode: ThemeMode = 'off';
let started = false;
let csesChanged = false;
const listeners = new Set<(dark: boolean) => void>();
const mq = matchMedia('(prefers-color-scheme: dark)');

export const isDark = (): boolean => mode === 'on' || (mode === 'auto' && mq.matches);

/**
 * CSES ya trae su propia hoja oscura (#styles-dark): se activa esa, que queda mejor que cualquier filtro.
 * Codeforces no tiene: se invierte la página y se restauran los elementos que no deben invertirse.
 */
function apply(): void {
  const dark = isDark();
  const root = document.documentElement;

  if (isCses) {
    const light = document.getElementById('styles') as HTMLLinkElement | null;
    const alt = document.getElementById('styles-dark') as HTMLLinkElement | null;
    if (light && alt) {
      root.classList.remove('cpt-dark');
      if (dark) {
        alt.rel = 'stylesheet';
        alt.disabled = false;
        light.disabled = true;
        csesChanged = true;
      } else if (csesChanged) {
        alt.disabled = true;
        light.disabled = false;
        csesChanged = false;
      }
    } else if (document.readyState === 'loading') {
      // El <head> aún no existe (document_start): reintentar cuando esté.
      document.addEventListener('DOMContentLoaded', apply, { once: true });
      root.classList.toggle('cpt-dark', dark); // mientras tanto, filtro
    } else {
      root.classList.toggle('cpt-dark', dark);
    }
  } else {
    root.classList.toggle('cpt-dark', dark);
  }
  listeners.forEach((cb) => cb(dark));
}

/** Idempotente. Llamar lo antes posible (document_start). */
export async function initDark(): Promise<void> {
  if (started) return;
  started = true;

  try {
    mode = normalizeTheme(localStorage.getItem(CACHE_KEY));
  } catch {
    /* localStorage bloqueado */
  }
  apply();

  mq.addEventListener('change', () => mode === 'auto' && apply());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[THEME_KEY]) return;
    mode = normalizeTheme(changes[THEME_KEY].newValue);
    remember();
    apply();
  });

  mode = await getThemeMode();
  remember();
  apply();
}

function remember() {
  try {
    localStorage.setItem(CACHE_KEY, mode);
  } catch {
    /* sin caché local */
  }
}

/** Notifica el estado actual y cada cambio futuro. */
export function onDarkChange(cb: (dark: boolean) => void): void {
  listeners.add(cb);
  cb(isDark());
}
