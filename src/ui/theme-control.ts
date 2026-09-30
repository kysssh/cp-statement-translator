import { getThemeMode, setThemeMode, THEME_KEY, normalizeTheme, type ThemeMode } from '../shared/settings';
import { h } from './dom';
import { icon, type IconName } from './icons';

const OPTIONS: { mode: ThemeMode; label: string; ico: IconName }[] = [
  { mode: 'auto', label: 'Auto', ico: 'cpu' },
  { mode: 'off', label: 'Claro', ico: 'sun' },
  { mode: 'on', label: 'Oscuro', ico: 'moon' },
];

/** Selector segmentado del modo oscuro de Codeforces/CSES. Se mantiene sincronizado con otros paneles. */
export function themeControl(): HTMLElement {
  const buttons = new Map<ThemeMode, HTMLButtonElement>();
  const box = h('div', { class: 'seg-ctl', role: 'radiogroup', 'aria-label': 'Modo oscuro' });

  const mark = (current: ThemeMode) => {
    for (const [m, b] of buttons) b.setAttribute('aria-checked', String(m === current));
  };

  for (const o of OPTIONS) {
    const b = h('button', { type: 'button', role: 'radio', onClick: () => { mark(o.mode); void setThemeMode(o.mode); } }, icon(o.ico, 14), o.label);
    buttons.set(o.mode, b);
    box.append(b);
  }

  void getThemeMode().then(mark);
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && c[THEME_KEY]) mark(normalizeTheme(c[THEME_KEY].newValue));
  });
  return box;
}
