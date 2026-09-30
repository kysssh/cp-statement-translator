import { PROVIDERS } from '../background/providers';
import type { TranslationProvider } from '../background/providers/types';
import { getSettings, saveSettings, type Settings } from '../shared/settings';
import { cacheEntries, clearCache } from '../shared/cache-admin';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { themeControl } from '../ui/theme-control';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
let settings: Settings;

function badgesFor(p: TranslationProvider): HTMLElement[] {
  const out = [h('span', { class: p.id === 'chrome-builtin' ? 'badge ok' : p.free ? 'badge ok' : 'badge muted' }, p.id === 'chrome-builtin' ? 'Local' : p.free ? 'Gratis' : 'De pago')];
  out.push(h('span', { class: 'badge muted' }, p.needsKey ? 'Requiere key' : 'Sin configurar'));
  out.push(h('span', { class: 'badge' }, p.supportsPrompt ? 'Con glosario' : 'Sin glosario'));
  return out;
}

async function select(id: string) {
  settings.provider = id;
  await saveSettings(settings);
  renderProviders();
  renderConfig();
}

function renderProviders() {
  $('providers').replaceChildren(
    ...Object.values(PROVIDERS).map((p) =>
      h(
        'button',
        { class: 'pcard', type: 'button', role: 'radio', 'aria-checked': String(p.id === settings.provider), onClick: () => void select(p.id) },
        h('span', { class: 'dot' }, icon('check', 12)),
        h('span', { class: 'name' }, p.shortName),
        h('span', { class: 'tag' }, p.tagline),
        h('span', { class: 'badges' }, ...badgesFor(p)),
      ),
    ),
  );
}

function renderConfig() {
  const p = PROVIDERS[settings.provider];
  const box = $('config');

  const head = h('div', { class: 'cfg-head' }, h('div', {}, h('h3', {}, `Configurar ${p.shortName}`), h('p', { class: 'sub' }, p.label)), h('div', { class: 'badges' }, ...badgesFor(p)));

  if (!p.needsKey) {
    box.replaceChildren(
      head,
      h('div', { class: 'status info' }, 'No necesita cuenta ni clave. La primera vez, Chrome descarga el paquete de idioma inglés→español (requiere Chrome 138 o superior).'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onClick: (e: Event) => void checkLocal(e.currentTarget as HTMLButtonElement) }, 'Comprobar disponibilidad')),
      h('div', { id: 'status' }),
    );
    return;
  }

  const key = h('input', { type: 'password', id: 'apiKey', autocomplete: 'off', spellcheck: false, placeholder: 'Pega tu API key', value: settings.keys[p.id] ?? '' });
  const eye = h('button', { class: 'btn', type: 'button', title: 'Mostrar u ocultar', 'aria-label': 'Mostrar u ocultar la key' }, icon('eye', 16));
  eye.addEventListener('click', () => {
    const show = key.type === 'password';
    key.type = show ? 'text' : 'password';
    eye.replaceChildren(icon(show ? 'eyeOff' : 'eye', 16));
  });

  const modelInput = h('input', { type: 'text', id: 'model', list: 'models', placeholder: p.defaultModel ?? 'por defecto', value: settings.models[p.id] ?? '', autocomplete: 'off', spellcheck: false });
  const datalist = h('datalist', { id: 'models' }, ...(p.models ?? []).map((m) => h('option', { value: m.id }, m.label)));

  const load = p.listModels
    ? h('button', { class: 'btn', type: 'button', title: 'Consulta a la API los modelos disponibles para tu key' }, icon('refresh', 15), 'Cargar modelos')
    : null;
  load?.addEventListener('click', () => void loadModels(p, key.value.trim(), modelInput, datalist, load));

  const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Guardar y probar');
  save.addEventListener('click', () => void saveAndTest(p, key.value.trim(), modelInput.value.trim(), save));

  box.replaceChildren(
    head,
    h('div', { class: 'field' },
      h('label', { for: 'apiKey' }, 'API key'),
      h('div', { class: 'key-row' }, key, eye),
      h('span', { class: 'hint' }, p.keyHint ?? '', ' ', p.keyUrl ? h('a', { href: p.keyUrl, target: '_blank', rel: 'noreferrer' }, 'Obtener key ↗') : null),
    ),
    ...(p.models ? [
      h('div', { class: 'field' },
          h('label', { for: 'model' }, 'Modelo'),
          h('div', { class: 'key-row' }, modelInput, load),
          datalist,
          h('span', { class: 'hint' }, `Elige uno de la lista o escribe otro. Por defecto: ${p.defaultModel}.`)),
    ] : []),
    h('div', { class: 'actions' }, save),
    h('div', { id: 'status' }),
  );
}

