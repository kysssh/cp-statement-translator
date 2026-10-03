# DEV-LOG

Bitácora del desarrollo. Una entrada por tarea, con lo medido y lo aprendido.

---

## T31 — Etiquetar `v1.0` y crear la rama

- `npm run check` (tsc + 41 tests) y `npm run build` en verde **antes** de etiquetar.
- Había un cambio sin commitear en `src/manifest.json` (soporte de subdominios de
  Codeforces y de `group contests`). Commiteado antes del tag para que `v1.0` lo incluya.
- `git tag v1.0` + rama `feat/docs-sites`.
- Línea base: 41 tests, 4 ficheros de test.

## T32 — Reconocimiento del DOM de USACO Guide

Reconocido con navegador headless sobre `/silver/prefix-sums`, `/silver/binary-search`
y `/general/usaco-faq`. Detalles completos en `NOTAS-DOM.md`.

Hallazgos que cambian el diseño:

| Hallazgo | Consecuencia |
|---|---|
| El contenido está en `div.markdown` (uno solo por página); `main` es el shell de Next.js y contiene el menú | El adaptador debe usar `.markdown`, no `article`/`main` |
| Las fórmulas son KaTeX envueltas en `.language-math` | Lo opaco es `.language-math`, **no** `.katex` (el MathML está dentro) |
| No hay MathJax ni LaTeX sin renderizar (0 `mjx-container`) | No hace falta `rawMathPattern` |
| Código inline con clase estable `code.inline-code` (52 ocurrencias en `usaco-tablas`) | Es el caso que más fuerza al diseño de placeholders |
| Es SPA de Next.js: navegar **reconstruye** `.markdown` y los residuos de pruebas fueron 0 | T41 es necesario, no preventivo |
| Escribir en `<p>`, `<h2>`, `<td>`, `<summary>` **no** lo revierte React | No hace falta un observador agresivo; solo para contenido que se monta después |
| Los `<details>` no montan su contenido hasta abrirse | `MutationObserver` hace falta, aunque hoy solo haya `Show Tags` |
| No hay pestañas de código (`0 [role="tab"]`) | T45 se simplifica en USACO |

**Decisión tomada:** la tabla de problemas se **excluye entera**. Contiene seis tipos de texto no traducible (nombres con
`a.problem-list-item-anchor`, nivel, dificultad, tags, `Show Tags` y las cabeceras)
y solo uno de ellos tiene selector fiable; los demás dependen de la posición de la
columna, que es frágil. El costo de equivocarse es muy visible («Cow Dance Show»
traducido). Las tablas matemáticas sí se traducen: se distinguen porque las de
problemas llevan `class="no-markdown"` **y** una cabecera `Problem Name`.

## T33 — Fixtures de USACO

Capturados del sitio renderizado (no del fuente), con las fórmulas KaTeX ya generadas.

| Fixture | Origen | Bytes | Contenido |
|---|---|---|---|
| `usaco-corto.html` | `/general/usaco-faq` | 44 KB | 43 `<p>`, 22 `<li>`, 18 `.katex`, 0 código |
| `usaco-formulas.html` | `/silver/prefix-sums` | 112 KB | 24 `<p>`, 181 `.katex`, 6 tablas, 13 `details` |
| `usaco-tablas.html` | `/silver/binary-search` | 195 KB | 42 `<p>`, 20 `pre`, 52 `inline-code`, 3 tablas, 20 `details` |

## T34 — `estimateTokens()`

Heurística implementada en `src/core/estimate-tokens.ts`:

- **Entrada**: `ceil(caracteres / 4)`.
- **Salida**: `ceil(tokens_entrada * 1.15)`.

Corrección sobre el modelo inicial: lo primero era dividir la salida por un factor
mayor (4,5 car/token), pensando que el español necesita más tokens. El test lo
detectó y tenía razón: dividir por un factor mayor da *menos* tokens. El modelo
correcto es que el español ocupa **más caracteres** para el mismo contenido, así
que el ajuste va en el numerador.

**Pendiente de medir** (requiere una key de Groq): contrastar el estimado contra el
campo `usage` de 3–4 respuestas reales y anotar la desviación. Si pasa del ~20 %,
ajustar `CHARS_PER_TOKEN`.

## T35 — `chunkBlocks()`

