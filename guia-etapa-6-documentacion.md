# Guía — Etapa 6 en adelante: traducir documentación (USACO Guide primero, luego CP-Algorithms)

Continuación de `guia-de-implementacion.md` (T01–T30). Mismo formato, mismas reglas: la regla de los 20 minutos, los cuatro niveles de ayuda, la plantilla de preguntas (§1.2 de la guía original), un commit por tarea y bitácora en `DEV-LOG.md`.

**Supuesto:** trabajas en el **mismo repositorio**, en una rama aparte (opción A de la conversación). Si prefieres un fork, las tareas son idénticas; solo cambia el comando de T31.

---

## Lo que ya sabes (tus propios experimentos)

| Hecho | Qué implica |
|---|---|
| Un texto editado a mano en un párrafo de usaco.guide **se mantuvo** al cambiar de modo, de pestaña de código y al abrir un desplegable, sin errores | Puedes modificar el DOM en ese sitio; no hace falta traducir en un contenedor aparte (todavía) |
| Ese texto **desapareció** al navegar a otro módulo y volver | La traducción no sobrevive a la navegación. Hay que detectar el cambio de página y volver a aplicarla (T41) |
| Groq (plan gratuito, `gpt-oss-120b`): 30 peticiones/min, 1 000/día, **8 000 tokens/min**, 200 000 tokens/día | Un documento largo no cabe en una sola petición. Hacen falta lotes y una cola (T34–T36) |

> Las cifras de Groq son las de su documentación a septiembre de 2026 y se aplican por organización, no por key. La página de límites de tu cuenta es la autoridad: https://console.groq.com/docs/rate-limits

**Lo que NO sabes todavía** (y las tareas de reconocimiento resuelven): la estructura real del DOM de USACO y CP-Algorithms, y cómo se comportan los componentes con estado (pestañas, desplegables, tablas de problemas) cuando contienen texto traducido. Esta guía no inventa selectores: te dice cómo encontrarlos.

---

## Mapa

| # | Tarea | Dif. | Tiempo | Depende |
|---|---|---|---|---|
| **Etapa 6 — Preparación** ||||
| T31 | Etiquetar `v1.0` y crear la rama | 🟢 | 20 min | — |
| T32 | Reconocimiento del DOM de USACO Guide | 🟡 | 60 min | T31 |
| T33 | Fixtures de USACO | 🟢 | 30 min | T32 |
| **Etapa 7 — Infraestructura para documentos largos** ||||
| T34 | `estimateTokens()` | 🟢 | 30 min | T31 |
| T35 | `chunkBlocks()` — lotes con presupuesto | 🟡 | 60 min | T34 |
| T36 | Cola con límite de tasa (desde el content script) | 🔴 | 90 min | T35 |
| T37 | Progreso y cancelación | 🟡 | 60 min | T36 |
| T38 | Caché por bloque | 🟡 | 45 min | T36 |
| T39 | Glosario y prompt para documentos | 🟡 | 90 min | T36 |
| T40 | Requisitos declarados en el adapter | 🟡 | 40 min | T39 |
| T41 | Reaplicar la traducción tras navegar (SPA) | 🔴 | 75 min | T37, T38 |
| **Etapa 8 — USACO Guide** ||||
| T42 | Adapter `usaco.ts` | 🟡 | 60 min | T33, T40 |
| T43 | Content script de documentos y manifest | 🟢 | 45 min | T42 |
| T44 | Round-trip sobre los fixtures de USACO | 🔴 | 60 min | T42 |
| T45 | Componentes con estado: pestañas, desplegables, tablas | 🔴 | 90 min | T44, T41 |
| T46 | Botón, traducción por sección y bajo demanda | 🟡 | 90 min | T45 |
| T47 | Atribución y toggle EN ↔ ES en documentos largos | 🟡 | 45 min | T46 |
| **Etapa 9 — CP-Algorithms** ||||
| T48 | Reconocimiento del DOM de CP-Algorithms | 🟡 | 60 min | T47 |
| T49 | Adapter `cpalgorithms.ts` | 🟡 | 60 min | T48 |
| T50 | Round-trip y casos especiales | 🟡 | 60 min | T49 |
| T51 | Navegación en CP-Algorithms | 🟢 | 30 min | T50 |
| T52 | Cierre: README, `v1.1` y bitácora | 🟢 | 45 min | T51 |

