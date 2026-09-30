# Plan de Desarrollo Técnico — Traductor de Enunciados para Jueces Online

**Proyecto:** `cp-statement-translator`
**Objetivo:** Inyectar un botón en Codeforces / CSES que traduzca el enunciado EN → ES **sin tocar** fórmulas (LaTeX/MathJax) ni bloques de código (`<pre>`, `<code>`).
**Rol del documento:** decisiones de arquitectura, algoritmo núcleo, estructura de repositorio y hoja de ruta ejecutable.

---

## 0. Resumen ejecutivo de decisiones

| Decisión | Elección | Motivo en una línea |
|---|---|---|
| Formato | **Extensión de navegador (Manifest V3)** | Aislamiento de la API key, service worker para red, opciones nativas, distribuible |
| Prototipo previo | Userscript opcional (fase 0) | Iterar selectores en 10 minutos sin build |
| Lenguaje | **TypeScript** | El core (`protector`) es lógica pura con muchos tipos de nodo; TS evita el 80 % de los bugs de DOM |
| Build | **Vite + CRXJS** (alt: WXT) | HMR real en extensiones, empaqueta el manifest, cero webpack |
| Tests | **Vitest + jsdom** | El core se testea sin navegador; es el requisito crítico del proyecto |
| Motor por defecto | **Traductor integrado de Chrome** (on-device) | Gratis de verdad: sin API key, sin CORS, sin cuota y funciona offline. La extensión sirve nada más instalarla |
| Motor "modo calidad" | **Groq** (gratis) o **Gemini Flash** (gratis); Claude Haiku 4.5 solo si decides pagar | Un LLM sí respeta el glosario de programación competitiva. Comparativa completa y costes reales en §1.3 |
| Transporte HTTP | `content script → chrome.runtime.sendMessage → service worker → fetch` | En MV3 el `fetch` de un content script está sujeto al CORS de la página; el del service worker no |
| Custodia de la key | Sin key en el modo por defecto → `chrome.storage.local` si se activa un LLM → proxy propio si se distribuye | Todo lo empaquetado en una extensión es público |
| IDE | **VS Code** | Ecosistema Vite/TS, depuración vía `chrome://extensions`, Vitest integrado |

> **Regla de oro del proyecto:** el texto traducido **nunca** se inserta como HTML. Se inserta como `TextNode`s dentro de un árbol que nosotros construimos. Esto elimina por diseño el XSS y la posibilidad de que el modelo rompa el marcado.

---

## 0.1 Alcance y restricciones previas

- **Uso personal.** La herramienta solo lee el DOM ya renderizado y llama a una API externa. No automatiza envíos, no scrapea masivamente, no hace login programático. Mantenlo así: automatizar acciones en Codeforces viola sus términos y puede costar la cuenta.
- **No redistribuir enunciados traducidos** (son contenido con derechos de los autores/ICPC). La traducción vive en el navegador del usuario.
- **Rate limits.** Un enunciado ≈ 1 petición. Con caché local, re-visitar un problema cuesta 0.

---

## 1. Arquitectura y Stack Tecnológico

### 1.1 Userscript vs. Extensión

| Criterio | Userscript (Tampermonkey) | Extensión MV3 |
|---|---|---|
| Tiempo hasta el primer "hola mundo" | ~5 min | ~30 min |
| Peticiones cross-origin | `GM_xmlhttpRequest` (salta CORS) | `fetch` desde el service worker + `host_permissions` |
| Dónde vive la API key | `GM_setValue`, legible por cualquier script del gestor | `chrome.storage.local`, **fuera del alcance del content script** |
| TypeScript / bundling / tests | Posible pero incómodo | Nativo |
| UI de configuración | Ninguna (o hackeada) | `options_page` |
| Distribuir a tu club | Copiar/pegar un `.js` | `.zip` o Chrome Web Store |
| Depuración | `console.log` | DevTools del service worker + del content script |

**Recomendación: Extensión MV3.** El proyecto tiene tres capas separadas (UI inyectada, lógica de parseo, red con credenciales) y eso es exactamente lo que MV3 modela bien. Un userscript te obligaría a mezclarlas en un único archivo.

**Matiz práctico:** dedica la **Fase 0** a un userscript desechable de 40 líneas cuyo único propósito es validar selectores CSS en Codeforces y CSES. Ese conocimiento se convierte después en tus *adapters*. No intentes adivinar el DOM desde el editor.

> **Analogía útil:** si vienes de backend, piensa en el content script como el *controller* (toca la vista, no sabe nada de credenciales), el `core/` como el *service/domain layer* (lógica pura, testeable, sin I/O) y el service worker como el *repository/gateway* (único que habla con el exterior y tiene los secretos). La separación es la misma que ya aplicas en un CRUD.

### 1.2 Stack concreto

```
TypeScript 5.x
Vite + @crxjs/vite-plugin      # build y HMR para MV3
Vitest + jsdom                 # tests del core
ESLint + Prettier
```

Alternativa a CRXJS: **WXT** (`wxt.dev`), que genera el manifest y soporta Chrome/Firefox con el mismo código. Si quieres soporte Firefox desde el día 1, ve con WXT.

**VS Code — extensiones recomendadas:** ESLint, Prettier, Vitest, Error Lens, *Path Intellisense*, *Pretty TypeScript Errors*. (WebStorm también sirve, pero VS Code es el camino con menos fricción para Vite + extensiones de Chrome.)

### 1.3 Motor de traducción

Aquí está la decisión con más impacto en si el proyecto se usa o se queda en el cajón. Hay **tres niveles**, de gratis a de pago, y gracias a la interfaz `TranslationProvider` puedes tenerlos los tres implementados a la vez y cambiar desde la página de Opciones.

> **Principio:** la extensión debe traducir **al instalarla, sin configurar nada**. Todo lo que exija crear cuentas o pegar claves es opcional y va detrás de un interruptor.

---

#### Nivel 0 — Traductor integrado de Chrome *(por defecto, coste 0)*

Chrome incorpora desde la versión 138 una **Translator API on-device**: el modelo de traducción vive en el navegador, descarga paquetes de idioma la primera vez y después funciona sin conexión. El texto nunca sale de la máquina.

| | |
|---|---|
| Coste | **0.** No hay key, ni cuota, ni facturación |
| Latencia | Milisegundos: no hay red de por medio |
| Privacidad | Total: nada sale del equipo |
| Fricción | Cero: instalar y usar |
| Requisito | Un navegador **basado en Chromium de escritorio** con la API activa (Chrome 138+; **verificado también en Brave**). No hay soporte en Chrome móvil, Firefox ni Safari |

Contrapartidas reales, sin adornos:

- **No es un LLM, es un traductor.** No puedes darle un glosario ni un system prompt. Traducirá `edge` como "borde" en un problema de grafos y `array` como "matriz". Para enunciados de Div 2 A/B es perfectamente legible; en problemas con narrativa densa se nota.
- **Hay que verificar empíricamente que respeta los `⟦n⟧`.** Un traductor estadístico podría alterarlos o moverlos. Tu `isValid()` lo detectaría, pero si el porcentaje de fallo es alto tendrías que probar otro marcador. **Esto es un experimento de la Fase 4, no una suposición.**

```ts
// src/background/providers/chrome-builtin.ts (boceto)
const estado = await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'es' });
// 'available' | 'downloadable' | 'unavailable'  ← los tres se manejan distinto
const t = await Translator.create({ sourceLanguage: 'en', targetLanguage: 'es' });
const salida = await t.translate(texto);
```