Agrupador voraz y secuencial en `src/core/chunker.ts`. Nunca parte un bloque; un
bloque mayor que el presupuesto va solo en su lote; conserva el orden; cada lote
recuerda los índices originales.

**Medidas reales sobre los fixtures** (selector `.markdown p, li, h2, h3`;
`opaqueSelector: pre, code, .language-math, img, svg, table`):

| Fixture | Bloques | Tokens entrada | Tokens salida (est.) | Coste de una sola petición |
|---|---|---|
| `usaco-corto` | 85 | 2 898 | 3 371 | 6 273 |
| `usaco-formulas` | 24 | 760 | 886 | 1 650 |
| `usaco-tablas` | 47 | 1 247 | 1 461 | 2 712 |

Consecuencias para el presupuesto (limitación de Groq: 8 000 tokens/min):

| Presupuesto | `usaco-corto` | `usaco-formulas` | `usaco-tablas` |
|---|---|---|---|
| 1 500 | 3 lotes | 1 lote | 2 lotes |
| 3 000 | 2 lotes | 1 lote | 1 lote |
| 4 000 | 1 lote | 1 lote | 1 lote |

Conclusión: **3 000 tokens de entrada por lote** es un buen punto de partida. Con el
prompt del sistema (≈500 tokens), entrada y salida, un lote ronda los 4 000 tokens
consumidos, así que caben unas dos peticiones por minuto dentro del límite de Groq
— exactamente lo que dice la guía.

Aviso: `usaco-corto` tiene 85 bloques y 2 898 tokens, o sea bloques muy cortos
(listas y celdas). Un artículo del Guide es del orden de **2–3 peticiones**, no una.
Esto confirma que la cola (T36) es necesaria desde el principio.

## T36 — Cola con límite de tasa (desde el content script)

Dos piezas nuevas, más una ampliación de `groq.ts`:

- `src/shared/rate-limit.ts` — lectura de las cabeceras de Groq (función pura).
- `src/content/queue.ts` — `TranslationQueue`, la cola que vive en el content script.
- `groq.ts` gana `translateBatch()`: traduce **un** lote y devuelve la cuota.

**Decisión de diseño (la importante):** la cola vive en el **content script**, no en
el service worker. En MV3 el service worker se detiene tras un rato sin actividad, y
una cola que espere decenas de segundos dentro de él puede morir a mitad de artículo.
El content script sigue vivo mientras la pestaña esté abierta; el service worker
recibe un lote, hace un `fetch` y responde. Queda sin estado.

### Lo que dice la documentación de Groq (verificado, no supuesto)

Consultado en https://console.groq.com/docs/rate-limits:

| Cabecera | Significado |
|---|---|
| `retry-after` | Segundos a esperar. **Solo se envía con un 429.** |
| `x-ratelimit-limit-requests` | Peticiones por día permitidas |
| `x-ratelimit-remaining-requests` | Peticiones por día restantes |
| `x-ratelimit-reset-requests` | Tiempo al reinicio diario, formato `2m59.56s` |
| `x-ratelimit-limit-tokens` | Tokens por minuto permitidos |
| `x-ratelimit-remaining-tokens` | Tokens por minuto restantes |
| `x-ratelimit-reset-tokens` | Tiempo al reinicio por minuto, formato `7.66s` |

Dos descubrimientos que cambian el diseño:

1. **El límite diario se cuenta en PETICIONES, no en tokens.** Son 1 000 al día.
   Un artículo de 3 lotes no es un problema; encadenar muchos sí.
2. **Los tokens en caché no cuentan** para el límite, así que si el prompt del
   sistema va primero y es idéntico en cada llamada, el consumo real puede ser
   menor de lo calculado. Pendiente de medir con las cabeceras (ver T39).

El formato de duración (`2m59.56s`, `7.66s`) necesita su propio parser; `Number()`
no lo entiende. Está en `parseDurationMs()`, con tests para `7`, `7.66`, `2m59.56s`
y `1h0m0s`.

### Comportamiento de la cola

1. Antes de cada lote, comprueba si cabe en la cuota restante (con un margen del 15 %).
   Si no cabe, duerme hasta el reinicio que indiquen las cabeceras.
2. Envía el lote. Si Groq responde 429, espera lo que diga `retry-after` y reintenta
   ese mismo lote, hasta `maxAttempts` (3 por defecto).
