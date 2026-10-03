/**
 * Content script para sitios de documentación (USACO Guide y CP-Algorithms, T43-T49).
 *
 * Integra:
 *  - T37: progreso "Traduciendo 3/8 lotes…" y cancelación
 *  - T38: caché por bloque individual con blockCacheStore
 *  - T41: detección de navegación en SPA de Next.js (onSpaNavigate)
 *  - T42: adapter de USACO Guide con selectores del DOM real
 *  - T45: componentes con estado (desplegables <details> y observador de mutaciones)
 *  - T46: modos de traducción: "Todo" o "Al leer" (scroll con IntersectionObserver)
 *  - T47: toggle EN ↔ ES sin pérdida de estado y banner de atribución
 */

import './ui.css';
import { resolveAdapter } from '../adapters';
import type { SiteAdapter } from '../adapters/types';
import { collectBlocks } from '../core/segmenter';
import { chunkBlocks } from '../core/chunker';
import { extract, restore } from '../core/protector';
import { isValid, normalizeTokens } from '../core/validator';
import { mountUi, setUi, type Lang, type TranslateMode } from './button';
import { blockCacheStore, partitionByCache } from './block-cache';
import { TranslationQueue } from './queue';
import { onSpaNavigate, waitForElement } from './navigation';
import { DOC_GLOSSARY_VERSION } from '../shared/doc-prompt';
import type { TranslateDocBatchRequest, TranslateDocBatchResponse } from '../shared/messages';
import { initDark, isDark, onDarkChange } from './dark';
import { setThemeIcon } from './button';
import { setThemeMode } from '../shared/settings';
import type { OpenOptionsRequest } from '../shared/messages';
import { splitIntoSections, SectionObserver, type DocSection } from './sections';
import { DocTranslationView, ensureDocAttribution } from './doc-view';

const adapter = resolveAdapter(location);
if (adapter?.contentType === 'doc' && adapter.documentation) {
  startDocs(adapter);
}