**Total: ~20 horas.** La parte nueva de verdad (T34–T41) sirve para los dos sitios; si USACO sale bien, CP-Algorithms es casi configuración.

---

# Etapa 6 — Preparación

### T31 — Etiquetar `v1.0` y crear la rama
🟢 Fácil · ⏱ 20 min · 📁 repositorio · ⬅ —

**🎯 Qué construyes**
Un punto de retorno seguro: tu extensión de problemas queda congelada y marcada.

**🧠 Conceptos previos**
Git tag · Rama (branch) 📖 (Git/repositorio)

**🔨 Cómo atacarlo**
1. `npm run test` y `npm run build`: ambos deben pasar **antes** de etiquetar. Etiquetar algo roto no sirve.
2. `git tag v1.0`
3. `git switch -c feat/docs-sites`
4. Prueba la extensión de problemas una vez más a mano en Codeforces y CSES. Anota en la bitácora que es la línea base.

**✅ Verificación**
`git tag` muestra `v1.0` y `git branch` te marca parado en `feat/docs-sites`.

**💬 Si te atascas**
> "T31: no sé cómo volver a v1.0 si rompo algo. ¿Qué comando uso y qué pierdo?"

---

### T32 — Reconocimiento del DOM de USACO Guide
🟡 Media · ⏱ 60 min · 📁 `NOTAS-DOM.md` (sección nueva) · ⬅ T31

**🎯 Qué construyes**
El equivalente de T02: notas con los selectores **reales**. La tecnología del sitio (React, Gatsby, MDX, KaTeX) la conoces por su repositorio; la estructura concreta del DOM no, y no hay que suponerla.

**🧠 Conceptos previos**
Hidratación (React) · Componente con estado · KaTeX 📖 (LaTeX/MathJax) · Selector CSS 📖

**🔍 Investiga primero**
- Cómo se ve el DOM de un módulo en el panel Elements: ¿hay un contenedor claro del contenido (`main`, `article`) separado de la barra lateral, el índice y la cabecera?
- https://katex.org/docs/output — qué HTML genera KaTeX (`.katex`, `.katex-mathml`, `.katex-html`)

**🔨 Cómo atacarlo**
1. Abre un módulo de contenido, otro con muchas fórmulas y otro con tablas de problemas.
2. Pega esta sonda en la consola (es genérica, no asume nada de USACO):

```js
(() => {
  const root = document.querySelector('article') || document.querySelector('main');
  if (!root) return console.warn('No encontré raíz; inspecciona a mano');
  const n = (s) => root.querySelectorAll(s).length;
  console.log('Raíz:', root.tagName, root.className);
  console.table({
    'pre': n('pre'),
    'code dentro de pre': n('pre code'),
    'code inline': [...root.querySelectorAll('code')].filter(c => !c.closest('pre')).length,
    '.katex': n('.katex'),
    'mjx-container': n('mjx-container'),
    'table': n('table'),
    'details': n('details'),
    'h2-h4': n('h2, h3, h4'),
    'p': n('p'),
    'li': n('li'),
    'img/svg': n('img, svg'),
  });
  const tags = new Set();
  root.querySelectorAll('p *, li *').forEach(e => {
    const cls = typeof e.className === 'string' && e.className.trim()
      ? '.' + e.className.trim().split(/\s+/).join('.') : '';
    tags.add(e.tagName.toLowerCase() + cls);
  });
  console.log('Inline dentro de p/li:',
    [...tags].filter(t => !t.includes('katex') && !/^(svg|path|g)\b/.test(t)));
})();
```
3. Responde por escrito en `NOTAS-DOM.md`:
   - ¿Cuál es el contenedor del contenido? ¿Qué hay **fuera** de él que no quieres traducir (menú, índice, pie)?
   - ¿Cómo se estructura una fórmula `.katex`? ¿Hay un contenedor externo con una clase tipo `math`?
   - ¿Cómo es un bloque de código? ¿Y uno con pestañas de lenguaje?
   - ¿Cómo es una tabla de problemas? ¿Qué texto de ahí **no** debe traducirse (nombres de problema, etiquetas)?
   - ¿Los desplegables (soluciones, pistas) tienen su contenido en el DOM aunque estén cerrados, o aparece solo al abrirlos? Compruébalo inspeccionando uno cerrado.