function setStatus(kind: 'ok' | 'err' | 'info', text: string) {
  $('status').replaceChildren(h('div', { class: `status ${kind}` }, text));
}

async function checkLocal(btn: HTMLButtonElement) {
  btn.disabled = true;
  try {
    if (!('Translator' in self)) return setStatus('err', 'Este navegador no expone el traductor local. Elige otro motor.');
    const a = await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'es' });
    const msg: Record<string, [('ok' | 'err' | 'info'), string]> = {
      available: ['ok', 'Listo: el traductor local está disponible.'],
      downloadable: ['info', 'Disponible. Se descargará el paquete de idioma la primera vez que traduzcas.'],
      downloading: ['info', 'El paquete de idioma se está descargando.'],
      unavailable: ['err', 'No disponible para inglés→español en este navegador. Elige otro motor.'],
    };
    setStatus(...(msg[a] ?? ['info', `Estado: ${a}`]));
  } catch (e) {
    setStatus('err', e instanceof Error ? e.message : String(e));
  } finally {
    btn.disabled = false;
  }
}

async function loadModels(p: TranslationProvider, apiKey: string, input: HTMLInputElement, list: HTMLDataListElement, btn: HTMLButtonElement) {
  if (!apiKey) return setStatus('err', 'Escribe primero la API key.');
  btn.disabled = true;
  setStatus('info', 'Consultando los modelos disponibles…');
  try {
    const models = await p.listModels!(apiKey);
    if (!models.length) return setStatus('err', 'La API no devolvió modelos utilizables.');
    list.replaceChildren(...models.map((m) => h('option', { value: m.id }, m.label)));
    const ids = models.map((m) => m.id);
    const current = input.value.trim() || p.defaultModel || '';
    if (!ids.includes(current)) input.value = ids[0];
    setStatus('ok', `${models.length} modelos disponibles. Seleccionado: ${input.value}. Pulsa «Guardar y probar».`);
  } catch (e) {
    setStatus('err', e instanceof Error ? e.message : String(e));
  } finally {
    btn.disabled = false;
  }
}

async function saveAndTest(p: TranslationProvider, apiKey: string, model: string, btn: HTMLButtonElement) {
  settings.keys[p.id] = apiKey;
  settings.models[p.id] = model;
  await saveSettings(settings);
  if (!apiKey) return setStatus('err', 'Falta la API key.');

  btn.disabled = true;
  setStatus('info', 'Probando la conexión…');
  try {
    const [out] = await p.translate(['Hello world'], { apiKey, model: model || undefined });
    setStatus('ok', `Funciona ✔  «Hello world» → «${out}»`);
  } catch (e) {
    setStatus('err', `Guardado, pero la prueba falló: ${e instanceof Error ? e.message : e}`);
  } finally {
    btn.disabled = false;
  }
}

async function renderCache() {
  const n = await cacheEntries();
  $('cacheInfo').textContent = n ? `${n} enunciado(s) guardados. Revisitarlos es instantáneo y no gasta cuota.` : 'Vacía.';
  const btn = $('clearCache') as HTMLButtonElement;
  btn.replaceChildren(icon('trash', 16), 'Vaciar caché');
  btn.disabled = n === 0;
}

async function init() {
  settings = await getSettings();
  if (!PROVIDERS[settings.provider]) settings.provider = 'chrome-builtin';
  renderProviders();
  renderConfig();
  $('themeSlot').replaceChildren(themeControl());
  await renderCache();
  $('clearCache').addEventListener('click', async () => {
    await clearCache();
    await renderCache();
  });
}

void init();
