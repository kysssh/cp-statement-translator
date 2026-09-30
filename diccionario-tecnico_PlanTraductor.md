# Diccionario Técnico — Traductor de Enunciados

Glosario de todos los términos que aparecen en el plan de desarrollo. Las definiciones están escritas para entenderse a la primera, con analogías a cosas que ya conoces (C++, bases de datos, backend). Cuando un término es **clave para este proyecto** lleva 🔑.

> **Los 8 que debes entender sí o sí antes de escribir código:** DOM, Nodo, TextNode, `appendChild`, referencia vs. copia, `DocumentFragment`, content script, service worker.

---

## 1. Fundamentos de la web

**HTML**
El lenguaje que describe *qué hay* en una página: títulos, párrafos, imágenes, tablas. Son etiquetas anidadas: `<p>Hola <b>mundo</b></p>`. Es solo texto; el navegador lo lee y construye algo vivo con él.

**CSS**
El lenguaje que describe *cómo se ve* lo del HTML: colores, tamaños, espaciado. Se aplica mediante selectores (ver más abajo).

**JavaScript (JS)**
El lenguaje que se ejecuta *dentro* del navegador y puede modificar la página mientras el usuario la mira. Es el único lenguaje que los navegadores entienden de forma nativa. Comparado con C++: no se compila a binario, no tiene tipos obligatorios, y la memoria la gestiona solo.

**Navegador / motor del navegador**
El programa (Chrome, Firefox) que descarga el HTML, lo convierte en una estructura en memoria, la dibuja y ejecuta el JavaScript asociado.

**Página / documento**
La instancia concreta que está cargada en una pestaña. En JS se accede con la variable global `document`.

**Origen (origin)** 🔑
La combinación de *protocolo + dominio + puerto*: `https://codeforces.com`. El navegador usa el origen como frontera de seguridad: por defecto, código de un origen **no puede** hablar con otro. De ahí nace el problema de CORS (§6).

**Renderizar**
Convertir datos en algo visible. "MathJax renderiza `$$$n^2$$$`" = lo transforma en la fórmula bonita que ves en pantalla.

**Frontend / cliente**
Todo lo que corre en la máquina del usuario (el navegador). Opuesto a *backend/servidor*, que corre en una máquina remota. Este proyecto es 95 % frontend, con una llamada puntual a un servicio externo.

---

## 2. El DOM y su manipulación (la sección más importante)

**DOM (Document Object Model)** 🔑
La representación **en memoria** del HTML, en forma de árbol de objetos. El HTML es el texto en disco; el DOM es la estructura viva que puedes recorrer y modificar desde JavaScript. Si cambias el DOM, la pantalla cambia al instante.

```
document
└── html
    └── body
        └── div.problem-statement
            ├── p          "Given an array"
            └── pre        "3 5\n1 2 3"
```

**Árbol / nodo padre / hijo / hermano**
Vocabulario estándar de árboles, igual que en cualquier estructura de datos. `childNodes` es la lista de hijos directos de un nodo, en orden.

**Nodo (Node)** 🔑
Cualquier pieza del árbol. Hay varios tipos; a ti te importan dos:

**Element (nodo elemento)** 🔑
Un nodo que corresponde a una etiqueta HTML: `<p>`, `<pre>`, `<span>`. Tiene clases, atributos e hijos.

**TextNode (nodo de texto)** 🔑
Un nodo que contiene **solo texto**, sin etiquetas. En `<p>Hola <b>mundo</b></p>` hay un TextNode con `"Hola "` y otro con `"mundo"` dentro del `<b>`. **Estos son los únicos nodos cuyo contenido queremos traducir.** Todo el algoritmo del proyecto consiste en encontrarlos sin tocar nada más.

**`nodeType`**
Un número que dice de qué tipo es un nodo (`1` = elemento, `3` = texto). Se compara con las constantes `Node.ELEMENT_NODE` y `Node.TEXT_NODE`, que se leen mucho mejor.

**`textContent`**
El texto plano que hay dentro de un nodo, ignorando etiquetas. `<p>Hola <b>mundo</b></p>` → `"Hola mundo"`. Leerlo es seguro; escribirlo **destruye todos los hijos** del nodo.