4. **Segundo experimento de hidratación.** El que hiciste tocó un párrafo suelto. Repítelo sobre un párrafo **dentro** de un desplegable abierto, y sobre uno dentro del contenido de una pestaña, y luego cierra/abre y cambia de pestaña. Es lo que más probablemente re-renderiza React.

**✅ Verificación**
`NOTAS-DOM.md` responde las cinco preguntas con selectores concretos y anota el resultado del segundo experimento.

**💬 Si te atascas**
> "T32: esta es la salida de la sonda en usaco.guide: `<pega>`. ¿Qué pondrías en `blockSelector` y en `opaqueSelector`, y por qué?"

---

### T33 — Fixtures de USACO
🟢 Fácil · ⏱ 30 min · 📁 `tests/fixtures/` · ⬅ T32

**🎯 Qué construyes**
Tres HTML reales guardados: uno corto, uno cargado de fórmulas y código, uno con tablas de problemas y desplegables.

**🔨 Cómo atacarlo**
Igual que T03: selecciona el contenedor en Elements y `copy($0.outerHTML)`; pégalo en `tests/fixtures/usaco-corto.html`, `usaco-formulas.html`, `usaco-tablas.html`.

**✅ Verificación**
Abres cada archivo en el navegador y se ve el contenido, con las fórmulas y el código en su sitio.

**💡 Limitación a tener presente:** jsdom no ejecuta React. Los fixtures sirven para probar `extract()` y `restore()` sobre el HTML ya renderizado, no el comportamiento del sitio en vivo; eso solo se prueba en el navegador real.

---

# Etapa 7 — Infraestructura para documentos largos

> Todo lo de esta etapa es **código nuevo en archivos nuevos**, salvo T40 (que añade campos *opcionales* al adapter). `codeforces.ts` y `cses.ts` no se tocan.

### T34 — `estimateTokens()`
🟢 Fácil · ⏱ 30 min · 📁 `src/core/tokens.ts` · ⬅ T31

**🎯 Qué construyes**
Una función pura que estima cuántos tokens tiene un texto, para decidir cuántos bloques caben en un lote.

**🧠 Conceptos previos**
Token (modelo de IA) 📖 · TPM / TPD · Función pura 📖

**🔨 Cómo atacarlo**
1. Para inglés, una aproximación común es del orden de 4 caracteres por token. Es una **heurística**, no un dato exacto.
2. Hazla pura y con un test. Antes de fiarte, compárala con el campo `usage` de la respuesta de Groq en 3–4 peticiones reales (comprueba que tu respuesta lo trae; el formato es compatible con OpenAI).
3. Anota en la bitácora cuánto se desvía. Si falla más de ~20 %, ajusta el factor.

**✅ Verificación**
Tests de la función, y una tabla en `DEV-LOG.md` con "estimado vs. real" de al menos tres textos.

---

### T35 — `chunkBlocks()` — lotes con presupuesto
🟡 Media · ⏱ 60 min · 📁 `src/core/chunker.ts` · ⬅ T34

**🎯 Qué construyes**
Una función pura que recibe los textos extraídos (ya con marcadores) y los agrupa en lotes que no superen un presupuesto de tokens.

**🧠 Conceptos previos**
Algoritmo voraz (agrupar secuencialmente) · Índices para remapear resultados