**Regla: detecta, no supongas.** La disponibilidad se decide en tiempo de ejecución con `availability()`, nunca deduciéndola del nombre o la versión del navegador. Un mismo navegador puede responder distinto según plataforma, versión o configuración, y `downloadable` (falta bajar el paquete de idioma, hay que mostrar progreso) no es lo mismo que `unavailable` (aquí sí se cae al proveedor de respaldo). Comprobación rápida en la consola de cualquier página https, útil antes de escribir una línea:

```js
await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'es' });
```

Documentación: https://developer.chrome.com/docs/ai/translator-api
Detalle a comprobar en la Fase 1: si el objeto `Translator` está expuesto en el content script o solo en el service worker. Si no lo está, lo llamas desde el fondo como a cualquier otro proveedor y no cambia nada más.

---

#### Nivel 1 — LLM gratuito con key propia *(modo calidad recomendado)*

Aquí recuperas lo que el Nivel 0 no puede dar: **el glosario**. Un LLM al que le dices "`edge` es arista, `array` es arreglo, `query` es consulta" lo cumple. Todos estos dan key sin tarjeta de crédito.

| Proveedor | Qué obtienes | Límite gratuito aproximado | La letra pequeña |
|---|---|---|---|
| **Groq** ⭐ | Modelos abiertos rápidos (gpt-oss, Qwen) | ~30 req/min, ~1 000 req/día, ~200 K tokens/día | Tope bajo de tokens por minuto; API **compatible con OpenAI** |
| **Google Gemini** (AI Studio) | Flash 3.x, 2.5 Flash, Gemma | ~10–15 req/min y del orden de 1 500/día en Flash | Google dejó de publicar las cifras exactas (se consultan en AI Studio) y **las peticiones del plan gratuito pueden usarse para entrenar** |
| **OpenRouter** | ~19 modelos con sufijo `:free`, una sola key para todos | ~20 req/min, ~50 req/día | Los proveedores de origen devuelven 429 a menudo. Ideal para **comparar modelos sin tocar código** |
| **Cloudflare Workers AI** | Llama 3.3 70B, gpt-oss-120b, Qwen3 | ~10 000 "Neurons"/día | La cuota se mide en Neurons, no en tokens. Encaja si además montas ahí el proxy |
| **Mistral / Cohere** | Modelos propios | Créditos mensuales pequeños | Cohere prohíbe el uso comercial en su plan de prueba |

**Recomendado: Groq.** Calidad de LLM, cuota holgadísima para tu caso (un enunciado = 1 petición; 1 000 al día es más de lo que resolverás en un año), sin tarjeta, y su API sigue el formato de OpenAI — ese mismo archivo `groq.ts` te sirve luego para media docena de servicios cambiando la URL.

> ⚠️ **Estas cifras son una foto, no un contrato.** Los planes gratuitos cambian cada pocos meses: proveedores que desaparecen, modelos que salen del nivel gratis, límites que se recortan. Por eso el proveedor **debe** ser configurable desde Opciones y por eso la extensión no puede depender de uno solo. Comprueba los números antes de fijar nada.

---

#### Nivel 2 — LLM de pago *(opcional, solo si quieres lo mejor)*

Ya que en la conversación salió la duda sobre Haiku, aquí va con todos los números.

**Qué es "Haiku".** La familia Claude tiene tres escalones por capacidad y precio: **Haiku** (el más rápido y barato) < **Sonnet** (equilibrado) < **Opus** (el más capaz). `claude-haiku-4-5` es la versión 4.5 del escalón barato. Para traducir texto técnico no necesitas más: traducir es una tarea fácil para un modelo moderno, lo difícil del proyecto está en tu código, no en el modelo.

**Cómo se cobra.** No es suscripción: es **prepago por consumo**. Cargas saldo (5 o 10 USD) y se descuenta por tokens, contados por separado en entrada y salida. Si no llamas a la API, no se descuenta nada. No hay cuota mensual ni permanencia.

**El coste real, calculado para este proyecto** (Haiku 4.5 a 1 USD/MTok de entrada y 5 USD/MTok de salida):

| Concepto | Cantidad | Coste |
|---|---|---|
| Entrada: enunciado Div 2 típico | ~1 500 tokens | 0,0015 USD |
| Salida: traducción | ~2 000 tokens | 0,0100 USD |
| **Total por problema** | | **≈ 0,0115 USD** (unos 4 céntimos de sol) |
| 100 problemas distintos | | ≈ 1,15 USD |
| Saldo mínimo de 5 USD | | ≈ 430 problemas |
| Revisitar un problema ya traducido | | **0** (lo sirve la caché) |

**Entonces, ¿por qué no es la opción por defecto?** No porque sea caro — no lo es. Por dos razones de producto:

1. **Es dinero que puedes no gastar.** Para un proyecto de estudiante, 5 USD evitables son 5 USD evitables, y el Nivel 0 y el Nivel 1 cubren el caso de uso.
2. **Mata la adopción.** Si mañana compartes la extensión en tu club, "crea una cuenta, mete una tarjeta y carga saldo" lo hace nadie. "Instala y funciona" lo hace todo el mundo.

Deja Anthropic implementado como tercer proveedor y elegible desde Opciones. Si algún día un enunciado largo te sale mal traducido por Groq, cambias el desplegable, gastas dos céntimos y sigues.

Precios y modelos vigentes: https://docs.claude.com/en/docs/about-claude/models/overview

---

#### Alternativa determinista: DeepL API Free

`tag_handling=xml` + `ignore_tags` permite marcar trozos que no debe traducir (envuelves lo protegido en `<x id="3"/>`), lo que reduce el riesgo de que se rompan los marcadores. Plan gratuito del orden de 500 K caracteres al mes — verifica si en tu país exige tarjeta para validar la cuenta. En contra: traduce jerga técnica de forma literal y sin glosario, igual que el Nivel 0, pero con dependencia de red.

---

#### Decisión

Implementa la interfaz `TranslationProvider` con **tres** implementaciones desde el inicio:

1. `chrome-builtin.ts` — por defecto, sin configuración.
2. `groq.ts` — modo calidad gratuito, con system prompt y glosario.
3. `anthropic.ts` — modo calidad de pago, opcional.

Son ~40 líneas cada una. Tenerlas las tres no es sobreingeniería: es lo que te permite **medir** cuál traduce mejor tus enunciados en vez de discutirlo, y lo que evita que el proyecto muera el día que un plan gratuito cambie las reglas. `gemini.ts` y `deepl.ts` quedan como ejercicio de 20 minutos cuando los necesites.

### 1.4 Peticiones HTTP seguras desde el cliente

Tres puntos que la mayoría de tutoriales se salta:

**(a) Por qué NO puedes hacer `fetch` a la API desde el content script.**
En MV3 un content script se ejecuta en el mundo aislado pero **hereda el origen de la página** para las peticiones de red. Un `fetch` a `api.anthropic.com` desde `codeforces.com` es cross-origin y será bloqueado por CORS. El service worker de la extensión, en cambio, hace peticiones con el origen de la extensión y con los `host_permissions` declarados. Por eso el flujo obligatorio es:

```
[content script]  extrae texto + placeholders
      │  chrome.runtime.sendMessage({type:'TRANSLATE', blocks})
      ▼
[service worker]  lee la key de chrome.storage.local  →  fetch(API)
      │  sendResponse({ok:true, data:[...]})
      ▼
[content script]  restaura nodos y pinta
```