**`innerHTML`** ⚠️
El HTML interno de un elemento, como cadena de texto. Leerlo está bien para depurar. **Escribirlo es el gran antipatrón de este proyecto**: el navegador tira todo el subárbol y lo reconstruye desde cero, lo que borra las fórmulas ya renderizadas, mata los listeners y permite inyectar código malicioso.

**Selector CSS** 🔑
Una cadena que describe "qué elementos quiero". `p` = todos los párrafos. `.problem-statement` = los que tienen esa clase. `pre, code` = ambos. `script[type^="math/tex"]` = scripts cuyo atributo `type` empieza por eso. Es, en espíritu, un `WHERE` de SQL pero sobre el árbol del DOM.

**`querySelector` / `querySelectorAll`** 🔑
Buscan en el DOM usando un selector. El primero devuelve **el primer** resultado (o `null`); el segundo devuelve **todos**. Son tu `SELECT` sobre la página.

**`matches(selector)`** 🔑
Pregunta a un elemento concreto: "¿encajas con este selector?" → `true` / `false`. Es la línea que decide si un nodo es opaco (protegido) o no.

**`closest(selector)`**
Sube por los ancestros del nodo hasta encontrar uno que encaje. Útil para preguntar "¿estoy dentro de un `<pre>`?".

**`appendChild(nodo)`** 🔑
Añade un nodo como último hijo de otro. **Detalle crucial:** si el nodo ya estaba en el documento, `appendChild` **lo mueve**, no lo copia. Esa propiedad es la que hace que una fórmula ya renderizada pueda reubicarse sin volver a renderizarla.

**`replaceChildren(...nodos)`** 🔑
Reemplaza de golpe todos los hijos de un elemento por los que le pases. Es atómico: el usuario nunca ve un estado intermedio parpadeante. Es la última línea del algoritmo.

**`cloneNode(deep)`** 🔑
Copia un nodo. Con `false` hace una **copia superficial**: solo la etiqueta y sus atributos, sin hijos (lo que usamos para reconstruir un `<b>` vacío y meterle dentro el texto traducido). Con `true` hace una **copia profunda**: el nodo y todo su subárbol (lo que usamos para el *snapshot* del enunciado original).

**Referencia vs. copia** 🔑
En JS, una variable que apunta a un nodo guarda una **referencia**, igual que un puntero en C++. Dos variables pueden apuntar al mismo nodo, y `a === b` comprueba si son **el mismo objeto**, no si "se parecen". El proyecto entero se apoya en esto: guardamos referencias a las fórmulas para moverlas intactas, en lugar de guardar su HTML y reconstruirlas.

**`DocumentFragment`** 🔑
Un contenedor de nodos **fuera de la página**, invisible y ligero. Montas el árbol dentro de él sin que el navegador redibuje nada, y cuando está listo lo insertas de una vez. Es el equivalente a construir un `vector` completo antes de imprimirlo, en vez de imprimir carácter a carácter.

**`TreeWalker`**
Utilidad nativa para recorrer el DOM aplicando un filtro. Potente para *recolectar* nodos, pero en este proyecto usamos recursión porque necesitamos construir una cadena respetando la anidación.

**Recorrido recursivo**
Una función que se llama a sí misma para bajar por el árbol. Idéntico al DFS que ya usas en grafos; aquí el "grafo" es el DOM y los vecinos son `childNodes`.

**Elemento de bloque vs. elemento inline**
Los de bloque (`<p>`, `<div>`, `<li>`) ocupan una línea propia; los inline (`<b>`, `<span>`, `<a>`) fluyen dentro del texto. En el proyecto, los bloques definen la **unidad de traducción** y los inline hay que preservarlos dentro de la frase.

**Atributo**
Dato extra en una etiqueta: `class`, `href`, `title`, `type`. Se leen con `getAttribute()` o propiedades directas.

**Clase CSS**
Etiqueta de agrupación en el atributo `class`. Codeforces marca sus fórmulas con `class="tex-span"` y sus variables con `class="tex-font-style-tt"`; nosotros usamos esas clases para saber qué proteger.

**Event listener (escuchador de eventos)**
Función registrada para ejecutarse cuando ocurre algo (un clic). `btn.onclick = fn` o `btn.addEventListener('click', fn)`. Si reconstruyes el HTML con `innerHTML`, todos los listeners registrados se pierden.