**🔨 Cómo atacarlo**
1. Calcula el presupuesto **con cuentas**. Cada petición gasta tokens de entrada (prompt del sistema con el glosario + los bloques) y de salida (la traducción, de tamaño parecido a la entrada). Con 8 000 tokens/min, un lote de ~1 500 tokens de bloques más ~500 del prompt y ~1 800 de salida ronda los 3 800: caben unas dos peticiones por minuto. Haz tus propios números con T34 y apúntalos.
2. Reglas del agrupador: nunca partir un bloque; un bloque más grande que el presupuesto va solo en su lote; el orden se conserva; cada lote recuerda los **índices originales** de sus bloques para poder colocar las traducciones.
3. Tests: lista vacía, un solo bloque enorme, bloques justo en el límite, orden preservado.

**✅ Verificación**
Con un fixture grande, la suma de los lotes reconstruye la lista original, ninguno supera el presupuesto, y los índices coinciden.

**💬 Si te atascas**
> "T35: no sé cómo recordar los índices originales de cada bloque al agrupar. Dame una pista de la estructura de datos."

---

### T36 — Cola con límite de tasa, desde el content script
🔴 Difícil · ⏱ 90 min · 📁 `src/content/queue.ts`, `src/background/providers/groq.ts` · ⬅ T35

**🎯 Qué construyes**
Un procesador que envía los lotes **uno a uno**, espera lo necesario entre ellos y reintenta si Groq responde 429.

**🧠 Conceptos previos**
Rate limit 📖 · Backoff exponencial 📖 · async/await 📖 · Ciclo de vida del service worker

**🔍 Investiga primero**
- https://console.groq.com/docs/rate-limits — sección de cabeceras y "Handling Rate Limits". Comprueba qué cabeceras manda (`x-ratelimit-remaining-tokens`, `x-ratelimit-reset-tokens`) y si incluye `retry-after` en los 429.
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — **léelo antes de diseñar nada**

**🔨 Cómo atacarlo**
1. **Decisión de diseño (importante):** en MV3 el service worker se detiene tras un rato sin actividad. Una cola que espere decenas de segundos *dentro* del service worker puede morir a mitad. Por eso la cola vive en el **content script**, que sigue vivo mientras la pestaña esté abierta, y envía **un mensaje por lote**. El service worker queda sin estado: recibe un lote, hace un `fetch` y devuelve texto más las cabeceras de límite. (Verifica este comportamiento en la documentación citada; no lo des por hecho.)
2. En `groq.ts`, devuelve junto a las traducciones lo que quedó de cuota (tokens restantes y tiempo hasta el reinicio, tal cual vengan en las cabeceras).
3. En la cola: antes de enviar el siguiente lote, comprueba si cabe en la cuota restante; si no, espera el tiempo de reinicio.
4. Ante un 429: espera (lo que indique la cabecera, o backoff exponencial si no hay) y reintenta ese lote, con un máximo de intentos.
5. Prueba la cola con un proveedor **falso** que simule 429 y cuotas bajas antes de tocar Groq de verdad.

**✅ Verificación**
Con el proveedor falso: 10 lotes se envían respetando la espera; un 429 forzado provoca reintento; superar el máximo de intentos produce un error claro. Luego, con Groq real, un artículo largo se traduce sin que ninguna petición falle por límite.

**💡 Para medir, no suponer:** el prompt del sistema se repite idéntico en cada petición. La documentación de Groq indica que su caché de prompts cubre los modelos GPT-OSS y que los tokens en caché no cuentan para el límite. Si tu prompt va primero y es idéntico, puede que gastes menos de lo calculado. Compruébalo con las cabeceras.

---

### T37 — Progreso y cancelación
🟡 Media · ⏱ 60 min · 📁 `src/content/queue.ts`, `src/content/button.ts` · ⬅ T36

**🎯 Qué construyes**
Un indicador "Traduciendo 3/8…" y la posibilidad de cancelar, con la página consistente en cualquiera de los dos casos.

**🔨 Cómo atacarlo**
1. La cola emite un evento tras cada lote (cuántos van, cuántos faltan). El botón lo muestra.
2. Cancelar: una bandera que la cola comprueba entre lotes. Lo ya traducido se queda; el resto sigue en inglés (degradación elegante, igual que en T25).
3. Aplica cada lote al DOM **cuando llega**, no al final: así el usuario ve avanzar la traducción.