Beneficio secundario: **la API key nunca entra en el mismo contexto que la página web**. Aunque Codeforces tuviera un script malicioso, no puede leerla.

**(b) Llamadas desde un contexto de navegador.** La API de Anthropic bloquea por defecto peticiones directas desde navegador; si el endpoint lo exige, añade la cabecera `anthropic-dangerous-direct-browser-access: true` (consulta la documentación vigente). Esto **no** es una medida de seguridad, solo desbloquea el origen.

**(c) Custodia de la key — tres niveles de madurez.**

| Nivel | Escenario | Implementación |
|---|---|---|
| 0 | Traductor integrado de Chrome | **No hay credencial que proteger.** El problema desaparece por completo: es otra razón de peso para que sea el modo por defecto. |
| 1 | Solo tú | Key en `chrome.storage.local`, introducida en `options.html`. Nunca en el repositorio. |
| 2 | Tu club / amigos | Cada usuario pone **su propia** key. Validación al guardar (llamada de 1 token). |
| 3 | Distribución pública | **Proxy propio**: Cloudflare Worker / Vercel Edge Function que guarda la key en variables de entorno y expone `POST /translate` con rate limit por IP y verificación de origen de extensión. La extensión nunca ve la key. |

> Si empaquetas una key en el `.zip` de la extensión, es pública. Cualquiera puede descomprimirla. No hay ofuscación que valga.

Añade siempre a `.gitignore`: `.env`, `dist/`, `*.pem`, `node_modules/`.

---

## 2. Algoritmo de Protección de Nodos (el core)

### 2.1 Tres principios innegociables

1. **Nunca usar regex sobre HTML.** `innerHTML.replace(/<pre>.*?<\/pre>/g, ...)` falla con atributos, anidamiento y entidades. El navegador ya te dio un árbol tipado: recórrelo.
2. **Nunca escribir `innerHTML` con la respuesta del modelo.** Rompe MathJax (que guarda referencias a nodos vivos), destruye event listeners y abre XSS.
3. **Preservar la *identidad* de los nodos protegidos, no su HTML.** No guardes `el.outerHTML` para reinyectarlo: guarda **la referencia al nodo** y muévelo. Un `<span class="MathJax">` ya renderizado, movido de sitio, sigue renderizado. Reinsertado como string, hay que re-tipografiar (parpadeo, coste, y a veces roto).

### 2.2 Anatomía del DOM (Codeforces)

```html
<div class="problem-statement">
  <div class="header">
    <div class="title">A. Nombre</div>
    <div class="time-limit"><div class="property-title">time limit per test</div>1 second</div>
  </div>
  <div>                              <!-- legend: el enunciado en sí -->
    <p>Given an array <span class="tex-span">…MathJax…</span> …</p>
  </div>
  <div class="input-specification"><div class="section-title">Input</div><p>…</p></div>
  <div class="output-specification">…</div>
  <div class="sample-tests">
    <div class="section-title">Example</div>
    <div class="sample-test">
      <div class="input"><div class="title">Input</div><pre>3 5\n1 2 3</pre></div>
      <div class="output"><div class="title">Output</div><pre>6</pre></div>
    </div>
  </div>
  <div class="note"><div class="section-title">Note</div><p>…</p></div>
</div>
```

Detalles que importan:
- Codeforces escribe las fórmulas como `$$$...$$$` en el HTML crudo y **MathJax las convierte en tiempo de ejecución** a `<span class="MathJax">…</span>` + `<script type="math/tex">`. Tu script debe soportar **los dos estados** (ver 2.7).
- `.tex-font-style-tt` marca identificadores/variables inline (`n`, `a_i`): trátalo como **opaco**, no se traduce.
- `.tex-font-style-bf` / `.tex-font-style-it` son negrita/cursiva con texto **traducible**: son *inline transparentes*.
- Los ejemplos viven en `<pre>`: opacos, sin excepción.

Para **CSES** no asumas nada: la estructura (`.content`, `div.md`, delimitadores `\(...\)`) debe verificarse con el snippet del Apéndice A y volcarse al adapter. El objetivo del diseño es que **añadir un juez sea escribir 20 líneas de configuración**, no tocar el core.

### 2.3 Pipeline de 7 etapas

```
1. LOCATE      adapter.findStatementRoot()      → contenedor del enunciado
2. SNAPSHOT    root.cloneNode(true)             → copia profunda para el toggle EN/ES
3. SEGMENT     adapter.blockSelector            → lista de bloques traducibles (<p>, <li>, títulos…)
4. EXTRACT     extract(block)                   → { text con ⟦n⟧, slots: Map<n, Nodo vivo> }
5. TRANSLATE   sendMessage → SW → API           → string[] paralelo, mismo orden
6. VALIDATE    tokens presentes, mismos, en orden → si falla: reintento / fallback
7. RESTORE     restore(text, slots)             → DocumentFragment → block.replaceChildren()
```

Las etapas 4 y 7 son **funciones puras sobre el DOM** (ni red ni estado global). Por eso viven en `core/` y se testean con Vitest. Las etapas 1 y 3 son configuración por juez (`adapters/`). La 5 es la única con I/O.

### 2.4 Taxonomía de nodos

| Tipo | Ejemplos (Codeforces) | Tratamiento |
|---|---|---|
| **Opaco** | `pre`, `code`, `.MathJax`, `.MathJax_Preview`, `script[type^="math/tex"]`, `.katex`, `.tex-font-style-tt`, `img`, `svg` | Se sustituye por un placeholder **auto-contenido** `⟦3⟧`. El subárbol no se recorre. |
| **Inline transparente** | `b`, `strong`, `i`, `em`, `a`, `.tex-font-style-bf`, `.tex-font-style-it` | Se sustituye por un par `⟦4⟧texto interior⟦/4⟧`. Conserva el formato sin impedir la traducción. |
| **Estructural** | `div`, `span` sin clase relevante | Transparente: se recorre y desaparece de la cadena (su contenido sube). |
| **Texto** | `Text` nodes | Contenido a traducir + búsqueda de LaTeX crudo (`$$$…$$$`). |

### 2.5 Diseño del placeholder

Criterios: (1) que el modelo **no lo traduzca**, (2) que no lo reformatee, (3) que no aparezca naturalmente en un enunciado, (4) que sea barato de parsear.

- ❌ `__MATH_1__` — los LLM tienden a "normalizar" guiones bajos, y `_` es carácter frecuente en identificadores de código.
- ❌ `[1]`, `{1}` — aparecen en enunciados reales (índices, conjuntos).
- ✅ **`⟦1⟧`** (U+27E6 / U+27E7, *mathematical white square brackets*). No aparece en texto natural, los modelos lo copian literal, y el regex es trivial: `/⟦(\/?)(\d+)⟧/g`.

Apertura y cierre para inline: `⟦4⟧` … `⟦/4⟧`. Un id opaco y uno inline no se confunden porque el `Map` de slots dice de qué tipo es cada id.

Numeración **por bloque** (no global): mantiene los ids en 1–2 dígitos, reduce tokens y evita que un error en un bloque contamine a otro.

### 2.6 `extract()` — del DOM a texto plano seguro