**DevTools (herramientas de desarrollador)** 🔑
El panel que se abre con F12. Pestañas que usarás: **Elements** (inspeccionar el DOM real), **Console** (probar JS al vuelo), **Network** (ver las peticiones). Toda la Fase 0 del plan ocurre aquí.

**`$0`**
En la consola de DevTools, atajo que apunta al último elemento seleccionado en la pestaña Elements. `copy($0.outerHTML)` copia su HTML al portapapeles.

---

## 3. Fórmulas matemáticas y renderizado

**LaTeX** 🔑
Lenguaje para escribir fórmulas en texto plano: `n \le 10^5` significa *n ≤ 10⁵*. Es lo que hay escrito en el HTML antes de que nadie lo convierta en imagen.

**MathJax** 🔑
Librería de JavaScript que busca LaTeX en la página y lo transforma en una fórmula visible. Codeforces la usa. Lo importante: **el trabajo lo hace en el navegador, después de cargar la página**. Por eso tu script puede llegar antes (y ver `$$$n \le 10^5$$$` en crudo) o después (y ver un `<span class="MathJax">` lleno de nodos generados).

**KaTeX**
Alternativa a MathJax, más rápida. Otros jueces la usan. Se protege igual, cambiando el selector.

**Delimitador**
Las marcas que señalan dónde empieza y acaba una fórmula. Codeforces usa `$$$...$$$`; otras webs usan `$...$` o `\(...\)`. Van configurados en el *adapter* porque cambian de un juez a otro.

**Tipografiar (typeset)**
La acción de MathJax de convertir LaTeX en fórmula. Re-tipografiar es costoso y produce parpadeo; el algoritmo del proyecto está diseñado precisamente para no tener que hacerlo nunca.

---

## 4. Texto, cadenas y patrones

**String (cadena)**
Texto. En JS se escribe con comillas simples, dobles o *backticks*.

**Template literal (plantilla)**
Cadena con backticks que permite insertar variables: `` `⟦${id}⟧` ``. Equivale a concatenar, pero se lee mucho mejor.

**Regex (expresión regular)** 🔑
Un patrón para buscar dentro de texto. `/⟦(\/?)(\d+)⟧/g` significa: "un `⟦`, opcionalmente una barra, uno o más dígitos, y un `⟧`, buscando **todas** las apariciones (`g`)". Muy útil sobre texto plano; **muy mala idea sobre HTML**, porque el HTML no es un lenguaje regular (etiquetas anidadas, atributos, comillas). De ahí la regla de recorrer el DOM en vez de aplicar regex al `innerHTML`.

**Grupo de captura**
Los paréntesis dentro de un regex. Permiten recuperar trozos concretos del texto encontrado: en `⟦/3⟧`, el primer grupo captura `/` y el segundo `3`.

**`exec` / `match` / `replace`**
Formas de usar un regex: `exec` va devolviendo coincidencias una a una (con posición), `match` devuelve una lista, `replace` sustituye.

**Placeholder (marcador de posición)** 🔑
Un texto corto y feo que ocupa el sitio de algo que no quieres tocar. `⟦3⟧` sustituye a una fórmula mientras el texto viaja a la API; al volver, se cambia otra vez por la fórmula real. Es el mecanismo central del proyecto.

**Token** ⚠️ *(dos significados distintos, no los confundas)*
1. En nuestro parser: cada `⟦3⟧` o `⟦/3⟧` que encontramos en la cadena.
2. En modelos de IA: la unidad en que se mide el texto que consumen (≈ ¾ de palabra). Es lo que se factura.

**Unicode / carácter especial**
Sistema que da un número único a cada carácter del mundo. `⟦` (U+27E6) es un carácter poco común, y por eso sirve como marcador: nunca aparecerá por accidente en un enunciado.

