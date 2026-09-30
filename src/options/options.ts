import { PROVIDERS } from '../background/providers';
import { getSettings, saveSettings, type Settings } from '../shared/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const select = $<HTMLSelectElement>('provider');
const keyRow = $('keyRow');
const apiKey = $<HTMLInputElement>('apiKey');
const model = $<HTMLInputElement>('model');
const status = $('status');

let settings: Settings;

function refresh() {
  const p = PROVIDERS[select.value];
  keyRow.classList.toggle('hidden', !p.needsKey);
  apiKey.value = settings.keys[p.id] ?? '';
  model.value = settings.models[p.id] ?? '';
}

async function init() {
  settings = await getSettings();
  for (const p of Object.values(PROVIDERS)) select.add(new Option(p.label, p.id));
  select.value = PROVIDERS[settings.provider] ? settings.provider : 'chrome-builtin';
  refresh();
}

select.addEventListener('change', refresh);

$('save').addEventListener('click', async () => {
  const p = PROVIDERS[select.value];
  settings.provider = p.id;
  if (p.needsKey) {
    settings.keys[p.id] = apiKey.value.trim();
    settings.models[p.id] = model.value.trim();
  }
  await saveSettings(settings);

  if (!p.needsKey) {
    status.textContent = 'Guardado.';
    return;
  }
  status.textContent = 'Guardado. Probando la key…';
  try {
    await p.translate(['Hello world'], { apiKey: settings.keys[p.id], model: settings.models[p.id] });
    status.textContent = 'Guardado. La key funciona ✔';
  } catch (e) {
    status.textContent = `Guardado, pero la prueba falló: ${e instanceof Error ? e.message : e}`;
  }
});

init();
