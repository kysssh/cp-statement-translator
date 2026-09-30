# Guía de Implementación — de cero a la extensión funcionando

**Cómo usar este documento:** es tu ruta de trabajo diaria. Cada tarea te dice qué archivo tocar, qué conceptos necesitas antes, dónde estudiarlos, cómo atacarla y cómo saber que quedó bien. No trae el código resuelto a propósito: el objetivo es que aprendas, no que copies.

---

## Los tres documentos y para qué sirve cada uno

| Documento | Responde a | Cuándo lo abres |
|---|---|---|
| `plan-traductor-enunciados-cp.md` | ¿Qué construyo y por qué así? | Al principio, y cuando dudes de una decisión de diseño |
| `diccionario-tecnico.md` | ¿Qué significa esta palabra? | Cada vez que una tarea mencione un término que no domines |
| **`guia-de-implementacion.md`** (este) | ¿Qué hago ahora mismo? | Todos los días, mientras programas |

---

## Cómo está organizada

**7 etapas → 30 tareas.** Cada tarea (`T01`, `T02`…) es una sesión de trabajo de entre 20 minutos y 2 horas que termina en algo verificable. Las etapas se corresponden con las fases del plan.

### Anatomía de una tarea

```
### T07 — Nombre de la tarea
🟡 Media · ⏱ 45 min · 📁 src/core/protector.ts · ⬅ Depende de T06

🎯 Qué construyes        → el objetivo en dos líneas
🧠 Conceptos previos     → qué tienes que entender antes (📖 = está en el diccionario)
🔍 Investiga primero     → enlaces y búsquedas concretas
🔨 Cómo atacarlo         → los pasos, en orden, sin darte el código
✅ Verificación          → cómo sabes que terminaste
💬 Si te atascas         → qué preguntarme exactamente
```

### Semáforo de dificultad

- 🟢 **Fácil** — mecánico, seguir instrucciones. Si te traba más de 30 min, pregunta.
- 🟡 **Media** — hay que pensar, pero el camino está claro.
- 🔴 **Difícil** — aquí está el valor del proyecto. Tómate tu tiempo, y no pasa nada si preguntas.

---

## Las reglas del juego (léelas una vez, en serio)

Dijiste que quieres aprender mientras lo construyes. Eso cambia cómo deberíamos trabajar los dos:

1. **La regla de los 20 minutos.** Ante un problema, investiga 20 minutos por tu cuenta antes de preguntarme. Si a los 20 no avanzaste, pregunta — quedarse tres horas atascado no es aprender, es sufrir.
2. **Escribe el código a mano.** Aunque yo te dé un fragmento, tecléalo en vez de copiar y pegar. Suena a consejo de abuelo y funciona: al teclear te topas con los errores de sintaxis y los nombres reales de las cosas.
3. **Pide pistas antes que soluciones.** Hay una escala: *explícame el concepto* → *dame una pista* → *dame el esqueleto* → *dame el código*. Empieza siempre por arriba. Ver §1.1.
4. **Un commit por tarea.** `git commit -m "T07: extract() protege nodos opacos"`. Al final tendrás un historial que es literalmente el diario del proyecto, y practicas git sin esfuerzo extra.
5. **Bitácora.** Un `DEV-LOG.md` con 3 líneas por sesión: qué hice, qué me costó, qué aprendí. Plantilla en el Apéndice D. Cuando presentes esto en el club, ese archivo vale oro.
6. **No pases a la tarea siguiente sin la ✅.** Las dependencias son reales: si `extract()` está a medias, `restore()` te va a volver loco.

---

# Parte 1 — Sistema de soporte: cómo preguntarme

## 1.1 Los cuatro niveles de ayuda

Pídeme el nivel que necesitas, explícitamente. Cambia mucho lo que recibes.

| Nivel | Cuándo | Cómo lo pides |
|---|---|---|
| **1. Concepto** | No entiendes *qué* es algo | "Explícame qué es un DocumentFragment y por qué lo necesito en T15, sin código" |
| **2. Pista** | Entiendes el objetivo pero no ves el camino | "Estoy en T13, sé que tengo que cortar el recorrido en los nodos opacos pero no sé dónde. Dame una pista, no la solución" |
| **3. Esqueleto** | Ves el camino pero no la sintaxis | "Dame la firma de la función y los comentarios de cada paso de T13, yo relleno el cuerpo" |
| **4. Código** | Ya lo intentaste y no sale, o es código mecánico sin valor de aprendizaje | "Ya llevo 40 min con T13, aquí está mi intento y el error. Muéstrame la versión correcta y explícame qué me faltaba" |

Para el `manifest.json` o la configuración de Vite, pide nivel 4 sin culpa: copiar configuración no te enseña nada. Para `extract()` y `restore()`, quédate en 1–2 todo lo que aguantes: **ahí es donde está el aprendizaje real del proyecto**.

## 1.2 Plantilla de pregunta para el chat

Copia esto y rellénalo. Una pregunta bien planteada te ahorra tres idas y vueltas:

```
Proyecto: traductor de enunciados (extensión MV3 + TypeScript)
Tarea: T13 — extract() con nodos opacos
Nivel de ayuda que quiero: 2 (pista)

Lo que intento hacer:
<una frase>

Lo que llevo escrito:
```ts
<tu código, aunque esté a medias>
```

Lo que pasa:
<error exacto copiado de la consola, o "esperaba X y sale Y">

Lo que ya probé:
<1-2 cosas>
```

Tres cosas que suben mucho la calidad de la respuesta:

- **Pega el error completo**, no lo resumas. El `Cannot read properties of null (reading 'querySelector')` dice exactamente qué línea falló.
- **Di en qué tarea estás.** Con "T13" ya sé el archivo, el objetivo y lo que deberías tener hecho.
- **Sube el HTML del fixture** si el problema es de parseo. Sin el HTML real, todo lo que yo diga son suposiciones.

## 1.3 Preguntas que valen más que "no me sale"

Guárdalas, funcionan en cualquier tarea:

- "¿Por qué mi versión es peor que esta otra?" (aprendes el criterio, no la respuesta)
- "¿Qué caso límite se me está escapando?"
- "Revisa este código como si fueras a rechazármelo en un code review"
- "Explícame esta línea token por token" — perfecta para sintaxis de JS que te resulta marciana
- "¿Qué debería saber de X antes de seguir?"
- "Hazme 5 preguntas sobre lo que acabo de escribir para ver si de verdad lo entendí"