**Escapar (escape)**
Anteponer `\` a un carácter para que se interprete literalmente y no como símbolo especial. En `/\$\$\$/` escapamos los `$` porque en regex significan "fin de cadena".

**Normalizar**
Limpiar el texto a una forma canónica: quitar espacios repetidos, saltos de línea sobrantes. El `.replace(/\s+/g, ' ').trim()` del extractor.

**Serializar / parsear**
Serializar = convertir una estructura en texto (el DOM en una cadena con placeholders, o un array en JSON). Parsear = el camino inverso. El proyecto hace las dos cosas dos veces.

---

## 5. Extensiones de navegador

**Extensión** 🔑
Un pequeño programa que el navegador instala y que puede modificar páginas, añadir botones y hacer peticiones con permisos especiales. Es un `.zip` con HTML, JS y un manifiesto.

**Manifest / `manifest.json`** 🔑
El archivo de declaración de la extensión: nombre, versión, permisos, qué scripts se inyectan y en qué URLs. Si algo no está declarado aquí, no ocurre. Piensa en él como el `CMakeLists.txt` + configuración de permisos, todo junto.

**Manifest V3 (MV3)** 🔑
La versión vigente del formato. Su cambio más relevante para ti: eliminó las páginas de fondo permanentes y las sustituyó por *service workers*, y endureció las reglas de red de los content scripts.

**Content script** 🔑
El JavaScript que la extensión **inyecta dentro de la página** del juez. Ve y modifica el DOM de Codeforces. Vive en un "mundo aislado": comparte el DOM con la página, pero no comparte variables con los scripts propios de la web. **No tiene credenciales ni puede llamar a APIs externas.**

**Service worker (fondo / background)** 🔑
Un script de la extensión que corre **fuera** de cualquier página, sin interfaz. Es el único que guarda la API key y hace las peticiones de red. Se despierta cuando llega un mensaje y se duerme solo — por eso no puede guardar estado en variables globales.

**Message passing (paso de mensajes)** 🔑
La forma en que content script y service worker se comunican, ya que viven en procesos distintos: `chrome.runtime.sendMessage(...)` envía, `chrome.runtime.onMessage.addListener(...)` recibe. Conceptualmente es una llamada a tu propio backend, pero dentro del navegador.

**`return true` en `onMessage`** 🔑
Detalle que rompe a todo el mundo la primera vez: si vas a responder de forma asíncrona (después de un `await`), el listener **debe** devolver `true`, o el canal se cierra y la respuesta se pierde en el vacío.

**`host_permissions`** 🔑
Lista de dominios a los que la extensión puede acceder o llamar. Si `api.anthropic.com` no está aquí, el `fetch` falla aunque el código sea perfecto.

**`permissions`**
Capacidades del navegador que pides (`storage`, `commands`…). Cuantas menos, mejor: cada permiso extra asusta al usuario y complica la publicación.

**`chrome.storage.local`** 🔑
Almacén clave–valor persistente de la extensión. Aquí van la API key, las preferencias y la caché de traducciones. Es asíncrono (siempre `await`) y **no es accesible desde la página web**, a diferencia de `localStorage`.

**`options_page`**
Página HTML propia de la extensión donde el usuario configura cosas (poner su API key, elegir modelo). Es una web normal y corriente.

**Extensión descomprimida (unpacked)** 🔑
Modo de desarrollo: en `chrome://extensions` activas *Modo desarrollador* y cargas la carpeta `dist/` directamente, sin firmar ni publicar. Así probarás durante todo el proyecto.

**Chrome Web Store**
La tienda oficial. Solo relevante si decides distribuir públicamente (y entonces necesitas el proxy, porque el paquete es inspeccionable por cualquiera).

**Userscript** 🔑
Un único archivo `.js` que un gestor como **Tampermonkey** inyecta en las páginas que indiques. Mucho más rápido de arrancar que una extensión, pero sin separación de capas ni sitio decente para guardar secretos. En el plan se usa solo como sonda desechable.

**`@match`, `@grant`, `@connect`**
Directivas de la cabecera de un userscript: en qué URLs se ejecuta, qué APIs especiales necesita y a qué dominios puede llamar.

**`GM_xmlhttpRequest`**
La función de Tampermonkey para hacer peticiones saltándose CORS. Es la razón por la que un userscript puede llamar a una API externa sin service worker.

**`run_at: document_idle`**
Momento en que se inyecta el content script: cuando la página ya terminó de cargar. Importa porque MathJax necesita haber trabajado antes que tú.

---

## 6. Red, HTTP y APIs