```ts
// src/core/protector.ts
export type Slot =
  | { kind: 'opaque'; node: Node }      // nodo entero congelado (LaTeX, <pre>, imagen)
  | { kind: 'inline'; el: HTMLElement }; // envoltorio de formato con texto dentro

export interface Extraction {
  text: string;                 // "Dado un array ⟦0⟧ de ⟦1⟧ enteros…"
  slots: Map<number, Slot>;     // id → nodo ORIGINAL (referencia viva, no copia)
}

export interface ProtectionConfig {
  opaqueSelector: string;
  inlineSelector: string;
  rawMathPattern?: RegExp;      // p. ej. /\$\$\$[\s\S]*?\$\$\$/g en Codeforces
}

export function extract(block: Element, cfg: ProtectionConfig): Extraction {
  const slots = new Map<number, Slot>();
  let next = 0;
  const alloc = (s: Slot): number => { const id = next++; slots.set(id, s); return id; };

  const walk = (node: Node): string => {
    // 1) Texto: se traduce, pero primero protegemos LaTeX aún sin renderizar.
    if (node.nodeType === Node.TEXT_NODE) {
      return protectRawMath(node.textContent ?? '', cfg, alloc);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;

    // 2) Opaco: placeholder y NO descendemos. Aquí vive la garantía del requisito crítico.
    if (el.matches(cfg.opaqueSelector)) {
      return `⟦${alloc({ kind: 'opaque', node: el })}⟧`;
    }

    // 3) Descendemos y componemos.
    const inner = Array.from(el.childNodes).map(walk).join('');

    // 4) Inline con contenido traducible: par apertura/cierre.
    if (inner.trim() && el.matches(cfg.inlineSelector)) {
      const id = alloc({ kind: 'inline', el });
      return `⟦${id}⟧${inner}⟦/${id}⟧`;
    }

    // 5) Estructural: transparente.
    return inner;
  };

  const text = Array.from(block.childNodes).map(walk).join('');
  return { text: text.replace(/\s+/g, ' ').trim(), slots };
}

function protectRawMath(
  text: string,
  cfg: ProtectionConfig,
  alloc: (s: Slot) => number
): string {
  if (!cfg.rawMathPattern) return text;
  return text.replace(cfg.rawMathPattern, (match) =>
    // Guardamos un TextNode nuevo para que restore() sea uniforme.
    `⟦${alloc({ kind: 'opaque', node: document.createTextNode(match) })}⟧`
  );
}
```

**Por qué recursión explícita y no `TreeWalker`:** el `TreeWalker` es excelente para *recolectar* nodos, pero aquí necesitamos **componer una cadena respetando el orden y la anidación** y cortar subárboles enteros. La recursión expresa eso en 15 líneas; con `TreeWalker` acabarías reimplementando la pila a mano.

### 2.7 `restore()` — del texto traducido a un árbol nuevo

```ts
export function restore(translated: string, slots: Map<number, Slot>): DocumentFragment {
  const root = document.createDocumentFragment();
  const stack: Node[] = [root];
  const top = () => stack[stack.length - 1];

  const TOKEN = /⟦(\/?)(\d+)⟧/g;
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN.exec(translated)) !== null) {
    const plain = translated.slice(cursor, m.index);
    if (plain) top().appendChild(document.createTextNode(plain));
    cursor = m.index + m[0].length;

    const isClosing = m[1] === '/';
    const id = Number(m[2]);
    const slot = slots.get(id);
    if (!slot) continue;                     // token inventado por el modelo → se ignora

    if (slot.kind === 'opaque') {
      // Se MUEVE el nodo original: MathJax sigue renderizado, el <pre> intacto.
      top().appendChild(slot.node);
      continue;
    }

    if (!isClosing) {
      // Clon SUPERFICIAL: conserva etiqueta, clases y href; los hijos los ponemos nosotros.
      const shell = slot.el.cloneNode(false) as HTMLElement;
      top().appendChild(shell);
      stack.push(shell);
    } else if (stack.length > 1) {
      stack.pop();
    }
  }

  const tail = translated.slice(cursor);
  if (tail) top().appendChild(document.createTextNode(tail));
  return root;
}
```

Aplicación:

```ts
const frag = restore(translatedText, extraction.slots);
block.replaceChildren(frag);   // atómico: sin estados intermedios visibles
```

**Orden crítico:** construye el fragmento **antes** de vaciar el bloque. `appendChild` sobre un nodo que aún está en el documento lo *mueve* (no lo copia); si vaciaras primero, perderías las referencias.

**Propiedad de seguridad:** la respuesta del modelo solo se usa para crear `TextNode`s y para decidir *dónde* colocar nodos que ya existían en la página. Nunca se parsea como HTML → **XSS imposible por construcción**, aunque la API devolviera `<script>alert(1)</script>` (aparecería como texto literal).

### 2.8 Validación y política de fallos

Antes de pintar, valida cada bloque:

```ts
function tokensOf(s: string): string[] {
  return (s.match(/⟦\/?\d+⟧/g) ?? []);
}

function isValid(src: string, out: string): boolean {
  const a = tokensOf(src), b = tokensOf(out);
  return a.length === b.length && a.every((t, i) => t === b[i]);
}
```

Escalera de degradación (nunca rompas la página):

1. **OK** → pintar.
2. **Tokens desordenados o faltantes** → 1 reintento con el bloque aislado y un recordatorio explícito en el prompt.
3. **Falla otra vez** → dejar **ese bloque** en inglés y marcarlo con un borde punteado + `title="No se pudo traducir con seguridad"`.
4. **Error de red / 401 / 429** → revertir todo al snapshot original y mostrar un toast con el motivo.

El fallo por defecto es *mostrar el original*. Un enunciado en inglés es útil; uno con la fórmula rota es peligroso.

### 2.9 El caso MathJax (Codeforces)

Codeforces sirve `$$$n \le 10^5$$$` y MathJax lo tipografía en el cliente. Según cuándo corra tu script verás una cosa u otra. Solución de dos capas, ya presente en el código:

- Si **ya se renderizó**: los `span.MathJax` caen en `opaqueSelector`. ✔
- Si **aún no**: el regex `rawMathPattern` de `protectRawMath` los captura en los nodos de texto. ✔

Además, espera a que MathJax termine antes de habilitar el botón (evita traducir a medio render):

```ts
// src/core/mathjax.ts
export function whenMathReady(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    const w = window as any;
    const done = () => resolve();
    if (w.MathJax?.Hub?.Queue) w.MathJax.Hub.Queue(done);         // MathJax v2 (Codeforces)
    else if (w.MathJax?.startup?.promise) w.MathJax.startup.promise.then(done);  // v3
    else done();
    setTimeout(done, timeoutMs);                                  // red de seguridad
  });
}
```

### 2.10 Empaquetado de la petición y prompt

Un solo request por enunciado: array de bloques → array traducido, mismos índices.

```ts
export const SYSTEM_PROMPT = `Eres un traductor técnico especializado en programación competitiva (ICPC, Codeforces).
Traduces enunciados del inglés al español neutro (latinoamericano).

REGLAS ABSOLUTAS
1. Los tokens con la forma ⟦n⟧ y ⟦/n⟧ son marcadores. Cópialos EXACTAMENTE: mismo número, mismo orden, misma cantidad. No los traduzcas, no los renumeres, no añadas ni elimines ninguno.
2. No añadas ni quitas contenido. No expliques el problema ni des pistas de solución.
3. Conserva los identificadores de variables y los nombres de funciones tal cual.
4. Glosario: array→arreglo, test case→caso de prueba, constraints→restricciones, input→entrada, output→salida, sample→ejemplo, edge→arista, vertex/node→vértice/nodo, query→consulta, subarray→subarreglo, prefix sum→suma de prefijos, greedy→voraz, binary search→búsqueda binaria.
5. Registro formal e impersonal, propio de un enunciado.