3. Si el error **no** es un 429 (key inválida, modelo inexistente), no reintenta: son
   errores que no se arreglan esperando.
4. Aplica cada lote **cuando llega**, no al final, para que el usuario vea avanzar.
5. `cancel()` se comprueba entre lotes: lo ya traducido se queda, el resto sigue en
   inglés (degradación elegante).

La cola no bloquea esperando si las cabeceras no vienen (`hasRoomFor` devuelve `true`
sin `remainingTokens`), porque de lo contrario se pararía sola con proveedores que no
las envían.

### Verificación

`tests/queue.spec.ts`, 18 tests con un proveedor falso: 10 lotes se envían en orden
sin saltar ninguno; un 429 provoca espera y reintento del **mismo** lote sin perderlo;
agotar los reintentos da un error claro y para la cola; un error que no es 429 no se
reintenta; la espera por cuota ocurre antes de enviar; cancelar a mitad aplica 3 de 10
y no envía el resto; cada lote se aplica al llegar.

**Pendiente:** probar contra Groq real con tu key. En particular, comparar
`x-ratelimit-remaining-tokens` antes y después de un artículo real, para ver si el
prompt cacheado reduce el consumo y si la desviación de `estimateTokens` supera
el 20 %.

---

## T37 — Progreso y cancelación

- Integración en `src/content/button.ts` y `src/content/queue.ts`.
- Muestra el avance dinámico: `"Traduciendo 3/8 lotes…"`.
- Botón de cancelación (`cpt-cancel` con icono `x`) visible durante la traducción.
- Cancelación reactiva: la cola comprueba el flag `cancelled` antes de cada lote. Lo traducido hasta ese momento se conserva intacto en el DOM.

## T38 — Caché por bloque individual

- Módulo implementado en `src/content/block-cache.ts`.
- Clave de caché = `cpt:b:${fnv1a(sourceText)}:${glossaryVersion}`. Si cambia la versión del glosario o prompt, los bloques viejos se invalidan automáticamente.
- Función `partitionByCache(sources, cache)` que separa hits (se aplican al instante sin consumir red ni tokens) y misses (únicos que se envían a la cola).
- Limpieza LRU simple con límite de 2 000 entradas para evitar desbordar el almacenamiento local de la extensión.
- Tests en `tests/block-cache.spec.ts`.

## T39 — Glosario y prompt para documentos

- Implementado en `src/shared/doc-prompt.ts`.
- Glosario técnico versionado (`DOC_GLOSSARY_VERSION = 'v1.0'`).
- Política decidida: términos canónicos de algoritmos y estructuras de datos (Segment Tree, BFS, Dijkstra, Trie, etc.) se mantienen en inglés; la prosa explicativa se traduce con registro didáctico y natural.
- Preservación estricta de marcadores `⟦n⟧` y fórmulas LaTeX.

## T40 — Requisitos declarados en el adapter

- `SiteAdapter` extendido con campos opcionales `contentType: 'problem' | 'doc'` y `requiresGroq: boolean`.
- En el service worker (`src/background/service-worker.ts`), `handleDocBatch` verifica que Groq esté configurado con una API key válida, mostrando un mensaje descriptivo si no lo está.
- Compatibilidad retroactiva completa: Codeforces y CSES continúan compilando y funcionando sin alteraciones.

## T41 — Reaplicar la traducción tras navegar (SPA)

- Implementado en `src/content/navigation.ts`.
- Soporte para Navigation API (`navigation.addEventListener('navigatesuccess')`) con fallback a `MutationObserver` y hook de `history.pushState`.
- Al navegar en la SPA de USACO Guide (Next.js):
  1. Cancela cualquier cola activa.
  2. Espera a que Next.js monte el nuevo contenedor `.markdown`.
  3. Restablece la UI en `document.body` (que sobrevive al reemplazo del DOM).
  4. Si el usuario ya estaba traduciendo, re-aplica usando la caché sin costo de tokens.

## T42 — Adapter `usaco.ts`