**API** 🔑
Un servicio al que le mandas datos y te devuelve datos, siguiendo un contrato. Aquí: le mandas texto en inglés, te devuelve texto en español.

**Endpoint**
La URL concreta de una operación de la API: `https://api.anthropic.com/v1/messages`.

**HTTP / método / `POST`**
El protocolo de la web. `GET` pide información, `POST` envía un cuerpo de datos para que el servidor haga algo. Las peticiones de traducción son `POST`.

**`fetch`** 🔑
La función de JavaScript para hacer peticiones HTTP. Devuelve una promesa.

**Header (cabecera)**
Metadatos de la petición: tipo de contenido, versión de la API, credenciales. `x-api-key: sk-...` es una cabecera.

**Body (cuerpo)**
Los datos que viajan en la petición, normalmente JSON.

**JSON** 🔑
Formato de intercambio de datos basado en texto: objetos `{}`, arrays `[]`, cadenas, números. `JSON.stringify()` convierte un objeto JS en texto; `JSON.parse()` hace lo contrario.

**Código de estado (status code)**
Número que resume el resultado. `200` OK, `400` petición mal formada, `401` credencial inválida, `429` demasiadas peticiones, `500` error del servidor. Tu manejo de errores debe distinguirlos.

**CORS (Cross-Origin Resource Sharing)** 🔑
La regla del navegador que impide que código cargado en el origen A llame libremente al origen B. Es la causa de que el content script no pueda llamar a la API y de que todo el tráfico deba pasar por el service worker.

**Latencia**
Tiempo que tarda la respuesta. Un enunciado tarda 2–5 s; por eso el botón necesita un estado de "cargando".

**Rate limit (límite de peticiones)**
Tope de peticiones por minuto que impone el servicio. Al superarlo devuelve `429`.

**Backoff exponencial**
Estrategia ante un `429`: reintentar esperando 1 s, luego 2 s, luego 4 s… en lugar de machacar el servidor.

**API key (clave de API)** 🔑
Cadena secreta que identifica tu cuenta y por la que se te factura. Tratar como contraseña: nunca en el repositorio, nunca en el content script, nunca en una captura de pantalla.

**Proxy** 🔑
Un servidor intermedio propio: la extensión llama a tu proxy, y el proxy llama a la API con la clave guardada en el servidor. Es la única forma real de distribuir la herramienta sin regalar tu clave. Encaja bien con tu experiencia de backend: es un endpoint que recibe JSON, valida y reenvía.

**Cloudflare Worker / Vercel Edge Function**
Servicios donde puedes desplegar ese proxy sin administrar un servidor, casi siempre con plan gratuito suficiente.

**Variable de entorno / `.env`**
Configuración que vive fuera del código (como la clave de API). El archivo `.env` **siempre** va en `.gitignore`.

---

## 7. Inteligencia artificial y traducción

**LLM (Large Language Model)** 🔑
Modelo de lenguaje al que le das texto y te devuelve texto. Para este caso sirve porque entiende contexto y jerga técnica, pero **no es determinista**: la misma entrada puede dar salidas ligeramente distintas. De ahí que haya validación y reintentos.

**Prompt**
Las instrucciones que le das al modelo.

**System prompt** 🔑
Instrucciones de alto nivel que definen el papel y las reglas fijas ("eres un traductor, copia los tokens ⟦n⟧ exactamente"). Se mantiene igual en todas las peticiones.

**Temperature (temperatura)**
Parámetro de 0 a 1 que controla cuánta variación se permite. `0` = la salida más predecible posible. Para traducir, siempre 0.

**`max_tokens`**
Tope de longitud de la respuesta. Si te quedas corto, el JSON llega truncado y el `JSON.parse` revienta.

**MTok**
Un millón de tokens. Los precios se expresan así: "1 USD / MTok de entrada" = un dólar por cada millón de tokens que envías.

**Prefill**
Truco de la API: empezar tú el turno del modelo con `[` para forzar que su respuesta sea un array JSON y no una explicación en prosa.

**Alucinación**
Cuando el modelo se inventa contenido. En este proyecto la variante peligrosa es que invente, renumere o borre un placeholder — exactamente lo que detecta la función `isValid`.