## 1.4 Claude Code: qué es, qué cuesta y si te conviene

**Qué es.** Un agente que corre en tu terminal (o dentro de VS Code), ve tu repositorio completo, lee y escribe archivos, ejecuta comandos y corre los tests. La diferencia con el chat: aquí no le pegas fragmentos, él ya tiene el proyecto delante.

**Lo que tienes que saber antes de ilusionarte: no es gratis.** Requiere una suscripción de pago (Claude Pro, unos 20 USD/mes) o una cuenta de Console con créditos de API facturados por uso. El plan gratuito de Claude.ai **no** incluye acceso. Instalarlo sí es gratis; usarlo no.

Dado que el proyecto entero está diseñado para costar 0, mi recomendación honesta:

> **Haz el proyecto con el chat.** Es suficiente y es gratis. Considera Claude Code solo si ya pagas Pro por otra cosa, o si más adelante te metes en un proyecto grande donde pasarte el día copiando y pegando archivos te esté costando horas.

**Si decides usarlo**, lo esencial:

```bash
# Instalación nativa (no necesita Node.js)
curl -fsSL https://claude.ai/install.sh | bash        # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex               # Windows PowerShell

# Alternativa por npm (requiere Node.js reciente)
npm install -g @anthropic-ai/claude-code

claude --version      # verificar
cd cp-statement-translator
claude                # arrancar dentro del proyecto
```

Documentación oficial: https://docs.claude.com/en/docs/claude-code/overview

**Cuándo usar cada uno, si tienes los dos:**

| Situación | Herramienta |
|---|---|
| "No entiendo qué es un service worker" | Chat |
| "Explícame la tarea T15 antes de empezar" | Chat |
| "Corre los tests y dime por qué fallan 3" | Claude Code |
| "Renombra este concepto en los 6 archivos donde aparece" | Claude Code |
| "Revisa mi `protector.ts` completo" | Cualquiera (en el chat, pega el archivo) |
| "Estoy aprendiendo, quiero pistas, no código" | **Chat** — es más fácil controlar el nivel de ayuda |

## 1.5 `CLAUDE.md` — el archivo que hace que valga la pena

Si usas Claude Code, crea este archivo en la raíz del proyecto. Se lee automáticamente en cada sesión y evita que te dé respuestas genéricas:

```markdown
# Proyecto: traductor de enunciados de programación competitiva

Extensión de Chrome (Manifest V3) en TypeScript que traduce enunciados EN→ES
en Codeforces y CSES sin tocar el LaTeX ni los bloques de código.

## Contexto sobre mí
Soy estudiante. Vengo de C++ y backend; frontend y TypeScript son nuevos para mí.
Estoy haciendo este proyecto PARA APRENDER.

## Cómo quiero que trabajes conmigo
- Por defecto dame PISTAS y EXPLICACIONES, no el código terminado.
- Si te pido código, explícame después qué hace cada parte no obvia.
- Si ves que estoy tomando un mal camino, dímelo antes de ayudarme a recorrerlo.
- No refactorices archivos que no te pedí.
- Nunca escribas en `src/core/protector.ts` sin que yo lo pida explícitamente:
  ese archivo lo escribo yo, es el que quiero aprender.

## Reglas técnicas innegociables
- Nunca usar `innerHTML` para insertar contenido traducido.
- Nunca aplicar regex sobre HTML: se recorre el DOM.
- `src/core/` es lógica pura: sin `chrome.*`, sin `fetch`, sin estado global.
- Todo lo específico de un juez vive en `src/adapters/`.
- Un cambio en `core/` sin test que lo cubra no se acepta.

## Comandos
- `npm run build` — compila a dist/
- `npm run test` — Vitest
```

## 1.6 Qué NO preguntarme (y sí buscar tú)

Porque buscarlo te enseña más que la respuesta:

- Qué hace un método concreto de JS → MDN, 30 segundos
- Errores de sintaxis que el editor ya te subraya
- "¿Cómo instalo Node?" → la documentación oficial está mejor que yo
- Cifras que cambian cada mes (límites de cuotas, precios) → la página del proveedor

Y el caso opuesto, donde **sí** deberías preguntar de una: cuando lleves más de 20 minutos y sospeches que el problema no es tu código sino tu modelo mental de cómo funciona algo. Ese es el momento exacto en que una explicación te ahorra una tarde.

---

# Parte 2 — Mapa completo de la ruta

| # | Tarea | Dif. | Tiempo | Depende |
|---|---|---|---|---|
| **Etapa 0 — Reconocimiento (sin código)** ||||
| T01 | Verificar herramientas y versiones | 🟢 | 20 min | — |
| T02 | Explorar el DOM de Codeforces con DevTools | 🟢 | 40 min | T01 |
| T03 | Capturar los fixtures HTML | 🟢 | 20 min | T02 |
| T04 | Explorar el DOM de CSES | 🟢 | 30 min | T02 |
| **Etapa 1 — Entorno y primer botón** ||||
| T05 | Crear el proyecto con Vite + TypeScript | 🟢 | 30 min | T01 |
| T06 | Configurar CRXJS y el manifest mínimo | 🟡 | 45 min | T05 |
| T07 | Content script "hola mundo" en Codeforces | 🟢 | 30 min | T06 |
| T08 | Inyectar el botón en la página | 🟡 | 45 min | T07 |
| **Etapa 2 — El núcleo (aquí está el proyecto)** ||||
| T09 | Configurar Vitest + jsdom | 🟡 | 40 min | T05 |
| T10 | Definir la interfaz `SiteAdapter` | 🟡 | 40 min | T03 |
| T11 | Escribir el adapter de Codeforces | 🟢 | 30 min | T10 |
| T12 | `collectBlocks()` — segmentar el enunciado | 🟡 | 45 min | T11 |
| T13 | `extract()` v1 — solo texto | 🟡 | 60 min | T12 |
| T14 | `extract()` v2 — nodos opacos → `⟦n⟧` | 🔴 | 60 min | T13 |
| T15 | `extract()` v3 — inline y LaTeX crudo | 🔴 | 60 min | T14 |
| T16 | `restore()` — reconstruir el árbol | 🔴 | 90 min | T15 |
| T17 | Test de round-trip | 🔴 | 60 min | T16 |
| T18 | `isValid()` — validar marcadores | 🟢 | 30 min | T17 |
| T19 | Conectar todo con un traductor falso | 🟡 | 45 min | T18, T08 |
| **Etapa 3 — Red y proveedores** ||||
| T20 | Protocolo de mensajes tipado | 🟡 | 40 min | T19 |
| T21 | Service worker con eco | 🟡 | 45 min | T20 |
| T22 | `settings.ts` y la página de Opciones | 🟡 | 60 min | T21 |
| T23 | Proveedor: traductor local de Chrome | 🟡 | 60 min | T22 |
| T24 | Proveedor: Groq + system prompt | 🟡 | 60 min | T23 |
| T25 | Errores, reintentos y degradación | 🔴 | 60 min | T24 |
| **Etapa 4 — Experiencia de uso** ||||
| T26 | Estados del botón y mensajes | 🟢 | 45 min | T25 |
| T27 | Toggle ES ↔ EN con snapshot | 🟡 | 45 min | T26 |
| T28 | Caché con hash del enunciado | 🟡 | 45 min | T27 |
| **Etapa 5 — Segundo juez y cierre** ||||
| T29 | Adapter de CSES | 🟡 | 60 min | T28, T04 |
| T30 | README, empaquetado y bitácora final | 🟢 | 60 min | T29 |

