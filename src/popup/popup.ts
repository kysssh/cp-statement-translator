import { PROVIDERS } from '../background/providers';
import { getSettings, saveSettings, type Settings } from '../shared/settings';
import { cacheEntries, clearCache } from '../shared/cache-admin';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { themeControl } from '../ui/theme-control';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
let settings: Settings;

function stateOf(id: string): string {
  const p = PROVIDERS[id];
  if (!p.needsKey) return 'Sin configurar · local';
  return settings.keys[id] ? 'Key configurada' : 'Falta la API key';
}

function render() {
  $('list').replaceChildren(
    ...Object.values(PROVIDERS).map((p) =>
      h('button', {
        class: 'item', type: 'button', role: 'radio', 'aria-checked': String(p.id === settings.provider),
        onClick: async () => {
          settings.provider = p.id;
          await saveSettings(settings);
          render();
        },
      },
        h('span', { class: 'radio' }),
        h('span', { class: 'info' }, h('span', { class: 'n' }, p.shortName), h('span', { class: 's' }, stateOf(p.id))),
        h('span', { class: p.free ? 'badge ok' : 'badge muted' }, p.id === 'chrome-builtin' ? 'Local' : p.free ? 'Gratis' : 'De pago'),
      ),
    ),
  );

  const active = PROVIDERS[settings.provider];
  const warn = $('warn');
  warn.hidden = !(active.needsKey && !settings.keys[active.id]);
  warn.textContent = `${active.shortName} necesita una API key. Añádela en Ajustes.`;
}

async function renderCache() {
  const n = await cacheEntries();
  const btn = $('cache') as HTMLButtonElement;
  btn.replaceChildren(icon('trash', 15), `Caché (${n})`);
  btn.disabled = n === 0;
  btn.title = 'Vaciar la caché de traducciones';
}

async function init() {
  settings = await getSettings();
  if (!PROVIDERS[settings.provider]) settings.provider = 'chrome-builtin';
  render();
  $('themeSlot').replaceChildren(themeControl());
  await renderCache();
  $('cache').addEventListener('click', async () => {
    await clearCache();
    await renderCache();
  });
  $('open').addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
    window.close();
  });
}

void init();