**Salida estructurada**
Pedir la respuesta en un formato fijo (JSON) en vez de prosa libre, para poder procesarla con código.

**Glosario de traducción**
Lista de términos con su traducción obligatoria (`array → arreglo`, `edge → arista`). Va dentro del system prompt y es lo que evita traducciones absurdas en contexto de algoritmos.

**DeepL / `tag_handling`**
Servicio de traducción clásico. Su opción `tag_handling=xml` junto con `ignore_tags` permite marcar trozos que no debe traducir: es la alternativa determinista al LLM.

---

## 8. JavaScript y TypeScript del día a día

**TypeScript (TS)** 🔑
JavaScript con tipos. Se escribe `.ts`, se compila a `.js`, y el compilador te avisa de errores antes de ejecutar. Viniendo de C++, es el lenguaje que más te va a sonar: `string[]`, `Map<number, Slot>`, interfaces.

**Tipo, `interface`, `type`** 🔑
Descripción de la forma que debe tener un dato. `interface SiteAdapter { ... }` es el contrato que cumplen todos los adaptadores de jueces. Equivale a una clase abstracta o un `concept` de C++.

**Unión discriminada** 🔑
Un tipo que puede ser una cosa **o** otra, con un campo que dice cuál: `{kind:'opaque', node} | {kind:'inline', el}`. El compilador te obliga a comprobar `kind` antes de usar los campos. Es la forma limpia de modelar "esto es o una fórmula o un `<b>`".

**Genérico**
Tipo parametrizado, como las plantillas de C++: `Map<number, Slot>` es un `Map` cuyas claves son números y cuyos valores son `Slot`.

**`null` / `undefined`**
Dos formas de "no hay valor". `querySelector` devuelve `null` si no encuentra nada; una variable sin asignar es `undefined`. TS te obliga a comprobarlos.

**Optional chaining `?.` y nullish `??`**
`a?.b` no explota si `a` es nulo (devuelve `undefined`). `a ?? b` usa `b` solo si `a` es nulo. Ahorran montañas de `if`.

**`const` / `let`**
Declaración de variables. `const` no se reasigna (usa esto por defecto), `let` sí. `var` está obsoleto.

**Arrow function `=>`**
Sintaxis corta para funciones: `(x) => x * 2`. Muy parecida a una lambda de C++.

**Callback**
Una función que pasas a otra para que la llame más tarde ("cuando el usuario haga clic, ejecuta esto").

**Promesa (`Promise`)** 🔑
Un objeto que representa un resultado que **aún no ha llegado** (una respuesta de red, por ejemplo). Se resuelve con éxito o se rechaza con error.

**`async` / `await`** 🔑
Azúcar sintáctico sobre las promesas: `await fetch(...)` pausa esa función hasta que llega la respuesta, sin bloquear el resto del navegador. Escribes código asíncrono con aspecto secuencial.

**Asíncrono vs. síncrono**
Síncrono = se ejecuta y termina antes de seguir. Asíncrono = se lanza y el resultado llega después. Casi todo lo que toca red, disco o almacenamiento es asíncrono en JS.

**`try / catch`**
Manejo de errores. Toda llamada de red va dentro de uno.

**`Map`** 🔑
Diccionario clave → valor, con orden de inserción y claves de cualquier tipo. Es donde guardamos `id → nodo original`. El equivalente práctico de un `unordered_map` de C++.

**`Set`**
Colección sin duplicados.

**Array y sus métodos** 🔑
`map` transforma cada elemento y devuelve un array nuevo; `filter` se queda con los que cumplen una condición; `forEach` recorre sin devolver nada; `join` une en una cadena; `every` comprueba que todos cumplan algo. Son la forma idiomática de trabajar en JS: casi nunca escribirás un `for` clásico.

**Spread `...`**
Expande una colección: `[...nodeList]` convierte una lista del DOM en un array de verdad, para poder usar `map` y `filter`.

**Destructuring**
Sacar campos de un objeto en una línea: `const { provider, apiKey } = await getSettings();`.

**Módulo / `import` / `export`** 🔑
Cada archivo `.ts` es un módulo: `export` lo que quieras que otros usen, `import` lo que necesites. Es el sistema de `#include` pero con nombres explícitos y sin duplicados.