**Total: 22–25 horas.** A 2 h por sesión son unas 12 sesiones. No intentes hacerlo en dos fines de semana.

> **Atajo válido:** si solo quieres ver algo funcionando cuanto antes, la ruta mínima es T01 → T05 → T06 → T07 → T08 → T23. Tendrás un botón que traduce sin proteger nada (fórmulas rotas incluidas), pero tendrás **feedback visual en 4 horas**, y eso motiva mucho. Después vuelves a T09 y haces las cosas bien.

---

# Parte 3 — Las tareas

## Etapa 0 — Reconocimiento

### T01 — Verificar herramientas y versiones
🟢 Fácil · ⏱ 20 min · 📁 — · ⬅ —

**🎯 Qué construyes**
Nada todavía. Te aseguras de que tu máquina tiene lo necesario, para no descubrir a mitad de T06 que tu Node es de 2022.

**🔨 Cómo atacarlo**
```bash
node --version    # necesitas v20 o superior
npm --version
git --version
```
Y en Chrome: abre `chrome://version` y confirma que estás en **138 o superior** (lo necesita el traductor local). Instala VS Code y las extensiones ESLint, Prettier, Vitest y Error Lens.

**✅ Verificación**
Los tres comandos responden con un número, Chrome es 138+, y VS Code abre una carpeta vacía sin quejarse.

---

### T02 — Explorar el DOM de Codeforces con DevTools
🟢 Fácil · ⏱ 40 min · 📁 `NOTAS-DOM.md` · ⬅ T01

**🎯 Qué construyes**
Un archivo de notas con los selectores reales del enunciado. **Esta es la tarea que más tiempo te va a ahorrar de todo el proyecto**: sin ella, escribirás código contra un DOM imaginario.

**🧠 Conceptos previos**
DOM 📖 · Selector CSS 📖 · DevTools 📖 · Element vs TextNode 📖

**🔍 Investiga primero**
- MDN, busca `Document.querySelectorAll` y `Element.matches`
- https://developer.chrome.com/docs/devtools/dom — panel Elements en 10 minutos

**🔨 Cómo atacarlo**
1. Abre un problema Div 2 A cualquiera de Codeforces.
2. F12 → pestaña **Elements**. Pasa el ratón por el HTML y mira qué se resalta en la página. Busca el `div` que contiene todo el enunciado.
3. Pega el snippet del **Apéndice A del plan** en la consola y anota lo que imprime.
4. Contesta por escrito en `NOTAS-DOM.md`:
   - ¿Cuál es el selector de la raíz del enunciado?
   - ¿En qué etiqueta están los ejemplos de entrada/salida?
   - ¿Las fórmulas aparecen como `$$$...$$$` o como `<span class="MathJax">`? ¿Cambia si recargas rápido?
   - ¿Qué clases usan las variables inline (`n`, `a_i`)?
   - ¿Qué elementos contienen texto traducible de verdad?
5. Repite en un problema Div 2 D con muchas fórmulas. ¿Cambia algo?

**✅ Verificación**
`NOTAS-DOM.md` responde las cinco preguntas con selectores concretos, no con "creo que".

**💬 Si te atascas**
> "Aquí está la salida del snippet de reconocimiento en Codeforces: `<pega>`. ¿Qué selectores debería usar como `opaqueSelector` y `blockSelector`, y por qué?"

---

### T03 — Capturar los fixtures HTML
🟢 Fácil · ⏱ 20 min · 📁 `tests/fixtures/` · ⬅ T02

**🎯 Qué construyes**
Dos archivos HTML reales guardados en disco, que serán la entrada de todos tus tests.

**🔨 Cómo atacarlo**
1. En DevTools → Elements, haz clic en el `div` del enunciado para seleccionarlo.
2. En la consola: `copy($0.outerHTML)` — se copia al portapapeles.
3. Pégalo en `tests/fixtures/cf-facil.html`.
4. Repite con un problema cargado de fórmulas → `cf-formulas.html`.

**✅ Verificación**
Abres los archivos en el navegador y ves el enunciado (feo, sin los estilos de Codeforces, pero completo y con los `<pre>` intactos).

**💡 Por qué importa:** un enunciado real trae `&nbsp;`, `<sup>`, imágenes y anidaciones que jamás se te ocurriría inventar a mano. Testear contra HTML inventado es testear contra tus propias suposiciones.

---

### T04 — Explorar el DOM de CSES
🟢 Fácil · ⏱ 30 min · 📁 `NOTAS-DOM.md` · ⬅ T02

Lo mismo que T02, en `https://cses.fi/problemset/task/1068`. Añade una sección a tus notas y guarda un tercer fixture. **No asumas que se parece a Codeforces**: delimitadores de LaTeX y estructura son distintos, y esa diferencia es justo lo que valida que tu diseño de adapters sirva.

---

## Etapa 1 — Entorno y primer botón

### T05 — Crear el proyecto con Vite + TypeScript
🟢 Fácil · ⏱ 30 min · 📁 raíz · ⬅ T01

**🧠 Conceptos previos**
npm 📖 · Bundler 📖 · Vite 📖 · TypeScript 📖 · `package.json` 📖

**🔍 Investiga primero**
- https://vite.dev/guide/ — solo "Getting Started"
- https://www.typescriptlang.org/docs/handbook/2/everyday-types.html — tipos básicos, 20 min