FORMATO DE SALIDA
Recibes un array JSON de cadenas. Devuelves ÚNICAMENTE un array JSON de cadenas, del mismo tamaño y en el mismo orden. Sin markdown, sin backticks, sin texto adicional.`;
```

Parámetros: `temperature: 0`, `max_tokens` ≈ 2× los tokens de entrada, y un *prefill* del turno del asistente con `[` para forzar el JSON si el modelo lo soporta.

**Qué proveedor aprovecha qué.** Esta es la diferencia práctica entre los niveles de §1.3:

| | System prompt / glosario | Lote de N bloques en 1 petición |
|---|---|---|
| Chrome integrado (Nivel 0) | ❌ no acepta instrucciones | ❌ una llamada por bloque (da igual: es local e instantáneo) |
| Groq / Gemini / Anthropic | ✅ completo | ✅ un JSON con todo el enunciado |
| DeepL | Parcial (`ignore_tags`, sin glosario en el plan gratuito) | ✅ array de textos |

Por eso la interfaz lleva un campo `supportsPrompt`: el orquestador no necesita saber quién está detrás, solo si puede imponerle el glosario o no.

**Caché.** Clave = `juez:problemId:hash(textoFuente)` con un FNV-1a de 32 bits. Guarda `string[]` en `chrome.storage.local`. Revisitar un problema traducido es instantáneo y gratis; y el hash detecta si Codeforces editó el enunciado.

---

## 3. Estructura del Proyecto y Código Base

### 3.1 Árbol de archivos

```
cp-statement-translator/
├─ src/
│  ├─ manifest.json                 # declaración MV3 (CRXJS la procesa)
│  │
│  ├─ core/                         # ← LÓGICA PURA. Sin chrome.*, sin fetch. 100% testeable.
│  │  ├─ protector.ts               #   extract() / restore()  ← el corazón del proyecto
│  │  ├─ validator.ts               #   isValid(), tokensOf()
│  │  ├─ segmenter.ts               #   bloques traducibles a partir de la raíz
│  │  ├─ mathjax.ts                 #   whenMathReady()
│  │  └─ hash.ts                    #   fnv1a() para la clave de caché
│  │
│  ├─ adapters/                     # ← TODO lo específico de cada juez vive aquí
│  │  ├─ types.ts                   #   interface SiteAdapter
│  │  ├─ codeforces.ts
│  │  ├─ cses.ts
│  │  └─ index.ts                   #   resolveAdapter(location)
│  │
│  ├─ content/                      # ← Capa de presentación inyectada en la página
│  │  ├─ index.ts                   #   orquestador: botón → pipeline → pintar
│  │  ├─ button.ts                  #   creación del botón y sus estados
│  │  ├─ toggle.ts                  #   alternar ES/EN con el snapshot
│  │  └─ ui.css
│  │
│  ├─ background/                   # ← ÚNICA capa con acceso a la API key y a la red
│  │  ├─ service-worker.ts
│  │  └─ providers/
│  │     ├─ types.ts                #   interface TranslationProvider
│  │     ├─ index.ts                #   registro de proveedores disponibles
│  │     ├─ chrome-builtin.ts       #   Nivel 0 — gratis, local, sin key   ← por defecto
│  │     ├─ groq.ts                 #   Nivel 1 — gratis con key propia
│  │     ├─ gemini.ts               #   Nivel 1 — alternativa gratuita
│  │     ├─ anthropic.ts            #   Nivel 2 — de pago, opcional
│  │     └─ deepl.ts                #   alternativa determinista
│  │
│  ├─ shared/
│  │  ├─ messages.ts                #   tipos del protocolo content ↔ background
│  │  ├─ settings.ts                #   lectura/escritura de chrome.storage
│  │  └─ prompt.ts
│  │
│  └─ options/
│     ├─ options.html
│     └─ options.ts
│
├─ tests/
│  ├─ protector.spec.ts
│  └─ fixtures/
│     ├─ cf-1850a.html              # HTML real capturado del juez
│     └─ cses-1068.html
│
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ .gitignore                       # .env, dist/, node_modules/
└─ README.md
```

### 3.2 Por qué esta estructura (y no un solo archivo)

| Carpeta | Razón de existir |
|---|---|
| `core/` | Es la única parte donde un bug **rompe un enunciado**. Al no depender de `chrome.*` ni del DOM real, se testea en milisegundos con jsdom. Si `core/` importara `chrome.storage`, no podrías testearlo fuera del navegador — y sin tests, el requisito de "no tocar el LaTeX" es una promesa, no una garantía. |
| `adapters/` | Patrón *Strategy*. Añadir AtCoder o SPOJ = un archivo nuevo de ~20 líneas, cero cambios en el core. Sin esto, acabarías con `if (url.includes('codeforces'))` repartido por todo el código. |
| `content/` | Toca el DOM del juez y **no conoce la API key**. Si mañana cambias de proveedor, esta carpeta no se entera. |
| `background/` | Frontera de confianza: único punto con credenciales y red. Auditar la seguridad del proyecto = leer una carpeta. |
| `background/providers/` | Cinco archivos que cumplen el mismo contrato. No es sobreingeniería: los planes gratuitos cambian de reglas cada pocos meses, y aquí eso cuesta cambiar un desplegable en vez de reescribir el proyecto. |
| `shared/messages.ts` | Contrato tipado entre dos procesos distintos. En TS, un `type` compartido convierte un error de runtime ("`data` es undefined") en un error de compilación. |
| `tests/fixtures/` | HTML real, no inventado. Un enunciado de Codeforces tiene rarezas (`&nbsp;`, `<sup>`, imágenes) que jamás escribirías a mano. |

### 3.3 Esqueleto de código

**`src/adapters/types.ts`** — el contrato que hace extensible el proyecto:

```ts
import type { ProtectionConfig } from '../core/protector';

export interface SiteAdapter {
  id: 'codeforces' | 'cses';
  matches(loc: Location): boolean;
  findStatementRoot(doc: Document): HTMLElement | null;
  /** Elementos hoja que forman una unidad de traducción con sentido. */
  blockSelector: string;
  protection: ProtectionConfig;
  /** Identificador estable del problema, para la caché. */
  problemKey(loc: Location): string;
  /** Dónde colgar el botón. */
  mountPoint(root: HTMLElement): HTMLElement;
}
```

**`src/adapters/codeforces.ts`**:

```ts
import type { SiteAdapter } from './types';

export const codeforces: SiteAdapter = {
  id: 'codeforces',
  matches: (loc) => loc.hostname.endsWith('codeforces.com'),
  findStatementRoot: (doc) => doc.querySelector('.problem-statement'),

  blockSelector: 'p, li, .section-title, .property-title, .header .title, dd, dt',

  protection: {
    opaqueSelector: [
      'pre', 'code', 'kbd', 'samp',
      '.MathJax', '.MathJax_Preview', '.MathJax_Display',
      'script[type^="math/tex"]',
      '.katex', '.tex-font-style-tt',
      'img', 'svg',
    ].join(','),
    inlineSelector: 'b, strong, i, em, u, a, .tex-font-style-bf, .tex-font-style-it',
    rawMathPattern: /\$\$\$[\s\S]*?\$\$\$/g,
  },

  problemKey: (loc) => `cf${loc.pathname}`,
  mountPoint: (root) => root.querySelector('.header') ?? root,
};
```

> Nota: `pre` está en `opaqueSelector`, por lo que los bloques de ejemplo **nunca** llegan al segmentador ni a la API. El requisito crítico se cumple en una línea de configuración, no en un `if` perdido.