- Implementado en `src/adapters/usaco.ts` según las especificaciones de `NOTAS-DOM.md`.
- Contenedor: `.markdown`.
- Bloques traducibles: `p`, `li`, `h2`, `h3`, `h4`, `td`, `th`, `blockquote`.
- Elementos opacos: `.language-math`, `.math-display`, `pre`, `.prism-code`, `code.inline-code`, `img`, `svg`, `button`, `a.anchor`, `span.absolute`, `details > summary`, `table.no-markdown`.
- Las tablas de problemas (`table.no-markdown`) quedan completamente excluidas para evitar traducir nombres de problemas o etiquetas sensibles.

## T43 — Content script de documentos y manifest

- Punto de entrada separado `src/content/docs.ts` en `src/manifest.json` emparejado con `https://usaco.guide/*`.
- El script de problemas (`index.ts`) no se ejecuta en USACO Guide, manteniendo el aislamiento entre sitios de problemas y documentación.
- Estilos integrados en `ui.css` con anclaje flotante `position: fixed` para no interferir con la maquetación de Next.js.

## T44 — Round-trip sobre los fixtures de USACO

- Suite de pruebas en `tests/protector.usaco.spec.ts` sobre `usaco-corto.html`, `usaco-formulas.html` y `usaco-tablas.html`.
- 9 tests pasando:
  - `restore(extract())` preserva exactamente texto e identidad de nodos protegidos.
  - El texto a traducir no filtra clases de KaTeX ni código opaco.
  - Simulación de pipeline `[ES]` preserva intactas fórmulas KaTeX, bloques `pre` y tablas de problemas.

## T45 — Componentes con estado (desplegables y mutaciones)

- Manejo de `<details>` en `src/content/docs.ts` mediante listener del evento `toggle` en fase de captura. Al expandirse un desplegable, si el documento está en español, extrae y traduce sus bloques de texto internos.
- `MutationObserver` supervisa la inserción de nuevos elementos dinámicos dentro de `.markdown`.
- Exclusión segura de tablas de problemas ya validada.

## T46 — Traducción por sección y bajo demanda (scroll)

- Módulo `src/content/sections.ts` con `splitIntoSections(blocks)` por encabezados `<h2>`.
- `SectionObserver` basado en `IntersectionObserver` con `rootMargin: '300px 0px'` para pre-cargar y traducir automáticamente las secciones que van entrando en pantalla.
- Selector de modo en la barra de la UI: `[ Todo | Al leer ]`.
- En modo "Al leer", el consumo de cuota de Groq se reduce drásticamente al traducir solo las secciones consultadas por el usuario.

## T47 — Atribución y toggle EN ↔ ES en documentos largos

- Módulo `src/content/doc-view.ts` con `DocTranslationView`.
- Instantáneo e idempotente: guarda clones del DOM original antes de reemplazar y los clones traducidos después. Permite alternar entre EN y ES en cualquier instante sin re-consultar a Groq ni re-ejecutar `restore()`.
- Aviso de atribución y licencia generado automáticamente al final del artículo con `ensureDocAttribution()`:
  *"Traducción automática generada con IA. Contenido original de USACO Guide, bajo licencia CC BY-NC-SA 4.0."*

## T48 — Reconocimiento de CP-Algorithms (2026-10-03)

- Inspeccionados Euclidean Algorithm, Segment Tree y Breadth First Search con Chrome headless, tras renderizar MathJax.
- Guardados tres fixtures reales en `tests/fixtures/cpalgorithms-*.html`, informe JSON y script reproducible `tools/inspect-cpalgorithms.mjs`.
- Raíz comprobada: `article.md-content__inner`. Proteger `.arithmatex`, código, anclas, metadatos y controles de pestañas.
- El cambio de pestaña conserva el DOM y texto editado. Navegar a otro artículo recarga el documento (experimento con variable global).
- Detalles, límites de la muestra y puntos de integración en `NOTAS-DOM.md`, sección CP-Algorithms — T48.
- Base verificada: `npm run check`, TypeScript y 96 pruebas en 11 archivos, todo correcto.
- Sin cambios en el código de la extensión. T49 pendiente del visto bueno del usuario.

## T49 — Adapter CP-Algorithms e integración (2026-10-03)