**Función pura** 🔑
Función que solo depende de sus argumentos y no toca nada externo (ni red, ni disco, ni variables globales). `extract()` y `restore()` lo son, y por eso se pueden testear en milisegundos. Es el concepto que justifica toda la carpeta `core/`.

**Efecto secundario (side effect)**
Cualquier cosa que una función hace además de devolver un valor: escribir en pantalla, guardar en disco, llamar a una API. Se concentran en las capas de fuera.

**I/O**
Entrada/salida: red, almacenamiento, ficheros. Todo lo que es lento y puede fallar.

**Pila (stack)**
Estructura donde lo último que entra es lo primero que sale. En `restore()` usamos un array como pila para saber "dentro de qué elemento estoy insertando ahora mismo" mientras recorremos los tokens de apertura y cierre. Es el mismo mecanismo que valida paréntesis balanceados.

---

## 9. Herramientas y flujo de trabajo

**Node.js**
Entorno que ejecuta JavaScript **fuera** del navegador, en tu máquina. Necesario para las herramientas de desarrollo, aunque tu extensión luego corra en Chrome.

**npm**
Gestor de paquetes de Node. `npm install` descarga dependencias a `node_modules/`; `package.json` es la lista de lo que necesita el proyecto y de los comandos disponibles (`npm run build`).

**Bundler (empaquetador)**
Herramienta que junta tus muchos archivos `.ts` en unos pocos `.js` que el navegador pueda cargar, resolviendo los `import`. Es, en espíritu, tu *linker*.

**Vite** 🔑
El bundler/servidor de desarrollo recomendado. Rápido y con configuración mínima.

**CRXJS**
Plugin de Vite específico para extensiones de Chrome: procesa el `manifest.json`, compila los scripts que declara y recarga la extensión al guardar.

**WXT**
Alternativa a CRXJS que además genera builds para Firefox desde el mismo código.

**HMR (Hot Module Replacement)**
Recarga en caliente: guardas un archivo y el cambio se aplica sin rebuild manual ni reinstalar la extensión.

**`dist/`**
Carpeta con el resultado compilado. Es lo que cargas en `chrome://extensions` y lo que **no** se sube a git.

**ESLint**
Analizador estático que marca errores y malas prácticas mientras escribes.

**Prettier**
Formateador automático. Elimina las discusiones de estilo: guardas y el código queda formateado igual siempre.

**VS Code**
El editor recomendado. Su integración con TypeScript te muestra los errores de tipo en tiempo real, que es la mitad del valor de usar TS.

**Git / repositorio / `.gitignore`**
Control de versiones. `.gitignore` lista lo que nunca debe subirse: `node_modules/`, `dist/`, `.env` y cualquier archivo con claves.

---

## 10. Pruebas

**Test unitario** 🔑
Un programa pequeño que comprueba automáticamente que una función concreta hace lo que debe. Muy parecido a los casos de prueba que ya escribes para depurar una solución de concurso, pero guardados y ejecutables con un comando.

**Vitest**
El framework de tests que se integra con Vite. `npm run test` y en un segundo sabes si rompiste algo.

**jsdom**
Una implementación del DOM que corre en Node, sin abrir un navegador. Permite testear `extract()` y `restore()` con HTML real desde la terminal.

**Fixture** 🔑
Un dato de entrada guardado para los tests: aquí, el HTML auténtico de un enunciado de Codeforces en `tests/fixtures/`. Vale mucho más que un HTML inventado, porque las páginas reales tienen rarezas que no se te ocurrirían.

**Mock / stub / fake** 🔑
Un sustituto falso de algo real para poder probar sin él. En la Fase 2 se usa un traductor falso que devuelve `[ES] <texto>`, así se valida todo el algoritmo sin gastar una sola llamada a la API.

**Test de round-trip (ida y vuelta)** 🔑
La prueba estrella del proyecto: extraer y restaurar sin traducir debe devolver **exactamente** el contenido original. Si esto pasa, el algoritmo de protección es correcto.

**Aserción (assert)**
La comprobación concreta dentro de un test: `expect(a).toBe(b)`.

**Regresión**
Que algo que funcionaba se rompa por un cambio nuevo. Los tests existen para detectarlo el mismo día.