**✅ Verificación**
En un documento largo ves aparecer el español por tramos; al cancelar a mitad no queda ningún bloque corrupto ni a medias.

---

### T38 — Caché por bloque
🟡 Media · ⏱ 45 min · 📁 `src/background/` o `src/shared/cache.ts` · ⬅ T36

**🎯 Qué construyes**
Una caché que guarda la traducción de cada **bloque**, no la de la página entera. Con 200 000 tokens/día es lo que hace viable revisitar documentos.

**🧠 Conceptos previos**
Hash / FNV-1a 📖 (ya lo hiciste en T28) · Caché 📖 · `chrome.storage.local` 📖

**🔨 Cómo atacarlo**
1. Clave = hash del texto fuente (con marcadores) **más** una versión del glosario. Si cambias el glosario o el prompt, la caché antigua deja de servir sola.
2. Antes de armar lotes, separa los bloques ya cacheados de los pendientes; solo los pendientes van a `chunkBlocks()`.
3. Cuidado con el tamaño: `chrome.storage.local` tiene un límite de cuota. Comprueba cuál es en la documentación y decide qué hacer al acercarte (por ejemplo, borrar lo más antiguo).

**✅ Verificación**
Traduces un módulo; lo recargas; la segunda vez no hay peticiones a Groq en la pestaña Network y el contador de tokens no se mueve.

---

### T39 — Glosario y prompt para documentos
🟡 Media · ⏱ 90 min · 📁 `src/shared/glossary.ts`, `src/shared/prompt.ts` · ⬅ T36

**🎯 Qué construyes**
El prompt del sistema específico para **documentación explicativa**, distinto del de enunciados, y el glosario que decide qué se traduce y qué no.

**🔨 Cómo atacarlo**
1. Decide la política antes de escribir nada, y apúntala: ¿`segment tree` se queda en inglés con explicación, o se traduce como "árbol de segmentos"? Lo habitual en esta literatura es dejar el nombre técnico en inglés. Decide tú, pero decide.
2. Escribe el glosario como datos (un objeto), no incrustado en el texto del prompt, para poder versionarlo (lo usa T38).
3. Reglas del prompt: copiar los marcadores `⟦n⟧` exactamente; no añadir ni quitar contenido; registro didáctico, más natural que el de un enunciado; los nombres de personas, algoritmos y problemas no se traducen.
4. Traduce 3 artículos y revisa a mano: cada error es una regla nueva en el glosario.

**✅ Verificación**
Los 3 artículos salen consistentes (un mismo término siempre igual) y sin marcadores alterados. Anota las reglas que tuviste que añadir.

---

### T40 — Requisitos declarados en el adapter
🟡 Media · ⏱ 40 min · 📁 `src/adapters/types.ts`, service worker · ⬅ T39

**🎯 Qué construyes**
Que un adapter pueda decir "yo necesito un proveedor con glosario", y que el sistema lo respete.

**🔨 Cómo atacarlo**
1. Añade campos **opcionales** a `SiteAdapter` (por ejemplo, el tipo de contenido —enunciado o documento— y si requiere prompt). Opcionales, para que `codeforces.ts` y `cses.ts` compilen sin cambios.
2. La interfaz `TranslationProvider` ya tiene `supportsPrompt`. Para sitios de documentos, el sistema debe usar Groq y, si no hay key, mostrar un mensaje claro en vez de caer al traductor local, que no admite glosario.

**✅ Verificación**
`npm run build` compila sin tocar los adapters de Codeforces y CSES. En un sitio de documentos sin key de Groq ves el mensaje de configuración, no una traducción sin glosario.

---

### T41 — Reaplicar la traducción tras navegar
🔴 Difícil · ⏱ 75 min · 📁 `src/content/navigation.ts` · ⬅ T37, T38

**🎯 Qué construyes**
La respuesta a lo que descubriste: al navegar entre módulos, el DOM se reemplaza y tu traducción desaparece. La extensión debe notarlo y actuar.

**🧠 Conceptos previos**
SPA (aplicación de una sola página) · History API · `MutationObserver` · Cancelación de tareas