**`src/shared/messages.ts`**:

```ts
export interface TranslateRequest {
  type: 'TRANSLATE';
  blocks: string[];
  cacheKey: string;
}
export type TranslateResponse =
  | { ok: true; blocks: string[]; fromCache: boolean }
  | { ok: false; error: string; code?: number };
```

**`src/content/index.ts`** — el orquestador:

```ts
import { resolveAdapter } from '../adapters';
import { extract, restore } from '../core/protector';
import { isValid } from '../core/validator';
import { whenMathReady } from '../core/mathjax';
import { collectBlocks } from '../core/segmenter';
import { mountButton, setButtonState } from './button';
import type { TranslateResponse } from '../shared/messages';

async function main() {
  const adapter = resolveAdapter(location);
  if (!adapter) return;

  const root = adapter.findStatementRoot(document);
  if (!root) return;

  await whenMathReady();
  mountButton(adapter.mountPoint(root), () => translateAll(adapter, root));
}

async function translateAll(adapter: SiteAdapter, root: HTMLElement) {
  setButtonState('loading');

  // Snapshot para el toggle ES/EN. Copia profunda ANTES de tocar nada.
  const snapshot = root.cloneNode(true) as HTMLElement;

  const blocks = collectBlocks(root, adapter);
  const extractions = blocks.map((b) => extract(b, adapter.protection));

  const res: TranslateResponse = await chrome.runtime.sendMessage({
    type: 'TRANSLATE',
    blocks: extractions.map((e) => e.text),
    cacheKey: adapter.problemKey(location),
  });

  if (!res.ok) { setButtonState('error', res.error); return; }

  blocks.forEach((block, i) => {
    const out = res.blocks[i];
    if (!out || !isValid(extractions[i].text, out)) {
      block.classList.add('cpt-skipped');   // se queda en inglés, visiblemente marcado
      return;
    }
    block.replaceChildren(restore(out, extractions[i].slots));
  });

  setButtonState('done', snapshot);
}

main();
```

**`src/background/service-worker.ts`**:

```ts
import { getSettings } from '../shared/settings';
import { PROVIDERS, DEFAULT_PROVIDER } from './providers';
import type { TranslateRequest, TranslateResponse } from '../shared/messages';

chrome.runtime.onMessage.addListener(
  (msg: TranslateRequest, _sender, sendResponse: (r: TranslateResponse) => void) => {
    if (msg.type !== 'TRANSLATE') return;

    handle(msg)
      .then((blocks) => sendResponse({ ok: true, blocks, fromCache: false }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message ?? e) }));

    return true; // ← imprescindible: mantiene abierto el canal para la respuesta asíncrona
  }
);

async function handle(msg: TranslateRequest): Promise<string[]> {
  const cached = await chrome.storage.local.get(msg.cacheKey);
  if (cached[msg.cacheKey]) return cached[msg.cacheKey];

  const { provider, apiKey, model } = await getSettings();
  const engine = PROVIDERS[provider] ?? PROVIDERS[DEFAULT_PROVIDER];

  // Solo los proveedores de red piden credencial. El traductor local no.
  if (engine.needsKey && !apiKey) {
    throw new Error(`"${engine.label}" necesita una API key. Configúrala en Opciones.`);
  }

  const blocks = await engine.translate(msg.blocks, { apiKey, model });
  await chrome.storage.local.set({ [msg.cacheKey]: blocks });
  return blocks;
}
```

**`src/background/providers/types.ts`** — el contrato que iguala a los cinco:

```ts
export interface ProviderOptions {
  apiKey?: string;   // opcional: el traductor local no la usa
  model?: string;
}

export interface TranslationProvider {
  id: string;
  label: string;           // lo que ve el usuario en el desplegable de Opciones
  needsKey: boolean;       // ¿hay que pedirle credencial?
  supportsPrompt: boolean; // ¿se le puede imponer el glosario?
  free: boolean;           // para marcarlo en la UI

  /** Detección en runtime. Solo la implementa quien puede no estar disponible
   *  (el traductor local); para los proveedores de red se asume true. */
  isAvailable?(): Promise<boolean>;

  translate(
    blocks: string[],
    o: ProviderOptions,
    onProgress?: (mensaje: string) => void,   // para avisar de descargas o reintentos
  ): Promise<string[]>;
}
```

**`src/background/providers/chrome-builtin.ts`** — Nivel 0, el que se usa por defecto:

```ts
import type { TranslationProvider } from './types';

// Traductor on-device de Chromium (Chrome 138+, también Brave). Sin key, sin red, sin cuota.
export const chromeBuiltin: TranslationProvider = {
  id: 'chrome-builtin',
  label: 'Traductor del navegador (local, gratis)',
  needsKey: false,
  supportsPrompt: false,   // no acepta instrucciones: sin glosario
  free: true,

  // Detección en tiempo de ejecución: nunca deducir la disponibilidad
  // del nombre ni de la versión del navegador.
  async isAvailable(): Promise<boolean> {
    if (!('Translator' in self)) return false;   // ojo: T mayúscula
    const estado = await Translator.availability(CFG);
    return estado !== 'unavailable';
  },

  async translate(blocks, _o, onProgress) {
    if (!('Translator' in self)) {
      throw new Error('Este navegador no expone el traductor local. Configura otro proveedor en Opciones.');
    }

    const estado = await Translator.availability(CFG);

    // Tres estados, tres tratamientos distintos:
    //   'available'    → listo, traduce ya
    //   'downloadable' → falta bajar el paquete de idioma: avisar del progreso
    //   'unavailable'  → aquí sí se cae al proveedor de respaldo
    if (estado === 'unavailable') {
      throw new Error('El traductor local no está disponible en este navegador. Configura otro proveedor en Opciones.');
    }
    if (estado === 'downloadable') {
      onProgress?.('Descargando el paquete de idioma (solo la primera vez)…');
    }

    const t = await Translator.create({
      ...CFG,
      monitor(m: any) {
        m.addEventListener('downloadprogress', (e: any) =>
          onProgress?.(`Descargando modelo: ${Math.round(e.loaded * 100)}%`)
        );
      },
    });

    // Local e instantáneo: no compensa complicarse con lotes.
    const out: string[] = [];
    for (const b of blocks) out.push(await t.translate(b));
    return out;
  },
};

const CFG = { sourceLanguage: 'en', targetLanguage: 'es' } as const;
```

> Dos detalles que solo se descubren probándolo: el global se llama `Translator` **con T mayúscula** (`'translator' in self` da siempre `false` y parece que la API no existe), y la primera traducción puede tardar por la descarga del paquete — sin un aviso de progreso, el usuario cree que se colgó.

**`src/background/providers/groq.ts`** — Nivel 1, gratuito con key propia y **con glosario**:

```ts
import { SYSTEM_PROMPT } from '../../shared/prompt';
import type { TranslationProvider } from './types';

// API compatible con el formato de OpenAI: este mismo archivo sirve, cambiando
// baseURL y modelo, para Cerebras, OpenRouter, Together y varios más.
export const groq: TranslationProvider = {
  id: 'groq',
  label: 'Groq (gratis, requiere key)',
  needsKey: true,
  supportsPrompt: true,
  free: true,

  async translate(blocks, o) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${o.apiKey}`,
      },
      body: JSON.stringify({
        model: o.model || 'openai/gpt-oss-120b',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_JSON_OBJECT },
          { role: 'user', content: JSON.stringify({ blocks }) },
        ],
      }),
    });

    if (res.status === 429) throw new Error('Cuota gratuita agotada. Reintenta más tarde o cambia de proveedor en Opciones.');
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const out = JSON.parse(data.choices[0].message.content).blocks;

    if (!Array.isArray(out) || out.length !== blocks.length) {
      throw new Error('La respuesta no coincide con el número de bloques enviados.');
    }
    return out;
  },
};
```

> Nota: muchos proveedores compatibles con OpenAI exigen que la salida JSON sea un **objeto**, no un array suelto. Por eso aquí se envía y se recibe `{ "blocks": [...] }`. Es la única diferencia real respecto a la versión de Anthropic; guarda esa variante del prompt en `shared/prompt.ts` como `SYSTEM_PROMPT_JSON_OBJECT`.

**`src/background/providers/gemini.ts`** — misma idea, otro endpoint:

```ts
// POST https://generativelanguage.googleapis.com/v1beta/models/<modelo>:generateContent?key=<API_KEY>
// body: { systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
//         contents: [{ parts: [{ text: JSON.stringify(blocks) }] }],
//         generationConfig: { temperature: 0, responseMimeType: 'application/json' } }
// La respuesta útil está en data.candidates[0].content.parts[0].text
```

**`src/background/providers/anthropic.ts`** — Nivel 2, de pago y opcional (≈0,01 USD por enunciado, ver §1.3):

```ts
import { SYSTEM_PROMPT } from '../../shared/prompt';
import type { TranslationProvider } from './types';

export const anthropic: TranslationProvider = {
  id: 'anthropic',
  label: 'Claude Haiku 4.5 (de pago, máxima calidad)',
  needsKey: true,
  supportsPrompt: true,
  free: false,

  async translate(blocks: string[], o: { apiKey: string; model: string }): Promise<string[]> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': o.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: o.model || 'claude-haiku-4-5',
        max_tokens: 8192,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: JSON.stringify(blocks) },
          { role: 'assistant', content: '[' },   // prefill: fuerza el JSON
        ],
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const raw = '[' + data.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    const out = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!Array.isArray(out) || out.length !== blocks.length) {
      throw new Error('La respuesta no coincide con el número de bloques enviados.');
    }
    return out;
  },
};
```

**`src/background/providers/index.ts`** — el registro que ve el resto del código:

```ts
import { chromeBuiltin } from './chrome-builtin';
import { groq } from './groq';
import { gemini } from './gemini';
import { anthropic } from './anthropic';
import { deepl } from './deepl';
import type { TranslationProvider } from './types';

export const PROVIDERS: Record<string, TranslationProvider> = {
  'chrome-builtin': chromeBuiltin,
  groq,
  gemini,
  anthropic,
  deepl,
};

export const DEFAULT_PROVIDER = 'chrome-builtin';
```

La página de Opciones se construye sola a partir de este objeto: recorres `PROVIDERS`, pintas un desplegable con cada `label`, y **solo muestras el campo de API key si el proveedor elegido tiene `needsKey: true`**. Añadir un proveedor nuevo no obliga a tocar la UI.

**`src/manifest.json`**:

```json
{
  "manifest_version": 3,
  "name": "CP Statement Translator",
  "version": "0.1.0",
  "description": "Traduce enunciados de jueces online preservando LaTeX y bloques de código.",
  "permissions": ["storage"],
  "host_permissions": [
    "https://codeforces.com/*",
    "https://cses.fi/*",
    "https://api.groq.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.anthropic.com/*",
    "https://api-free.deepl.com/*"
  ],
  "background": { "service_worker": "src/background/service-worker.ts", "type": "module" },
  "content_scripts": [
    {
      "matches": [
        "https://codeforces.com/problemset/problem/*",
        "https://codeforces.com/contest/*/problem/*",
        "https://codeforces.com/gym/*/problem/*",
        "https://cses.fi/problemset/task/*"
      ],
      "js": ["src/content/index.ts"],
      "css": ["src/content/ui.css"],
      "run_at": "document_idle"
    }
  ],
  "options_page": "src/options/options.html",
  "action": { "default_title": "Traducir enunciado" }
}
```

> Los dominios de las APIs solo hacen falta para los proveedores de red. **El traductor local no necesita ningún `host_permission`**, porque no sale a Internet: si acabas usando solo el Nivel 0, la extensión pide exactamente un permiso (`storage`) y ninguna conexión externa. Eso es un argumento de peso el día que la compartas con tu club.

---

## 4. Hoja de Ruta

Cada fase termina en un estado **verificable**. No pases a la siguiente sin cumplir su *Definition of Done*.

### Fase 0 — Reconocimiento del DOM (1–2 h)
1. Abre un problema de Codeforces → DevTools → pega el snippet del **Apéndice A**.
2. Anota: selector de la raíz, de los bloques, de los `pre`, y en qué estado está el LaTeX.
3. Guarda el HTML real: `copy($0.outerHTML)` sobre `.problem-statement` → `tests/fixtures/cf-1850a.html`.
4. Repite en CSES.

**DoD:** tienes escritos, en papel o en el README, los selectores de ambos jueces y dos fixtures guardados.

### Fase 1 — Andamiaje y botón (2 h)
```bash
npm create vite@latest cp-statement-translator -- --template vanilla-ts
cd cp-statement-translator
npm i -D @crxjs/vite-plugin @types/chrome vitest jsdom
npm run build
```
Carga en `chrome://extensions` → *Modo desarrollador* → *Cargar descomprimida* → carpeta `dist/`.

**DoD:** al abrir un problema de Codeforces aparece un botón "Traducir al español" junto al título; al pulsarlo imprime en consola el número de bloques detectados.

### Fase 2 — El core, con traducción falsa (3–4 h) ← **la fase importante**
Implementa `protector.ts`, `segmenter.ts`, `validator.ts`. **Sin red.** Usa un traductor simulado:

```ts
const fakeTranslate = (s: string) => `[ES] ${s}`;
```