**Definition of Done (DoD)**
Criterio explícito y verificable para dar una fase por terminada. Evita el "creo que ya está".

---

## 11. Arquitectura y diseño

**Arquitectura**
Cómo se reparten las responsabilidades entre las piezas del sistema y cómo se hablan entre sí.

**Capa (layer)** 🔑
Un grupo de código con una única responsabilidad: presentación (content), dominio (core), infraestructura (background). Cada capa solo conoce a la de al lado. Es la misma idea que separar *controller*, *service* y *repository* en un backend.

**Separación de responsabilidades**
Que cada archivo haga una cosa. Por eso `protector.ts` no sabe nada de Codeforces ni de HTTP.

**Acoplamiento**
Cuánto depende una pieza de otra. Bajo acoplamiento = puedes cambiar una sin tocar las demás. Todo el acoplamiento a un juez concreto está encerrado en `adapters/`.

**Patrón Adapter / Strategy** 🔑
Definir una interfaz común (`SiteAdapter`, `TranslationProvider`) y tener varias implementaciones intercambiables. Añadir AtCoder o cambiar de DeepL a un LLM pasa a ser un archivo nuevo, no una cirugía. Es el equivalente a programar contra una clase base abstracta.

**Contrato**
Lo que una interfaz promete: qué recibe y qué devuelve. Mientras se respete, el resto del sistema no se entera de cómo está implementado por dentro.

**Frontera de confianza**
La línea que separa lo que maneja secretos de lo que no. Aquí es la carpeta `background/`: auditar la seguridad del proyecto se reduce a leer esa carpeta.

**Pipeline**
Una secuencia de etapas donde la salida de una es la entrada de la siguiente. El algoritmo del proyecto son 7 etapas encadenadas.

**Caché** 🔑
Guardar un resultado caro para no recalcularlo. Traducción ya hecha → se lee de `chrome.storage.local` y no se llama a la API.

**Hash / FNV-1a** 🔑
Función que convierte un texto largo en un número corto. Sirve como clave de caché y, de regalo, detecta si el enunciado cambió (texto distinto → hash distinto → traducción caducada). FNV-1a es una de las más simples de implementar, unas 8 líneas.

**Snapshot (instantánea)** 🔑
Copia del estado antes de modificarlo, para poder volver atrás. Aquí, el clon profundo del enunciado original que permite el botón "ver en inglés".

**Toggle**
Interruptor de dos estados. El botón que alterna español ↔ inglés.

**Degradación elegante (graceful degradation)** 🔑
Que un fallo parcial no rompa nada: si un párrafo no se puede traducir con seguridad, se queda en inglés y se marca, en lugar de dejar el enunciado corrupto. La regla del proyecto: **ante la duda, mostrar el original**.

**Idempotencia**
Que repetir una operación no cambie el resultado. Pulsar dos veces "traducir" no debe traducir lo ya traducido.

**Escalabilidad del diseño**
Aquí no significa "muchos usuarios", sino "cuánto cuesta añadir el siguiente juez". La respuesta objetivo: 20 líneas.

---

## 12. Seguridad

**XSS (Cross-Site Scripting)** 🔑
Vulnerabilidad en la que texto que viene de fuera acaba ejecutándose como código en la página. Ocurre típicamente al insertar contenido externo con `innerHTML`. En este proyecto es imposible por diseño: la respuesta del modelo solo se convierte en `TextNode`s, que el navegador jamás interpreta como código.

**Sanitizar**
Limpiar una entrada de contenido peligroso antes de usarla. Nuestra alternativa es mejor: no interpretarla nunca como HTML.

**Inyección**
Familia de ataques donde datos se cuelan como instrucciones. XSS es la versión web; la inyección SQL, que ya conoces, es la misma idea sobre una base de datos.

**Secreto / credencial**
Cualquier dato que da acceso o genera coste: API keys, tokens. Regla simple: si aparece en el repositorio, ya está comprometido.

**Superficie de ataque**
Cuántos sitios podrían ser atacados. Menos permisos, menos dominios y menos código = superficie menor.

**Mundo aislado (isolated world)**
El entorno separado donde corre un content script: comparte el DOM con la página pero no sus variables. Impide que un script de la web lea las tuyas.