**🔍 Investiga primero**
- MDN: `MutationObserver`, y la Navigation API (`navigation.addEventListener('navigatesuccess', …)`); comprueba que existe en tu Brave con `'navigation' in window`
- Alternativa desde el service worker: `chrome.webNavigation.onHistoryStateUpdated`. Ojo: pide un permiso adicional que el navegador advierte al instalar; compara con las otras opciones antes de elegirla

**🔨 Cómo atacarlo**
1. Detecta el cambio de página. Opciones, de menos a más robusta: escuchar la Navigation API; observar con `MutationObserver` la sustitución del contenedor de contenido; comparar `location.href` periódicamente. Empieza por la más simple que te funcione y prueba las tres si no.
2. Al detectar navegación: **cancela** la cola de la página anterior (T37), y si el usuario había traducido antes, vuelve a aplicar usando la caché (T38), que casi no cuesta tokens.
3. El botón tampoco debe depender del DOM de React: si lo cuelgas de un nodo que React reemplaza, desaparece. Prueba a colgarlo de `document.body`, fuera de la raíz de la aplicación, o reinyéctalo tras cada navegación.
4. Decide la política y anótala: ¿se re-traduce automáticamente, o solo si el usuario pulsó antes el botón en esa sesión?

**✅ Verificación**
Traduces un módulo, navegas a otro y vuelves: el botón sigue visible y la traducción reaparece sin peticiones nuevas. Navegar a mitad de una traducción cancela la cola anterior sin errores.

---

# Etapa 8 — USACO Guide

### T42 — Adapter `usaco.ts`
🟡 Media · ⏱ 60 min · 📁 `src/adapters/usaco.ts` · ⬅ T33, T40

Rellena el adapter con **los selectores de tus notas de T32**, no con los de Codeforces:
- `blockSelector`: párrafos, ítems de lista, encabezados, celdas de texto, citas. Revisa con tus fixtures qué entra de más.
- `opaqueSelector`: bloques de código, código inline, fórmulas `.katex`, imágenes, SVG, y lo que identificaste en T32 (nombres de problema, etiquetas).
- `inlineSelector`: negritas, cursivas y enlaces. Los enlaces conservan su `href` porque `restore()` clona la etiqueta de forma superficial.
- Sin `rawMathPattern` salvo que T32 demuestre que hay LaTeX sin renderizar.

**✅ Verificación** — TypeScript compila y cada selector lo verificaste tú contra el DOM real, no lo copiaste de otro adapter.

---

### T43 — Content script de documentos y manifest
🟢 Fácil · ⏱ 45 min · 📁 `src/content/docs.ts`, `src/manifest.json` · ⬅ T42

Un punto de entrada separado del de problemas, con su propia entrada en `content_scripts`, para que el script de enunciados ni se cargue en usaco.guide. Añade `https://usaco.guide/*` a `matches`. Comprueba si necesitas ajustar `host_permissions` y recarga la extensión (no basta recargar la página).

**✅ Verificación** — en usaco.guide aparece el botón; en Codeforces y CSES todo sigue igual que en `v1.0`.

---

### T44 — Round-trip sobre los fixtures de USACO
🔴 Difícil · ⏱ 60 min · 📁 `tests/protector.usaco.spec.ts` · ⬅ T42

Mismo test que T17, ahora con los tres fixtures de T33: `extract()` → `restore()` sin traducir debe dejar el contenido idéntico, y los nodos opacos (`.katex`, `pre`, código inline) deben ser **las mismas instancias**.

En documentos hay mucho más código inline que en enunciados: es la prueba de que el diseño de placeholders aguanta frases como *"usa `std::vector` para…"*.

**✅ Verificación** — en verde con los tres fixtures. Los fallos te dicen qué selector falta; arréglalos en el adapter, no en el core.

---

### T45 — Componentes con estado: pestañas, desplegables, tablas
🔴 Difícil · ⏱ 90 min · 📁 `src/adapters/usaco.ts`, `src/content/` · ⬅ T44, T41

**🎯 Qué construyes**
El tratamiento de lo que React vuelve a renderizar. Aquí se juega que la traducción no se pierda.