Tests obligatorios en `tests/protector.spec.ts`:
- **Round-trip:** `restore(extract(block).text, slots)` reproduce el contenido original nodo a nodo.
- **Identidad:** cada `<pre>` y cada `.MathJax` del resultado es **la misma instancia** (`===`) que la del original.
- **Fuga:** el texto enviado a traducir no contiene `$`, `\`, `{`, ni ninguna subcadena del contenido de un `<pre>`.
- **Anidación:** un `<b>` con una fórmula dentro sobrevive con formato y fórmula.
- **Robustez:** si la "traducción" borra un token, `isValid` devuelve `false` y el bloque queda en inglés.

**DoD:** el enunciado real se ve con `[ES]` delante de cada párrafo, las fórmulas y los ejemplos **idénticos**, y `npm run test` en verde.

> Si llegas aquí con los tests pasando, el riesgo técnico del proyecto ya está resuelto. Lo que queda es fontanería.

### Fase 3 — Página de opciones y service worker (2 h)
`options.html` construido a partir de `PROVIDERS`: desplegable con los `label`, y el campo de API key **solo visible si el proveedor elegido tiene `needsKey: true`**. Por defecto, el traductor local: el usuario no ve ningún campo que rellenar. Service worker que responde a `TRANSLATE` con eco. Si se introduce una key, valídala con una llamada mínima al guardarla.

**DoD:** el content script recibe respuesta del service worker, la extensión funciona sin haber escrito ninguna key, y cuando se usa una, nunca aparece en la consola de la página.

### Fase 4 — Traducción real, empezando por la gratuita (2–3 h)

Orden deliberado: **lo que no cuesta nada primero**. Así puedes iterar el algoritmo las veces que haga falta sin mirar el contador.

1. **`chrome-builtin.ts`.** Sin key, sin red. La primera ejecución descarga el paquete de idioma; enséñalo con un mensaje de progreso o parecerá colgado.
   **Experimento obligatorio:** traduce 5 enunciados y cuenta cuántos bloques rechaza `isValid()`. Eso te dice si el traductor local respeta los `⟦n⟧`. Si el porcentaje de fallo es alto, prueba otro marcador (`«3»`, `@@3@@`) antes de descartar el proveedor — es un cambio de dos constantes.
2. **`groq.ts`.** Key gratuita, sin tarjeta. Aquí ya puedes ajustar el glosario del system prompt contra 3–4 enunciados de distinta dificultad (un 800, un 1200 y uno cargado de fórmulas).
3. **`anthropic.ts`** (opcional). Solo si quieres comparar el techo de calidad. Traducir 10 enunciados para la comparativa cuesta unos 0,11 USD.

Compara los tres sobre los **mismos** problemas y anota el resultado en el README. Es una decisión con datos, y de paso tienes algo concreto que enseñar cuando presentes el proyecto.

**DoD:** un problema Div 2 A y uno C se traducen completos y legibles **con el proveedor por defecto y sin que el usuario haya configurado nada**, con 0 fórmulas rotas.

### Fase 5 — UX y caché (2 h)
Estados del botón (idle / cargando / listo / error), toggle ES↔EN con el snapshot, caché en `chrome.storage.local`, marca visual de bloques no traducidos.

**DoD:** recargar la página y volver a pulsar es instantáneo y no gasta cuota.

### Fase 6 — Segundo juez: CSES (1–2 h)
Escribe `cses.ts`. **Si tienes que tocar `core/`, el diseño falló** — corrige la abstracción, no el síntoma.

**DoD:** funciona en CSES sin haber modificado ni una línea de `core/`.

### Fase 7 — Pulido y distribución (2 h)
README con capturas, manejo de 429 con *backoff*, `npm run build` reproducible, `.zip` para compartir en el club. Opcional: proxy (nivel 3 de §1.4) si lo publicas.

**Tiempo total estimado:** 15–20 horas de trabajo efectivo.

---

## 5. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El modelo altera o pierde tokens `⟦n⟧` | Fórmula fuera de sitio | Validación estricta + reintento + fallback a inglés (§2.8) |
| Codeforces cambia clases CSS | La extensión deja de encontrar el enunciado | Todo el acoplamiento está en `adapters/`; fallo silencioso y limpio si `findStatementRoot` devuelve `null` |
| MathJax no ha terminado al pulsar | LaTeX crudo traducido | `whenMathReady()` + `rawMathPattern` como segunda red |
| API key filtrada | Coste económico | Nunca en el repo; `chrome.storage.local`; proxy si se distribuye |
| 429 / cuota agotada | Traducción falla | *Exponential backoff*, caché agresiva, mensaje claro |
| Bloques muy largos → respuesta truncada | JSON inválido | Trocear por lotes (p. ej. máx. 6 000 caracteres por petición) |
| El traductor local altera los `⟦n⟧` | El Nivel 0 deja de ser viable | Medirlo en la Fase 4, no suponerlo. Probar marcadores alternativos antes de descartarlo |
| El traductor local no existe (Firefox, Safari, Chrome móvil, versión antigua) | La extensión no traduce al instalar | `isAvailable()` al arrancar — detección en runtime, nunca por nombre de navegador. Si falta, mensaje claro que ofrece configurar un proveedor con key |
| Un plan gratuito cambia de reglas o desaparece | El proveedor elegido deja de funcionar | Cinco proveedores intercambiables desde Opciones; el Nivel 0 siempre queda como red de seguridad |
| Se agota la cuota diaria gratuita (429) | No se puede traducir más hoy | Caché agresiva + mensaje que sugiere cambiar al traductor local, que no tiene cuota |
| Traducción literal rompe el significado del problema | Resolver el problema equivocado | Toggle EN siempre a un clic; el original nunca se destruye |

---

## 6. Siguientes pasos (una vez estable)

- Atajo de teclado (`commands` en el manifest) para traducir sin ratón.
- Traducción *streaming* por bloques: pintar a medida que llegan.
- Soporte AtCoder / SPOJ / e-olymp: solo adapters nuevos.
- Modo "glosario personal": términos que tú prefieres en inglés (`heap`, `bitmask`) configurables desde opciones.
- **Failover automático entre proveedores:** si el LLM gratuito devuelve 429, reintentar solo con el traductor local en vez de mostrar un error. El usuario no debería enterarse de las cuotas.
- Publicación en Chrome Web Store (requiere el proxy del nivel 3).

---

## Apéndice A — Snippet de reconocimiento (pegar en DevTools)

```js
(() => {
  const root = document.querySelector('.problem-statement') // Codeforces
            || document.querySelector('.content');          // CSES (verificar)
  if (!root) return console.warn('Raíz no encontrada — inspecciona manualmente');

  console.log('Raíz:', root);
  console.log('pre:', root.querySelectorAll('pre').length);
  console.log('code:', root.querySelectorAll('code').length);
  console.log('MathJax renderizado:', root.querySelectorAll('.MathJax, .katex').length);
  console.log('script math/tex:', root.querySelectorAll('script[type^="math/tex"]').length);
  console.log('LaTeX crudo $$$:', (root.textContent.match(/\$\$\$/g) || []).length);
  console.log('Bloques candidatos:', root.querySelectorAll('p, li, .section-title').length);

  // Clases inline usadas dentro de los párrafos (para afinar opaque/inline):
  const clases = new Set();
  root.querySelectorAll('p *').forEach(e => e.classList.forEach(c => clases.add(c)));
  console.log('Clases inline:', [...clases]);
})();
```

## Apéndice B — Prototipo userscript (Fase 0, desechable)

```js
// ==UserScript==
// @name         CP Translator (probe)
// @match        https://codeforces.com/problemset/problem/*
// @grant        GM_xmlhttpRequest
// @connect      api.anthropic.com
// ==/UserScript==
(function () {
  const root = document.querySelector('.problem-statement');
  if (!root) return;
  const btn = document.createElement('button');
  btn.textContent = 'Traducir (probe)';
  btn.onclick = () => {
    const blocks = [...root.querySelectorAll('p')].filter(p => !p.closest('pre'));
    console.log('Bloques:', blocks.length, blocks.map(b => b.textContent.slice(0, 60)));
  };
  root.prepend(btn);
})();
```

---

## Referencias

- Chrome Extensions MV3: https://developer.chrome.com/docs/extensions/develop
- CRXJS (Vite plugin): https://crxjs.dev
- WXT (alternativa multi-navegador): https://wxt.dev
- **Chrome Translator API (on-device, gratis):** https://developer.chrome.com/docs/ai/translator-api
- **Groq — consola y documentación:** https://console.groq.com/docs
- **Google AI Studio (Gemini) — límites gratuitos vigentes:** https://ai.google.dev/gemini-api/docs/rate-limits
- OpenRouter (modelos `:free`): https://openrouter.ai/docs
- Claude API — Messages: https://docs.claude.com/en/api/overview
- Modelos y precios vigentes: https://docs.claude.com/en/docs/about-claude/models/overview
- DeepL API — `tag_handling`: https://developers.deepl.com/docs
- MDN — `TreeWalker`, `DocumentFragment`, `replaceChildren`