- Añadido `src/adapters/cpalgorithms.ts`: raíz `article.md-content__inner`, prosa y encabezados, protección de `.arithmatex`, MathJax, código, anclas, metadatos y controles de pestañas. Regex de respaldo para LaTeX sin renderizar.
- Registrado el adapter y añadido `https://cp-algorithms.com/*` al content script de documentos en el manifest. El script de problemas de CF/CSES conserva sus rutas.
- `docs.ts` selecciona el adapter por sitio para raíz, segmentación, protección y atribución. La configuración de USACO mantiene `.markdown` y navegación SPA; CP-Algorithms utiliza la recarga normal comprobada en T48.
- Atribución específica de CP-Algorithms: CC BY-SA 4.0. USACO mantiene CC BY-NC-SA 4.0.
- Glosario ampliado con términos de teoría de números y consultas de rango; versión 2 para renovar la caché de documentos según el nuevo glosario. La caché de enunciados no cambia.
- Las nuevas pruebas de integración detectaron un defecto previo: `restore()` movía fórmulas y código antes de guardar la copia original en `applyBlock()`. Se llama a `recordOriginal()` antes de reconstruir cualquier traducción. Verificado EN/ES con fórmulas y código tanto en CP-Algorithms como en USACO, y con caché en CP-Algorithms.
- Verificación final: `npm run check` pasó, TypeScript y 108 pruebas en 12 archivos (incluye las 96 existentes); `npm run build` pasó y regeneró `dist`; `git diff --check` sin errores de espacios.
- Las pruebas usan traducción simulada, sin consumir cuota. No se ha probado todavía la traducción real con Groq en el navegador ni todos los casos especiales: corresponden a T50/T51.
- T49 terminada. T50 pendiente del visto bueno del usuario.

## T50 — Round-trip y casos especiales de CP-Algorithms (2026-10-03)

- Nueva suite `tests/protector.cpalgorithms.spec.ts`: round-trip sobre las tres capturas reales de T48, seguido de traducción simulada de todos los bloques seleccionados. Comprueba texto, identidad y HTML de nodos opacos y atributos de enlaces.
- Fixture adicional `cpalgorithms-casos-sinteticos.html`, identificado expresamente como sintético: avisos, detalles con summary, tablas, pestañas con prosa, enlaces con formato, código inline y las cuatro formas de LaTeX sin renderizar. Verificados los controles seleccionados, estado abierto, listeners de copiar/toggle y tres ciclos EN/ES.
- Fallos reales corregidos en el adapter: anclas vacías con atributo name ahora son opacas; se conservan los nodos br; summary se incluye como bloque traducible. No se cambiaron los selectores de CF, CSES ni USACO.
- Nuevas pruebas de integración para respuestas sin marcadores desde API y caché. Una respuesta inválida de API conserva el bloque original. Se detectó que docs.ts aplicaba la caché sin validación: ahora normaliza y valida marcadores, y una entrada incompleta se convierte en pendiente para retraducir sin perder fórmulas ni código. Esta protección también cubre USACO.
- Verificación final: `npm run check`, TypeScript y 117 pruebas en 13 archivos, todas correctas (incluye CF, CSES y USACO); `npm run build` correcto, dist actualizado; `git diff --check` sin errores de espacios.
- La prueba completa del fixture de Segment Tree dispone de 60 segundos porque el DOM renderizado de MathJax es grande. No se eliminó ni redujo ninguna comprobación.
- Las traducciones de estas pruebas son simuladas y no consumen Groq. La navegación con la extensión en navegador corresponde a T51.
- T50 terminada. T51 pendiente del visto bueno del usuario.

## T51 — Navegación con la extensión cargada (2026-10-03)