**🔨 Cómo atacarlo**
1. **Desplegables:** según lo que viste en T32, ¿su contenido está en el DOM cerrado? Si solo aparece al abrir, la traducción debe ocurrir **cuando aparezca** (un `MutationObserver` sobre el contenedor), no solo al pulsar el botón.
2. **Pestañas de código:** el código es opaco, así que no debería afectar. Comprueba que cambiar de pestaña no rompe la traducción de la prosa de alrededor.
3. **Tablas de problemas:** los nombres y etiquetas no se traducen. Si no puedes aislarlos con un selector, mejor excluir toda la tabla que traducir mal una parte.
4. Si en el segundo experimento de T32 viste que algún componente revierte tu texto, ahí tienes la lista de qué reaplicar con el observador.

**✅ Verificación** — traduces un módulo con tablas y desplegables, abres y cierras cada uno, cambias de pestaña y de modo: nada se revierte, nada se rompe, la consola está limpia.

---

### T46 — Botón, traducción por sección y bajo demanda
🟡 Media · ⏱ 90 min · 📁 `src/content/` · ⬅ T45

Con un presupuesto diario de tokens, traducir todo el módulo de golpe es un desperdicio si solo lees una parte. Ofrece dos modos: **traducir todo** y **traducir lo que voy leyendo**.

Pistas: segmenta por encabezados (cada `h2` abre una sección); para lo segundo, `IntersectionObserver` avisa cuándo una sección entra en pantalla. Cada sección es una unidad para `chunkBlocks()`.

**✅ Verificación** — en modo "bajo demanda", al hacer scroll aparecen traducidas solo las secciones visitadas, y en Groq se consumen menos tokens que traduciendo todo.

---

### T47 — Atribución y toggle EN ↔ ES en documentos largos
🟡 Media · ⏱ 45 min · 📁 `src/content/toggle.ts` · ⬅ T46

1. **Toggle:** el snapshot de T27 copiaba un enunciado pequeño. En un documento largo y traducido por tramos, define qué se guarda y cuándo; y recuerda que una navegación (T41) invalida el snapshot.
2. **Atribución:** un aviso visible del tipo "Traducción automática; contenido original de usaco.guide, bajo licencia CC BY-NC-SA 4.0" con enlace al original. La licencia del Guide es de uso no comercial con compartir igual, lo cual encaja con un uso personal; pero no soy abogado y la fuente de verdad es el texto de la licencia del sitio.

**✅ Verificación** — el aviso aparece en cada módulo traducido y el toggle devuelve el original exacto en cualquier momento, incluso con la traducción a medias.

---

# Etapa 9 — CP-Algorithms

> Con T34–T47 hechos, esto es sobre todo configuración. El orden de trabajo es el de siempre: **reconocer, configurar, probar**.

### T48 — Reconocimiento del DOM de CP-Algorithms
🟡 Media · ⏱ 60 min · 📁 `NOTAS-DOM.md` · ⬅ T47

Usa la misma sonda de T32. Sé que el sitio está hecho con MkDocs y el tema Material y usa MathJax 3, pero **no he inspeccionado su DOM real**. Esto es lo que hay que comprobar, no lo que debes dar por hecho:

- ¿Qué marcado genera MathJax 3? La sonda cuenta `mjx-container` y `.MathJax`. El de Codeforces era v2 (`span.MathJax`); aquí probablemente es otro.
- ¿Los encabezados llevan un enlace de ancla (el típico "¶")? Si sí, está **dentro** del texto del encabezado y hay que excluirlo o aparecerá en la traducción.
- ¿Hay bloques de aviso (notas, advertencias), pestañas de contenido y desplegables? El sitio anuncia que activó las pestañas de contenido.
- ¿Qué parte es el artículo y cuál la navegación lateral y el índice?
- ¿El sitio usa navegación instantánea (cambia de artículo sin recargar)? Compruébalo con el mismo experimento de T32.

Guarda 3 fixtures: un artículo corto, uno con mucho código y uno con tablas o pestañas.

---