function startDocs(adapter: SiteAdapter) {
  const rootSelector = adapter.documentation!.rootSelector;
  /** Presupuesto de tokens de entrada por lote. */
  const BUDGET_TOKENS = 3000;

  // Estado de la sesión del documento
  let uiMounted = false;
  let currentRoot: HTMLElement | null = null;
  let currentMode: TranslateMode = 'all';
  let docView = new DocTranslationView();
  let activeQueue: TranslationQueue | null = null;
  let sectionObserver: SectionObserver | null = null;
  let sections: DocSection[] = [];
  let allBlocks: Element[] = [];
  let autoTranslateNextNav = false;

  // ─── UI fija en document.body (sobrevive a la navegación SPA) ───────────────

  function ensureUi() {
    if (uiMounted) return;
    uiMounted = true;

    mountUi(document.body, {
      onTranslate: () => void handleTranslateClick(),
      onCancel: () => activeQueue?.cancel(),
      onShow: (lang: Lang) => {
        if (lang === 'en') {
          docView.showOriginal();
          setUi('done', { provider: 'Groq', lang: 'en' });
        } else {
          docView.showTranslated();
          setUi('done', { provider: 'Groq', lang: 'es' });
        }
      },
      onTheme: () => void setThemeMode(isDark() ? 'off' : 'on'),
      onSettings: () => {
        const req: OpenOptionsRequest = { type: 'OPEN_OPTIONS' };
        void chrome.runtime.sendMessage(req);
      },
      onModeChange: (mode: TranslateMode) => {
        currentMode = mode;
        if (mode === 'scroll' && docView.translatedCount > 0) {
          startScrollMode();
        }
      },
    });

    void initDark();
    onDarkChange(setThemeIcon);
  }

  // ─── Disparador principal ───────────────────────────────────────────────────

  async function handleTranslateClick() {
    if (!currentRoot) {
      currentRoot = adapter.findStatementRoot(document);
    }
    if (!currentRoot) {
      setUi('error', { message: 'No se encontró el contenido del módulo.' });
      return;
    }

    autoTranslateNextNav = true;

    if (currentMode === 'scroll') {
      startScrollMode();
    } else {
      // Modo "Todo"
      sectionObserver?.disconnect();
      allBlocks = collectBlocks(currentRoot, adapter.blockSelector, adapter.protection);
      if (!allBlocks.length) {
        setUi('error', { message: 'No hay bloques de texto para traducir.' });
        return;
      }
      await translateBlocksList(allBlocks);
    }
  }

  // ─── Modo bajo demanda por scroll (T46) ────────────────────────────────────

  function startScrollMode() {
    if (!currentRoot) return;
    sectionObserver?.disconnect();

    allBlocks = collectBlocks(currentRoot, adapter.blockSelector, adapter.protection);
    sections = splitIntoSections(allBlocks);

    sectionObserver = new SectionObserver(async (sec) => {
      sec.state = 'translating';
      setUi('progress', {
        message: `Traduciendo sección: ${sec.title.slice(0, 25)}…`,
        provider: 'Groq',
      });
      await translateBlocksList(sec.blocks);
      sec.state = 'translated';
    });

    sectionObserver.observe(sections);
    setUi('progress', {
      message: 'Modo scroll activo: desplázate por el documento…',
      provider: 'Groq',
    });
  }

  // ─── Traducción de una lista de bloques ─────────────────────────────────────

  async function translateBlocksList(blocksToTranslate: Element[]): Promise<void> {
    if (!blocksToTranslate.length) return;

    // Cancelar cola previa si estaba corriendo
    activeQueue?.cancel();

    const cache = blockCacheStore(DOC_GLOSSARY_VERSION);
    // restore() mueve nodos opacos: guardar el original antes de llamarlo.
    blocksToTranslate.forEach((block) => docView.recordOriginal(block));
    const extractions = blocksToTranslate.map((b) => extract(b, adapter.protection));
    const sources = extractions.map((e) => e.text);

    // T38: partición por caché de bloques
    const { hits, missMask } = await partitionByCache(sources, cache);

    // Aplicar aciertos de caché inmediatamente
    for (const [i, translated] of hits) {
      const fixed = normalizeTokens(translated);
      if (!isValid(sources[i], fixed)) {
        // Una entrada incompleta se vuelve a traducir sin tocar el DOM original.
        hits.delete(i);
        missMask[i] = true;
        continue;
      }
      const block = blocksToTranslate[i];
      docView.applyBlock(block, restore(fixed, extractions[i].slots));
    }

    const missIndices = missMask
      .map((m, i) => (m ? i : -1))
      .filter((i) => i >= 0);

    if (!missIndices.length) {
      if (currentRoot) ensureDocAttribution(currentRoot, adapter.documentation?.attribution);
      setUi('done', {
        provider: 'Groq',
        note: 'Bloques recuperados de la caché.',
        lang: 'es',
      });
      return;
    }

    // T35: agrupar pendientes en lotes con presupuesto
    const missBlocks = missIndices.map((i) => ({ text: sources[i] }));
    const chunks = chunkBlocks(missBlocks, BUDGET_TOKENS);
    const batches = chunks.map((c) => c.blocks.map((b) => b.text));
    const tokenCounts = chunks.map((c) => c.estimatedTokens);

    const batchIndexToOriginal = chunks.map((c) =>
      c.indices.map((missPos) => missIndices[missPos]),
    );

    // T36: cola de traducción con reintentos y límite de tasa
    const queue = new TranslationQueue(
      batches,
      tokenCounts,
      {
        onBatch(batchIdx, total, translations) {
          const origIndices = batchIndexToOriginal[batchIdx];
          translations.forEach((translated, j) => {
            const origIdx = origIndices[j];
            if (origIdx === undefined) return;
            const src = sources[origIdx];
            const fixed = normalizeTokens(translated);
            if (!isValid(src, fixed)) return;

            const block = blocksToTranslate[origIdx];
            docView.applyBlock(block, restore(fixed, extractions[origIdx].slots));

            // Guardar en caché por bloque (T38)
            void cache.saveBlock(src, fixed);
          });

          // T37: progreso
          const done = batchIdx + 1;
          if (done < total) {
            setUi('progress', {
              message: `Traduciendo ${done}/${total} lotes…`,
              provider: 'Groq',
            });
          } else {
            activeQueue = null;
            if (currentRoot) ensureDocAttribution(currentRoot, adapter.documentation?.attribution);
            const cachedCount = blocksToTranslate.length - missIndices.length;
            setUi('done', {
              provider: 'Groq',
              note: cachedCount > 0 ? `${cachedCount} bloque(s) desde caché.` : undefined,
              lang: 'es',
            });
          }
        },

        onWaiting(ms, reason) {
          const secs = Math.ceil(ms / 1000);
          setUi('progress', {
            message:
              reason === 'quota'
                ? `Esperando cuota Groq (${secs}s)…`
                : `Reintentando en ${secs}s…`,
            provider: 'Groq',
          });
        },

        onError(message) {
          activeQueue = null;
          setUi('error', { message });
        },
      },
      {
        onSend: async (blockTexts) => {
          const req: TranslateDocBatchRequest = {
            type: 'TRANSLATE_DOC_BATCH',
            blocks: blockTexts,
          };
          const res: TranslateDocBatchResponse | undefined =
            await chrome.runtime.sendMessage(req);
          if (!res) return { ok: false, error: 'El service worker no respondió.' };
          if (!res.ok) {
            return {
              ok: false,
              error: res.error,
              retryAfterMs: res.retryAfterMs ?? null,
            };
          }
          return {
            ok: true,
            blocks: res.blocks,
            rateLimit: res.rateLimit,
            retryAfterMs: res.retryAfterMs ?? null,
          };
        },
      },
    );

    activeQueue = queue;
    setUi('progress', {
      message: `Traduciendo 0/${batches.length} lotes…`,
      provider: 'Groq',
    });

    await queue.run();
  }

  // ─── T45: Componentes con estado (desplegables y mutaciones) ────────────────

  function setupStateObservers(root: HTMLElement) {
    // 1. Escuchar apertura de desplegables (<details>)
    root.addEventListener(
      'toggle',
      (e) => {
        const details = e.target;
        if (!(details instanceof HTMLDetailsElement) || !details.open) return;
        if (docView.translatedCount === 0) return; // Si no está traducido el doc, no hacemos nada

        const innerBlocks = collectBlocks(details, adapter.blockSelector, adapter.protection);
        if (innerBlocks.length > 0) {
          void translateBlocksList(innerBlocks);
        }
      },
      true,
    );

    // 2. MutationObserver para elementos montados después por React
    const observer = new MutationObserver((mutations) => {
      if (docView.translatedCount === 0) return;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.classList?.contains('cpt-root') || node.classList?.contains('cpt-attribution')) {
            continue;
          }
          const newlyAdded = collectBlocks(node, adapter.blockSelector, adapter.protection);
          if (newlyAdded.length > 0) {
            void translateBlocksList(newlyAdded);
          }
        }
      }
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  // ─── Ciclo de vida y SPA (T41) ──────────────────────────────────────────────

  async function init() {
    const root = await waitForElement(rootSelector);
    if (!root) return;

    currentRoot = root as HTMLElement;
    ensureUi();
    setupStateObservers(currentRoot);
  }

  if (adapter.documentation?.spaNavigation) onSpaNavigate(async (_newHref) => {
    // Cancelar cola y observadores en curso
    activeQueue?.cancel();
    activeQueue = null;
    sectionObserver?.disconnect();
    sectionObserver = null;
    docView.clear();

    // Esperar a que Next.js monte el nuevo contenido
    const newRoot = await waitForElement(rootSelector, 6000);
    if (!newRoot) return;

    currentRoot = newRoot as HTMLElement;
    setupStateObservers(currentRoot);

    if (autoTranslateNextNav) {
      // Si el usuario ya venía traduciendo en la sesión, re-aplicamos con caché
      void handleTranslateClick();
    } else {
      setUi('idle');
    }
  });

  void init();
}
