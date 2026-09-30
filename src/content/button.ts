import { icon } from '../ui/icons';
import { h } from '../ui/dom';

export type UiState = 'idle' | 'loading' | 'done' | 'error';
export type Lang = 'es' | 'en';

export interface UiHandlers {
  onTranslate(): void;
  onShow(lang: Lang): void;
  onSettings(): void;
  onTheme(): void;
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
let segEs: HTMLButtonElement;
let segEn: HTMLButtonElement;
let chip: HTMLElement;
let msg: HTMLElement;
let themeBtn: HTMLButtonElement;

export function mountUi(container: HTMLElement, handlers: UiHandlers): void {
  root?.remove();

  primaryIcon = h('span', { class: 'cpt-ico' });
  primaryLabel = h('span', { class: 'cpt-label' });
  primary = h('button', { class: 'cpt-primary', type: 'button', onClick: () => handlers.onTranslate() }, primaryIcon, primaryLabel);

  segEs = h('button', { type: 'button', onClick: () => handlers.onShow('es') }, 'ES');
  segEn = h('button', { type: 'button', onClick: () => handlers.onShow('en') }, 'EN');
  const seg = h('div', { class: 'cpt-seg', role: 'group', 'aria-label': 'Idioma mostrado' }, segEs, segEn);

  chip = h('span', { class: 'cpt-chip' });
  const gear = h('button', { class: 'cpt-gear', type: 'button', title: 'Ajustes de la extensión', 'aria-label': 'Ajustes', onClick: () => handlers.onSettings() }, icon('sliders', 16));
  themeBtn = h('button', { class: 'cpt-gear', type: 'button', onClick: () => handlers.onTheme() });
  setThemeIcon(false);
  msg = h('div', { class: 'cpt-msg', role: 'status' });

  root = h('div', { class: 'cpt-root' }, h('div', { class: 'cpt-bar' }, primary, seg, chip, themeBtn, gear), msg);
  container.prepend(root);
  setUi('idle');
}

export function setUi(state: UiState, info: UiInfo = {}): void {
  if (!root) return;
  root.dataset.state = state;
  primary.disabled = state === 'loading';

  primaryIcon.replaceChildren(
    state === 'loading' ? h('span', { class: 'cpt-spinner' }) : icon(state === 'error' ? 'refresh' : 'languages', 16),
  );
  primaryLabel.textContent = {
    idle: 'Traducir al español',
    loading: info.message || 'Traduciendo…',
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