**🔨 Cómo atacarlo**
```bash
npm create vite@latest cp-statement-translator -- --template vanilla-ts
cd cp-statement-translator
npm install
npm install -D @types/chrome
git init && git add -A && git commit -m "T05: proyecto inicial"
```
Luego borra el contenido de ejemplo que genera Vite (`src/counter.ts`, `src/style.css`, etc.) y crea el árbol de carpetas del plan (§3.1), aunque esté vacío. Tener la estructura delante te ordena la cabeza.

**✅ Verificación**
`npm run build` termina sin errores y aparece `dist/`. Un commit hecho.

---

### T06 — Configurar CRXJS y el manifest mínimo
🟡 Media · ⏱ 45 min · 📁 `vite.config.ts`, `src/manifest.json` · ⬅ T05

**🎯 Qué construyes**
La tubería que convierte tus `.ts` en una extensión que Chrome sabe cargar.

**🧠 Conceptos previos**
Manifest 📖 · MV3 📖 · Extensión descomprimida 📖 · `host_permissions` 📖

**🔍 Investiga primero**
- https://crxjs.dev/vite-plugin — la guía de inicio
- https://developer.chrome.com/docs/extensions/get-started — "Hello World" oficial
- https://developer.chrome.com/docs/extensions/reference/manifest — referencia del manifest

**🔨 Cómo atacarlo**
1. `npm i -D @crxjs/vite-plugin`
2. En `vite.config.ts`, importa el plugin y pásale tu `manifest.json`.
3. Escribe un `manifest.json` **mínimo**: `manifest_version`, `name`, `version`, y un `content_scripts` que apunte a `src/content/index.ts` con `matches` de Codeforces. Nada más por ahora — el manifest completo del plan lo irás llenando tarea a tarea.
4. `npm run build`.
5. `chrome://extensions` → activa **Modo desarrollador** → **Cargar descomprimida** → selecciona `dist/`.

**✅ Verificación**
La extensión aparece en la lista sin el triángulo rojo de error.

**💬 Si te atascas**
Esto es configuración: pide nivel 4 sin dudarlo. *"Mi vite.config.ts es `<pega>` y al construir sale `<error>`. Dame la configuración correcta y explícame qué hace cada línea."*

---

### T07 — Content script "hola mundo"
🟢 Fácil · ⏱ 30 min · 📁 `src/content/index.ts` · ⬅ T06

**🎯 Qué construyes**
La prueba de que tu código se está ejecutando dentro de Codeforces.

**🧠 Conceptos previos**
Content script 📖 · Mundo aislado 📖 · `run_at` 📖

**🔨 Cómo atacarlo**
1. En `src/content/index.ts`: un `console.log('extensión viva')` y un `console.log(document.querySelector('.problem-statement'))`.
2. `npm run build`, recarga la extensión (botón ↻ en `chrome://extensions`), recarga la página del problema.
3. Abre la consola de la página y búscalo.

**✅ Verificación**
Ves tu mensaje **y** el `div` del enunciado impreso. Si sale `null`, tu selector de T02 está mal o el script corre demasiado pronto.

**🐛 Error clásico:** buscas tu `console.log` en la consola de la extensión en vez de en la de la página. El content script imprime en la consola de **la pestaña**.

---

### T08 — Inyectar el botón
🟡 Media · ⏱ 45 min · 📁 `src/content/button.ts`, `src/content/ui.css` · ⬅ T07

**🎯 Qué construyes**
El botón visible, con estilos propios, colgado del sitio correcto del enunciado.

**🧠 Conceptos previos**
`createElement` · `appendChild` 📖 · Event listener 📖 · `prepend`

**🔍 Investiga primero**
- MDN: `Document.createElement`, `Element.prepend`, `EventTarget.addEventListener`
- Búsqueda: `chrome extension inject button into page content script`

**🔨 Cómo atacarlo**
1. Función `mountButton(contenedor, alPulsar)` que crea un `<button>`, le pone texto y clase, le engancha el `onclick` y lo inserta.
2. Dale una clase propia con prefijo (`cpt-button`) y estilízalo en `ui.css`. El prefijo evita que los estilos de Codeforces te pisen y que tú pises los suyos.
3. Llámala desde `index.ts` pasándole el `mountPoint`.
4. El `onclick` por ahora solo hace `console.log('clic')`.

**✅ Verificación**
El botón se ve bien colocado en la página real y responde al clic. Haz una captura: es el primer hito presentable del proyecto.

---

## Etapa 2 — El núcleo

> ⚠️ **Las siguientes seis tareas son el corazón del proyecto.** Aquí es donde deberías pedirme pistas en vez de código. Si sales de T17 con los tests en verde, lo difícil está hecho.

### T09 — Configurar Vitest + jsdom
🟡 Media · ⏱ 40 min · 📁 `vitest.config.ts`, `tests/` · ⬅ T05

**🎯 Qué construyes**
La capacidad de probar tu lógica de DOM **desde la terminal, en un segundo**, sin abrir Chrome.

**🧠 Conceptos previos**
Test unitario 📖 · jsdom 📖 · Aserción 📖 · Fixture 📖

**🔍 Investiga primero**
- https://vitest.dev/guide/ — inicio y "Environment"
- Busca: `vitest jsdom environment configuration`

**🔨 Cómo atacarlo**
1. `npm i -D vitest jsdom`
2. Configura el entorno `jsdom` (en `vitest.config.ts` o con el comentario `// @vitest-environment jsdom` arriba del test).
3. Añade `"test": "vitest"` a los scripts de `package.json`.
4. Escribe un test tonto que cargue tu fixture con `fs.readFileSync`, lo meta en `document.body.innerHTML` y compruebe que `querySelectorAll('pre').length` es mayor que 0.

**✅ Verificación**
`npm run test` pasa en verde. Este test tonto vale mucho: confirma que jsdom parsea tu HTML real.

**💡 Por qué ahora y no al final:** porque las tareas T13–T17 son imposibles de depurar recargando la extensión a mano cada vez. Con Vitest iteras en segundos.

---

### T10 — Definir la interfaz `SiteAdapter`
🟡 Media · ⏱ 40 min · 📁 `src/adapters/types.ts` · ⬅ T03

**🎯 Qué construyes**
El contrato que cumplirán Codeforces y CSES. Es un archivo de **solo tipos**: no se ejecuta nada.

**🧠 Conceptos previos**
Interface 📖 · Tipo 📖 · Contrato 📖 · Patrón Adapter 📖