- Verificación reproducible: `node tools/verify-cpalgorithms-navigation.mjs`. Usa Chromium compatible con extensiones unpacked (ruta local predeterminada o variable CPT_TEST_BROWSER), dist y un perfil temporal independiente. No utiliza el perfil ni claves personales.
- Extensión real de dist cargada en Chromium 153.0.8010.12. Se simula exclusivamente la respuesta HTTP de Groq dentro de su service worker de prueba; content script, mensajes, cola, validación y almacenamiento son los reales. El prefijo [T51] indica contenido simulado, no una traducción de calidad evaluada.
- 10 comprobaciones aprobadas: montaje inicial único; traducción por el worker real; cambio de pestaña de código; enlace hash de encabezado; alternancia EN/ES conservando la pestaña; cambio de artículo mediante enlace real; traducción del artículo nuevo; recarga con caché persistente; regreso por historial con UI funcional; ausencia de errores de ejecución y consola.
- BFS a Binary Exponentiation recarga el documento: desaparece la variable de prueba, aparece una única UI en estado idle y funciona la traducción del artículo nuevo. No se necesita modificar navigation.ts.
- Recarga y regreso por historial recuperaron los bloques desde caché sin solicitudes adicionales. Total: dos respuestas HTTP simuladas, lotes de 48 y 64 bloques. Cero llamadas reales a Groq.
- Informe completo: `tools/cpalgorithms-navigation-report.json` (passed: true, 0 excepciones y 0 errores de consola).
- Esta etapa no modifica src, manifest ni dist. Se usa la compilación verificada en T50; su base de TypeScript y 117 pruebas permanece registrada allí. `git diff --check` sin errores de espacios.
- Límite: no se verifica aquí calidad ni disponibilidad de Groq real. No se cambian las rutas de CF, CSES o USACO.
- T51 terminada. T52 (README, versión y cierre) pendiente del visto bueno del usuario.

## T52 — README, mediciones y cierre v1.1 (2026-10-03)

- README actualizado para CF, CSES, USACO Guide y CP-Algorithms: instalación/actualización, proveedor para cada sitio, modos Todo/Al leer, caché, navegación, atribuciones y limitaciones de cobertura.
- Límites de Groq verificados en su documentación oficial el 2026-10-03: para GPT-OSS 120B/20B gratuitos, 30 RPM, 1 000 RPD, 8 000 TPM y 200 000 TPD; los límites exactos dependen de la organización/modelo. Fuente: https://console.groq.com/docs/rate-limits. Corregido el comentario antiguo de rate-limit.ts que negaba la existencia de límite diario de tokens; la lógica de cuota no cambia.
- Medición reproducible offline: `node tools/measure-document-tokens.mjs`. Usa los adapters, protector, chunker y estimador reales, sin generar código ni contactar APIs. Informe: `tools/document-token-estimates.json`.

| Fixture | Bloques | Lotes | Entrada estimada | Salida estimada | Total estimado |
|---|---:|---:|---:|---:|---:|
| usaco-corto | 97 | 1 | 3 813 | 3 469 | 7 282 |
| usaco-formulas | 24 | 1 | 1 489 | 761 | 2 250 |
| usaco-tablas | 49 | 1 | 2 001 | 1 360 | 3 361 |
| cpalgorithms-corto | 35 | 1 | 2 004 | 1 355 | 3 359 |
| cpalgorithms-codigo | 215 | 5 | 16 398 | 14 146 | 30 544 |
| cpalgorithms-pestanas | 48 | 1 | 2 492 | 1 926 | 4 418 |

Estas cifras son heurísticas: 4 caracteres/token, salida +15 %, presupuesto de bloques de 3 000 tokens y prompt de 837 tokens repetido en cada lote. No incluyen JSON adicional, razonamiento, reintentos ni ahorro por caché de prompt del proveedor. No son uso medido de Groq. El consumo real de las validaciones T48-T52 fue cero tokens del proveedor; una revisita completamente cubierta por la caché tampoco requiere una llamada.

- Versión 1.1.0 sincronizada en package.json, package-lock.json y manifest. El lockfile solo cambia sus dos campos de versión; no cambian dependencias.
- `npm run zip` toma el nombre desde package.json a través de tools/package-extension.mjs y verifica que coincida con dist/manifest.json. Generado cp-statement-translator-v1.1.0.zip. El archivo mantiene la raíz lista para Cargar descomprimida.
- Verificación final: `npm run check`, TypeScript y 117 pruebas en 13 archivos, todas aprobadas; `npm run zip` incluye compilación correcta; ZIP íntegro y contenido idéntico a dist, manifest 1.1.0 y rutas de los sitios verificadas; `git diff --check` sin errores de espacios. La verificación T51 registra 10 comprobaciones aprobadas con extensión cargada y Groq simulado.
- Cierre local con commit de implementación/documentación y etiqueta v1.1 conforme a la guía. T48-T52 completadas. No se evaluó la calidad de Groq real; esa limitación queda explícita en el README.

Las capturas HTML preservan los espacios originales, incluidos los de bloques de código; .gitattributes excluye esos fixtures de los avisos de whitespace de Git. El código y la documentación sí se revisan con diff --check.