### T49 — Adapter `cpalgorithms.ts`
🟡 Media · ⏱ 60 min · 📁 `src/adapters/cpalgorithms.ts` · ⬅ T48

Igual que T42, con los selectores de T48. Añade el dominio a `matches` en el manifest. Si quieres cubrir el espejo en GitHub Pages que anuncia el proyecto, añade también ese dominio, y verifica que su DOM sea el mismo.

Decisión de glosario relevante aquí: estos artículos están llenos de nombres de algoritmos y estructuras. Reutiliza el glosario de T39 y amplíalo.

---

### T50 — Round-trip y casos especiales
🟡 Media · ⏱ 60 min · 📁 `tests/protector.cpalgorithms.spec.ts` · ⬅ T49

Round-trip con los tres fixtures. Casos a cubrir expresamente: el enlace de ancla de los encabezados, los bloques de aviso, el código inline en medio de frases y las pestañas de contenido. Cada fallo es un selector que falta.

---

### T51 — Navegación en CP-Algorithms
🟢 Fácil · ⏱ 30 min · 📁 `src/content/navigation.ts` · ⬅ T50

Si T48 mostró que el sitio navega sin recargar, T41 ya lo cubre y solo hay que comprobarlo aquí. Si recarga la página completa, no hay nada que hacer: el content script se ejecuta de nuevo solo.

---

### T52 — Cierre: README, `v1.1` y bitácora
🟢 Fácil · ⏱ 45 min · 📁 raíz · ⬅ T51

Actualiza el README (sitios soportados, límite diario de Groq y cómo ahorrarlo), mide cuántos tokens gastó cada tipo de documento y anótalo, y etiqueta:

```
git tag v1.1
```

Antes de fusionar la rama, pasa `npm run test` completo: los tests de Codeforces y CSES de `v1.0` deben seguir en verde. Esa es la prueba de que no rompiste la extensión original.

---

# Apéndices

## A — Errores probables y su causa

| Lo que ves | Casi siempre es |
|---|---|
| La traducción desaparece al navegar | Esperado en un sitio SPA; falta T41 |
| El botón desaparece al cambiar de módulo | Está colgado de un nodo que React reemplaza; muévelo fuera de la raíz de la app o reinyéctalo |
| Error 429 de Groq | Cuota por minuto o por día; la cola no está esperando lo suficiente, o se agotaron los 200 000 tokens del día |
| La cola se queda parada a medias | La cola vive en el service worker y este se detuvo; debe vivir en el content script (T36) |
| Aparece "¶" o texto de navegación traducido | `blockSelector` demasiado amplio, o falta excluir el enlace de ancla |
| Un término sale traducido de dos formas | Falta una regla en el glosario (T39) |
| Los tests de Codeforces fallan tras tocar el core | Cambiaste comportamiento en vez de añadir; revisa con `git diff v1.0` |
| El texto vuelve al inglés al abrir un desplegable | React re-renderizó ese componente; necesita el observador de T45 |

## B — Qué preguntarme y cómo

La misma plantilla de la guía original (§1.2). Dime el número de tarea y el nivel de ayuda. Las tareas donde más conviene quedarse en pista o esqueleto: **T36** (la cola), **T41** (navegación) y **T45** (componentes con estado). Ahí está el aprendizaje nuevo de esta etapa. Para el manifest y la configuración, pide código directo.

## C — Cosas que conviene medir y anotar en la bitácora

- Tokens reales por lote frente a tu estimación (T34).
- Cuántos documentos largos caben en la cuota diaria, con tu prompt real.
- Si la caché de prompts de Groq reduce el consumo (T36).
- Qué componentes de USACO re-renderizan y revierten tu texto (T32, T45).
- Cuántos bloques rechaza `isValid()` por documento, comparado con los enunciados.

## D — Por dónde empezar

1. **T31** (20 minutos). No te saltes que `test` y `build` pasen antes de etiquetar.
2. **T32**, con calma, incluido el segundo experimento de hidratación.
3. **T33** y luego la Etapa 7 en orden. No saltes a T42: sin la cola y los lotes, el adapter no tiene dónde apoyarse.