**🔍 Investiga primero**
- https://www.typescriptlang.org/docs/handbook/2/objects.html — interfaces
- Relee §3.3 del plan: ahí está la interfaz completa

**🔨 Cómo atacarlo**
Antes de teclear, responde esto por escrito: *¿qué es lo mínimo que necesito saber de un juez para traducir su enunciado?* Compara tu lista con la del plan. Si la tuya tiene algo que la mía no, probablemente tengas razón — lo viste en el DOM real y yo no.

**✅ Verificación**
El archivo compila y no importa nada de `chrome.*` ni de Codeforces.

---

### T11 — Escribir el adapter de Codeforces
🟢 Fácil · ⏱ 30 min · 📁 `src/adapters/codeforces.ts` · ⬅ T10

Rellenas la interfaz con los selectores de tus notas de T02. Es configuración, no lógica: si te sale lógica, algo va mal y esa lógica pertenece a `core/`.

**✅ Verificación** — TypeScript no se queja de que falte ningún campo, y cada selector lo verificaste tú en T02.

---

### T12 — `collectBlocks()` — segmentar el enunciado
🟡 Media · ⏱ 45 min · 📁 `src/core/segmenter.ts` · ⬅ T11

**🎯 Qué construyes**
Una función que recibe la raíz del enunciado y devuelve la lista de elementos que hay que traducir.

**🧠 Conceptos previos**
`querySelectorAll` 📖 · `closest` 📖 · Elemento de bloque 📖 · `filter` 📖

**🔨 Cómo atacarlo**
1. Empieza con lo obvio: `root.querySelectorAll(adapter.blockSelector)`.
2. Ahora piensa en los casos que rompen eso — y aquí está el ejercicio de verdad:
   - Un `<p>` dentro de un `<pre>`, ¿lo quieres? **No.** ¿Cómo lo descartas?
   - Dos bloques anidados (un `<li>` dentro de un `<p>`), ¿procesarías el texto dos veces?
   - Un `<p>` que solo contiene una imagen o una fórmula, sin texto, ¿vale la pena mandarlo a traducir?
3. Escribe un test con tu fixture: cuenta cuántos bloques devuelve y verifica a mano que el número tiene sentido.

**✅ Verificación**
Con `cf-facil.html`, la lista no incluye ningún elemento que esté dentro de un `<pre>`, y el número de bloques coincide con lo que cuentas mirando el enunciado.

**💬 Si te atascas**
> "T12: mi `collectBlocks` devuelve bloques anidados y el texto sale duplicado. Dame una pista de cómo filtrar los que contienen a otros."

---

### T13 — `extract()` v1: solo texto
🟡 Media · ⏱ 60 min · 📁 `src/core/protector.ts` · ⬅ T12

**🎯 Qué construyes**
La primera versión: recorre un bloque y devuelve todo su texto concatenado. **Sin proteger nada todavía.** Camina antes de correr.

**🧠 Conceptos previos**
Nodo 📖 · TextNode 📖 · `nodeType` 📖 · `childNodes` · Recursión sobre árbol 📖

**🔍 Investiga primero**
- MDN: `Node.nodeType`, `Node.childNodes`, `Node.textContent`
- Búsqueda: `javascript recursively traverse dom text nodes`
- Lee la §2.6 del plan **después** de intentarlo tú, no antes

**🔨 Cómo atacarlo**
1. Función recursiva `walk(node): string`.
2. Caso base: si es un TextNode, devuelve su texto.
3. Caso recursivo: si es un elemento, recorre sus hijos, aplica `walk` a cada uno y une los resultados.
4. Cualquier otro tipo de nodo (comentarios), devuelve cadena vacía.

Es exactamente un DFS. La única diferencia con los que ya escribes en C++ es que aquí acumulas una cadena en vez de sumar un entero.

**✅ Verificación**
Con un bloque de tu fixture, el resultado se parece a lo que ves en pantalla — y **contiene el LaTeX y el texto de los `<pre>` mezclados**. Eso está bien: es el problema que resuelven T14 y T15, y ver el desastre ahora hace que entiendas por qué hace falta.

---

### T14 — `extract()` v2: nodos opacos
🔴 Difícil · ⏱ 60 min · 📁 `src/core/protector.ts` · ⬅ T13

**🎯 Qué construyes**
El mecanismo de protección. **Esta es la tarea más importante de todo el proyecto.**

**🧠 Conceptos previos**
`matches()` 📖 · Placeholder 📖 · `Map` 📖 · Referencia vs copia 📖 · Unión discriminada 📖

**🔍 Investiga primero**
- MDN: `Element.matches`, `Map`
- Relee §2.4 y §2.5 del plan (taxonomía de nodos y diseño del marcador)

**🔨 Cómo atacarlo**
1. Añade a `walk` una comprobación **antes** de descender: si el elemento encaja con `opaqueSelector`…
2. …guarda **el nodo** (no su HTML, no una copia) en un `Map` con un id incremental, y devuelve `⟦id⟧`.
3. Clave del asunto: en ese caso **no recorres los hijos**. Ahí es donde se corta el subárbol y donde queda protegido el `<pre>` entero.
4. Devuelve `{ text, slots }`.

**Las tres preguntas que deberías poder responder al terminar** (si alguna te falla, pregúntame el concepto, no el código):
- ¿Por qué guardo el nodo y no `el.outerHTML`?
- ¿Qué pasaría si recorriera los hijos de un nodo opaco después de haberlo reemplazado por un marcador?
- ¿Por qué numero los ids por bloque y no globalmente?

**✅ Verificación**
El texto de salida **no contiene nada del interior de los `<pre>`**, y `slots.size` coincide con el número de nodos opacos del bloque. Escribe un test que lo compruebe.

**💬 Si te atascas**
> "T14: mi extract sigue metiendo el contenido del `<pre>` en el texto. Aquí está mi walk: `<código>`. Dame una pista de dónde está el error de flujo."

---

### T15 — `extract()` v3: inline y LaTeX crudo
🔴 Difícil · ⏱ 60 min · 📁 `src/core/protector.ts` · ⬅ T14

**🎯 Qué construyes**
Los dos casos que faltan: el formato inline (`<b>`, `<a>`) que hay que conservar **sin** impedir la traducción, y el LaTeX que MathJax aún no renderizó.

**🧠 Conceptos previos**
Elemento inline 📖 · Regex 📖 · `String.replace` con función 📖 · MathJax 📖

