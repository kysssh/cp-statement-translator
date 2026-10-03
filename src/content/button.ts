import { icon } from '../ui/icons';
import { h } from '../ui/dom';

export type UiState = 'idle' | 'loading' | 'progress' | 'done' | 'error';
export type Lang = 'es' | 'en';
export type TranslateMode = 'all' | 'scroll';

export interface UiHandlers {
  onTranslate(): void;
  onCancel?(): void;
  onShow(lang: Lang): void;
  onSettings(): void;
  onTheme(): void;
  onModeChange?(mode: TranslateMode): void;
}

export interface UiInfo {
  /** Progreso (loading) o motivo del fallo (error). */
  message?: string;
  /** Nombre corto del motor, para el chip. */
  provider?: string;
  lang?: Lang;
  /** Nota bajo la barra (caché, bloques omitidos…). */
  note?: string;
}

let root: HTMLElement | null = null;
let primary: HTMLButtonElement;
let primaryIcon: HTMLElement;
let primaryLabel: HTMLElement;
let cancelBtn: HTMLButtonElement;
let segEs: HTMLButtonElement;
let segEn: HTMLButtonElement;
let chip: HTMLElement;
let msg: HTMLElement;
let themeBtn: HTMLButtonElement;
let btnModeAll: HTMLButtonElement | null = null;
let btnModeScroll: HTMLButtonElement | null = null;

export function mountUi(container: HTMLElement, handlers: UiHandlers): void {
  root?.remove();

  primaryIcon = h('span', { class: 'cpt-ico' });
  primaryLabel = h('span', { class: 'cpt-label' });
  primary = h('button', { class: 'cpt-primary', type: 'button', onClick: () => handlers.onTranslate() }, primaryIcon, primaryLabel);

  cancelBtn = h('button', { class: 'cpt-cancel', type: 'button', 'aria-label': 'Cancelar traducción', title: 'Cancelar', onClick: () => handlers.onCancel?.() }, icon('x', 14));

  segEs = h('button', { type: 'button', onClick: () => handlers.onShow('es') }, 'ES');
  segEn = h('button', { type: 'button', onClick: () => handlers.onShow('en') }, 'EN');
  const seg = h('div', { class: 'cpt-seg', role: 'group', 'aria-label': 'Idioma mostrado' }, segEs, segEn);

  let modeSeg: HTMLElement | null = null;
  if (handlers.onModeChange) {
    btnModeAll = h('button', {
      type: 'button',
      class: 'cpt-mode-btn',
      'aria-pressed': 'true',
      title: 'Traducir el documento completo',
      onClick: () => {
        btnModeAll?.setAttribute('aria-pressed', 'true');
        btnModeScroll?.setAttribute('aria-pressed', 'false');
        handlers.onModeChange?.('all');
      },
    }, 'Todo');

    btnModeScroll = h('button', {
      type: 'button',
      class: 'cpt-mode-btn',
      'aria-pressed': 'false',
      title: 'Traducir secciones al hacer scroll (ahorra tokens)',
      onClick: () => {
        btnModeAll?.setAttribute('aria-pressed', 'false');
        btnModeScroll?.setAttribute('aria-pressed', 'true');
        handlers.onModeChange?.('scroll');
      },
    }, 'Al leer');

    modeSeg = h('div', { class: 'cpt-mode-seg', role: 'group', 'aria-label': 'Modo de traducción' }, btnModeAll, btnModeScroll);
  }

  chip = h('span', { class: 'cpt-chip' });
  const gear = h('button', { class: 'cpt-gear', type: 'button', title: 'Ajustes de la extensión', 'aria-label': 'Ajustes', onClick: () => handlers.onSettings() }, icon('sliders', 16));
  themeBtn = h('button', { class: 'cpt-gear', type: 'button', onClick: () => handlers.onTheme() });
  setThemeIcon(false);
  msg = h('div', { class: 'cpt-msg', role: 'status' });

  const barElements = [primary, cancelBtn, ...(modeSeg ? [modeSeg] : []), seg, chip, themeBtn, gear];
  root = h('div', { class: 'cpt-root' }, h('div', { class: 'cpt-bar' }, ...barElements), msg);
  container.prepend(root);
  setUi('idle');
}

export function setUi(state: UiState, info: UiInfo = {}): void {
  if (!root) return;
  root.dataset.state = state;
  const isTranslating = state === 'loading' || state === 'progress';
  primary.disabled = isTranslating;
  cancelBtn.hidden = !isTranslating;

  primaryIcon.replaceChildren(
    isTranslating ? h('span', { class: 'cpt-spinner' }) : icon(state === 'error' ? 'refresh' : 'languages', 16),
  );
  primaryLabel.textContent = {
    idle: 'Traducir al español',
    loading: info.message || 'Traduciendo…',
    progress: info.message || 'Traduciendo…',
    done: '',
    error: 'Reintentar',
  }[state];

  const lang = info.lang ?? 'es';
  segEs.setAttribute('aria-pressed', String(lang === 'es'));
  segEn.setAttribute('aria-pressed', String(lang === 'en'));

  chip.textContent = info.provider ?? '';
  chip.title = info.provider ? `Traducido con ${info.provider}` : '';

  const text = state === 'error' ? (info.message ?? 'Error desconocido') : (info.note ?? '');
  msg.textContent = text;
  msg.hidden = !text;
}

/** Icono y texto del botón de tema: muestra la acción que ejecutaría al pulsarlo. */
export function setThemeIcon(dark: boolean): void {
  if (!themeBtn) return;
  themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon', 16));
  themeBtn.title = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  themeBtn.setAttribute('aria-label', themeBtn.title);
}