**🔨 Cómo atacarlo**
1. **Inline:** si el elemento encaja con `inlineSelector` y su contenido tiene texto, envuélvelo en un par: `⟦id⟧` + contenido recorrido + `⟦/id⟧`. Nota la diferencia con T14: aquí **sí** recorres los hijos.
2. **LaTeX crudo:** en el caso base de TextNode, aplica `rawMathPattern` y sustituye cada coincidencia por un marcador, guardando un `document.createTextNode(match)` como slot. Así el resto del código lo trata igual que a cualquier otro nodo opaco.
3. Piensa: ¿en qué orden tienen que ir las comprobaciones dentro de `walk`? ¿Qué pasa si un elemento encaja con `opaqueSelector` **y** con `inlineSelector`?

**✅ Verificación**
Un párrafo con negritas y fórmulas produce un texto con marcadores pares e impares bien anidados, y ninguna `$` suelta.

---

### T16 — `restore()` — reconstruir el árbol
🔴 Difícil · ⏱ 90 min · 📁 `src/core/protector.ts` · ⬅ T15

**🎯 Qué construyes**
El camino de vuelta: de cadena traducida a árbol de DOM real, con los nodos originales en su sitio.

**🧠 Conceptos previos**
`DocumentFragment` 📖 · Pila 📖 · `appendChild` mueve 📖 · `cloneNode(false)` 📖 · `regex.exec` 📖

**🔍 Investiga primero**
- MDN: `DocumentFragment`, `Node.appendChild`, `Node.cloneNode`, `RegExp.prototype.exec`
- Busca: `javascript regex exec lastIndex loop` — entender `exec` en bucle es la mitad de esta tarea

**🔨 Cómo atacarlo**
Es un **parser**, y como todo parser tiene tres piezas:
1. **Tokenizar:** recorre la cadena con `exec` buscando marcadores. Entre dos marcadores hay texto plano → `createTextNode`.
2. **Mantener el estado:** una pila con "dónde estoy insertando ahora". Empieza con el fragmento raíz. Un marcador de apertura inline hace push del clon superficial; uno de cierre hace pop. Es el mismo algoritmo que validar paréntesis balanceados.
3. **Resolver marcadores:** consulta el `Map`. Si es opaco, insertas el nodo original tal cual. Si es inline de apertura, clonas superficialmente y haces push.

**Detalle que te va a morder:** `appendChild` con un nodo que ya está en la página **lo mueve**. Eso es lo que quieres — pero implica que tienes que construir el fragmento **completo antes** de vaciar el bloque. Si vacías primero, pierdes las referencias.

**Casos límite que debes manejar sin romper:**
- El texto trae un marcador que no está en el `Map` (el modelo lo inventó)
- Un cierre sin apertura
- Un marcador de apertura sin su cierre
- La cadena no tiene ningún marcador

**✅ Verificación**
Un caso hecho a mano: `"Hola ⟦0⟧ mundo"` con un slot opaco produce un fragmento con tres hijos en el orden correcto.

**💬 Si te atascas**
> "T16: entiendo la idea de la pila pero no sé cómo recorrer la cadena con exec sin perder el texto que hay entre marcadores. Dame el esqueleto del bucle con comentarios, sin el cuerpo."

---

### T17 — Test de round-trip
🔴 Difícil · ⏱ 60 min · 📁 `tests/protector.spec.ts` · ⬅ T16

**🎯 Qué construyes**
**El hito del proyecto.** El test que demuestra que tu algoritmo no rompe nada.

**🧠 Conceptos previos**
Round-trip 📖 · Identidad de objeto (`===`) 📖 · Regresión 📖

**🔨 Cómo atacarlo**
Para cada bloque de cada fixture:
1. `const e = extract(bloque, cfg)`
2. `const frag = restore(e.text, e.slots)` — **sin traducir nada en medio**
3. Comprueba que el resultado equivale al original.

Tres aserciones, de menos a más exigente:
- El `textContent` del fragmento es igual al del bloque original.
- El fragmento contiene exactamente los mismos `<pre>` que el original, y son **las mismas instancias** (`===`, no "se parecen").
- El texto extraído no contiene ninguna subcadena del interior de un `<pre>`.

**✅ Verificación**
`npm run test` en verde con los tres fixtures. **Cuando esto pase, el riesgo técnico del proyecto está resuelto.** Commit, captura de pantalla, y anótalo en la bitácora.

---

### T18 — `isValid()` — validar marcadores
🟢 Fácil · ⏱ 30 min · 📁 `src/core/validator.ts` · ⬅ T17

Extrae los marcadores del texto original y del traducido, y compara cantidad y orden. Es una función de 6 líneas. Su valor no está en la dificultad, sino en que es lo único que te separa de mostrarle al usuario un enunciado corrupto.

**✅ Verificación** — tests para: igual (✔), falta uno (✘), desordenados (✘), uno inventado (✘).

---

### T19 — Conectar todo con un traductor falso
🟡 Media · ⏱ 45 min · 📁 `src/content/index.ts` · ⬅ T18, T08

**🎯 Qué construyes**
El momento de la verdad: el pipeline completo funcionando en Codeforces, **sin red ni API**.

**🔨 Cómo atacarlo**
1. En el `onclick` del botón: `collectBlocks` → `extract` por bloque → `fakeTranslate` → `isValid` → `restore` → `replaceChildren`.
2. `const fakeTranslate = (s: string) => '[ES] ' + s;`

**✅ Verificación**
Abres un problema, pulsas el botón, y cada párrafo empieza con `[ES]` mientras **las fórmulas y los ejemplos se ven exactamente igual que antes**. Si una fórmula parpadeó o se rompió, vuelve a T16.

**🎉 Este es el mejor momento del proyecto.** Grábalo en vídeo.

**💡 Idea:** crea también un `playground.html` local con un enunciado falso que incluya `<pre>`, negritas y fórmulas, y ábrelo con `npm run dev`. Iterar ahí es diez veces más rápido que recargar la extensión.

---

## Etapa 3 — Red y proveedores

### T20 — Protocolo de mensajes tipado
🟡 Media · ⏱ 40 min · 📁 `src/shared/messages.ts` · ⬅ T19

Define los tipos `TranslateRequest` y `TranslateResponse` (plan §3.3). Fíjate en que la respuesta es una **unión discriminada** con `ok: true | false`: eso obliga a TypeScript a que compruebes el error antes de leer los datos. Es el patrón que convierte un bug de ejecución en un error de compilación.

**🧠 Conceptos previos** — Message passing 📖 · Unión discriminada 📖

---

### T21 — Service worker con eco
🟡 Media · ⏱ 45 min · 📁 `src/background/service-worker.ts` · ⬅ T20

**🧠 Conceptos previos**
Service worker 📖 · `sendMessage` 📖 · `return true` 📖 · Promesa 📖 · async/await 📖

**🔍 Investiga primero**
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- https://developer.chrome.com/docs/extensions/reference/api/runtime — `sendMessage` y `onMessage`
- Busca: `chrome extension onMessage return true async` — **léelo antes de escribir nada**, te ahorra una hora

**🔨 Cómo atacarlo**
1. Declara el service worker en el manifest.
2. Listener de `onMessage` que devuelva los mismos bloques sin traducir.
3. Desde el content script, sustituye `fakeTranslate` por `chrome.runtime.sendMessage`.

**✅ Verificación**
El pipeline sigue funcionando, pero ahora los bloques dan la vuelta por el fondo. Abre la consola del service worker desde `chrome://extensions` → "service worker" e imprime algo ahí para verlo.

**🐛 Error clásico:** la respuesta llega `undefined`. Es el `return true` que falta en el listener. Sí, a todo el mundo le pasa.

---

### T22 — `settings.ts` y la página de Opciones
🟡 Media · ⏱ 60 min · 📁 `src/shared/settings.ts`, `src/options/` · ⬅ T21

**🧠 Conceptos previos** — `chrome.storage.local` 📖 · async/await 📖 · Options page 📖

**🔍 Investiga primero** — https://developer.chrome.com/docs/extensions/reference/api/storage

**🔨 Cómo atacarlo**
1. `getSettings()` / `saveSettings()` sobre `chrome.storage.local`, con valores por defecto (proveedor = traductor local).
2. `options.html`: un `<select>` de proveedor y un campo de API key.
3. El campo de key **solo se muestra si el proveedor elegido tiene `needsKey: true`**.

**✅ Verificación**
Guardas, cierras, reabres Opciones y el valor sigue ahí. Con el proveedor por defecto no se ve ningún campo que rellenar.

---

### T23 — Proveedor: traductor local de Chrome
🟡 Media · ⏱ 60 min · 📁 `src/background/providers/chrome-builtin.ts` · ⬅ T22

**🎯 Qué construyes**
La primera traducción **de verdad**, gratis y sin salir de tu máquina.

**🔍 Investiga primero**
- https://developer.chrome.com/docs/ai/translator-api — **la documentación completa, entera**
- Presta atención a los estados de `availability()` y al evento de progreso de descarga

**🔨 Cómo atacarlo**
1. Implementa la interfaz `TranslationProvider` (plan §3.3).
2. `availability()` → si es `'downloadable'`, la primera vez hay descarga: muestra progreso o parecerá colgado.
3. Traduce bloque por bloque. No te compliques con lotes: es local.

**✅ Verificación**
Pulsas el botón y **el enunciado aparece en español**, con las fórmulas intactas.

**🔬 Experimento obligatorio — anótalo en la bitácora:**
traduce 5 enunciados distintos y cuenta cuántos bloques rechaza `isValid()`. Ese número te dice si el traductor local respeta los `⟦n⟧`. Si falla mucho, prueba otro marcador (`«3»`, `@@3@@`) antes de descartar el proveedor: es cambiar dos constantes y volver a correr los tests. **Esto es medir, no suponer** — justo lo que diferencia un proyecto de ingeniería de un script.

---

### T24 — Proveedor: Groq + system prompt
🟡 Media · ⏱ 60 min · 📁 `src/background/providers/groq.ts`, `src/shared/prompt.ts` · ⬅ T23

**🧠 Conceptos previos** — `fetch` 📖 · Header 📖 · JSON 📖 · System prompt 📖 · Temperature 📖 · CORS 📖

**🔍 Investiga primero**
- https://console.groq.com/docs — autenticación y `chat/completions`
- Busca: `groq api json mode response_format`

**🔨 Cómo atacarlo**
1. Saca tu key gratuita en la consola de Groq y guárdala desde Opciones (**nunca** en el código).
2. Implementa `translate()` mandando todos los bloques en un JSON.
3. Escribe el system prompt con el glosario (plan §2.10). Este archivo lo vas a iterar mucho: cada mala traducción es una regla nueva.

**✅ Verificación**
Comparas el mismo enunciado traducido por Chrome y por Groq. Anota las diferencias en la bitácora: ahí verás para qué sirve un glosario.

---

### T25 — Errores, reintentos y degradación
🔴 Difícil · ⏱ 60 min · 📁 varios · ⬅ T24

**🎯 Qué construyes**
Lo que separa un experimento de una herramienta que se puede usar.

**🔨 Cómo atacarlo**
Implementa la escalera de §2.8 del plan:
1. Bloque inválido → un reintento aislado.
2. Falla otra vez → ese bloque se queda en inglés, con marca visual.
3. Error de red o 401/429 → revertir **todo** al snapshot y mensaje claro.

**✅ Verificación**
Fuerza los fallos a propósito: pon una key inválida, desconecta el wifi, haz que el traductor falso borre un marcador. **En ningún caso debe quedar un enunciado corrupto en pantalla.**

**💡 El criterio a interiorizar:** ante la duda, mostrar el original. Un enunciado en inglés es útil; uno con la fórmula cambiada de sitio puede costarte un problema mal resuelto en un concurso.

---

## Etapa 4 — Experiencia de uso

### T26 — Estados del botón
🟢 Fácil · ⏱ 45 min · 📁 `src/content/button.ts` · ⬅ T25

Cuatro estados: reposo, cargando (deshabilitado + spinner), listo, error (con el motivo y un modo de reintentar). Sin esto, una espera de 3 segundos parece que se colgó.

---

### T27 — Toggle ES ↔ EN
🟡 Media · ⏱ 45 min · 📁 `src/content/toggle.ts` · ⬅ T26

Guarda el `cloneNode(true)` **antes** de mutar, y alterna insertando uno u otro. Piensa: ¿qué le pasa a las fórmulas ya renderizadas cuando vuelves al original? ¿Y si el usuario pulsa el toggle tres veces seguidas?

---

### T28 — Caché con hash
🟡 Media · ⏱ 45 min · 📁 `src/core/hash.ts`, service worker · ⬅ T27

**🧠 Conceptos previos** — Hash 📖 · FNV-1a 📖 · Caché 📖

Implementa FNV-1a (unas 8 líneas; búscalo, es un ejercicio bonito de operaciones bit a bit — terreno conocido para ti). Clave = `juez:problema:hash`. El hash no está solo para la clave: detecta que el enunciado cambió y la traducción caducó.

**✅ Verificación** — segunda visita al mismo problema: respuesta instantánea y cero peticiones en la pestaña Network.

---

## Etapa 5 — Segundo juez y cierre

### T29 — Adapter de CSES
🟡 Media · ⏱ 60 min · 📁 `src/adapters/cses.ts` · ⬅ T28, T04

**La prueba de fuego de tu arquitectura.** Escribe el adapter con las notas de T04 y añade el `matches` en el manifest.

**✅ Verificación**
Funciona en CSES **sin haber modificado ni una línea de `src/core/`**. Si tuviste que tocar el core, no lo parchees: pregúntate qué abstracción te faltó, y arréglala ahí. Esa reflexión vale más que la tarea.

---

### T30 — README, empaquetado y bitácora final
🟢 Fácil · ⏱ 60 min · 📁 raíz · ⬅ T29

README con capturas, qué problema resuelve, cómo instalarlo y una sección de arquitectura en 10 líneas. Genera el `.zip` de `dist/` para compartirlo en el club. Cierra el `DEV-LOG.md` con lo que aprendiste y lo que harías distinto.

**✅ Verificación** — un compañero instala la extensión siguiendo solo tu README, sin preguntarte nada.

---

# Apéndices

## Apéndice A — Tabla de progreso

Cópiala a `PROGRESO.md` y ve marcando. Ver avanzar las casillas es la mitad de la motivación en un proyecto largo.

```
Etapa 0  [ ] T01  [ ] T02  [ ] T03  [ ] T04
Etapa 1  [ ] T05  [ ] T06  [ ] T07  [ ] T08
Etapa 2  [ ] T09  [ ] T10  [ ] T11  [ ] T12  [ ] T13
         [ ] T14  [ ] T15  [ ] T16  [ ] T17  [ ] T18  [ ] T19
Etapa 3  [ ] T20  [ ] T21  [ ] T22  [ ] T23  [ ] T24  [ ] T25
Etapa 4  [ ] T26  [ ] T27  [ ] T28
Etapa 5  [ ] T29  [ ] T30
```

## Apéndice B — Errores comunes: síntoma → causa

| Lo que ves | Casi siempre es |
|---|---|
| `Cannot read properties of null (reading '...')` | Un `querySelector` que no encontró nada. Tu selector está mal o el script corrió antes de tiempo |
| El botón no aparece | El content script no se inyectó: revisa `matches` en el manifest y recarga la extensión, no solo la página |
| Cambio el código y no pasa nada | Falta `npm run build`, o falta pulsar ↻ en `chrome://extensions` |
| La respuesta del service worker llega `undefined` | Falta el `return true` en el listener de `onMessage` |
| `Failed to fetch` / error de CORS | Estás llamando a la API desde el content script, o falta el dominio en `host_permissions` |
| Las fórmulas desaparecieron | Usaste `innerHTML` en algún punto, o vaciaste el bloque antes de construir el fragmento |
| Las fórmulas parpadean y se re-renderizan | Estás reinsertando HTML en vez de mover los nodos originales |
| El texto sale duplicado | `collectBlocks` devuelve bloques anidados (T12) |
| El test pasa pero en la página falla | jsdom no ejecuta MathJax: en la página real los nodos son distintos. Captura un fixture **después** de que MathJax renderice |
| `⟦3⟧` visible en el enunciado traducido | `restore` no reconoció el marcador: revisa el regex y que los ids coincidan |

## Apéndice C — Rutas de aprendizaje por tema

Solo lo que este proyecto necesita. No te pongas a estudiar JavaScript entero antes de empezar.

| Tema | Recurso | Cuánto |
|---|---|---|
| JavaScript moderno | https://javascript.info — capítulos 2 (fundamentos), 4 (objetos), 11 (promesas) | 4–6 h |
| DOM | https://javascript.info/document — solo la parte 1 | 2 h |
| Referencia puntual del DOM | https://developer.mozilla.org/es/docs/Web/API/Document_Object_Model | consulta |
| TypeScript | https://www.typescriptlang.org/docs/handbook/2/everyday-types.html | 2 h |
| Extensiones de Chrome | https://developer.chrome.com/docs/extensions/get-started | 2 h |
| Regex | https://regexr.com — practicar con tus propios marcadores | 1 h |
| Vitest | https://vitest.dev/guide/ | 1 h |
| Traductor local | https://developer.chrome.com/docs/ai/translator-api | 30 min |

**Cuándo estudiar cada uno:** JS moderno y DOM antes de la Etapa 2. TypeScript sobre la marcha. Extensiones antes de la Etapa 1. Lo demás, en la tarea que lo pide.

## Apéndice D — Plantilla de bitácora

```markdown
## 2026-09-20 — T14

**Hecho:** extract() ya protege nodos opacos.
**Me costó:** entender que no tenía que recorrer los hijos del nodo opaco.
  Estuve 40 min con el <pre> saliendo en el texto.
**Aprendí:** que appendChild mueve el nodo en vez de copiarlo. Eso cambia
  todo el diseño de restore().
**Duda pendiente:** ¿qué pasa si un nodo encaja con opaque e inline a la vez?
**Siguiente:** T15.
```

Dos minutos por sesión. Cuando llegues a T30 tendrás la memoria del proyecto escrita, y cuando alguien te pregunte "¿y esto qué tiene de difícil?" tendrás la respuesta con ejemplos.

## Apéndice E — Convención de commits

```
T14: extract() protege nodos opacos con placeholders
T16: restore() reconstruye el árbol con pila de inline
T17: test de round-trip sobre los 3 fixtures
fix: faltaba return true en onMessage
docs: notas del DOM de CSES
```

Un commit por tarea terminada. Si una tarea te lleva a tres commits, mejor todavía.

---

## Por dónde empezar mañana

1. Lee la Parte 1 entera (15 min). Es lo que hace que el resto funcione.
2. Haz **T01**.
3. Haz **T02** con calma: es la tarea que más veces vas a agradecer.
4. Abre el diccionario en la sección 2 y léela completa antes de la Etapa 2.

Y cuando te atasques, la plantilla de §1.2. Dime el número de tarea y el nivel de ayuda que quieres, y seguimos desde ahí.
