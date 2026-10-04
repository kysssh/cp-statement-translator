# Guía — Añadir Vjudge a la extensión

Traducir enunciados en Vjudge: problemas sueltos, contests simulados, contests de grupos privados, contests creados por ti y cualquier otra página donde aparezca un enunciado.

Mismo formato y reglas que `guia-de-implementacion.md` (niveles de ayuda, plantilla de preguntas, un commit por tarea, bitácora).

**Esta guía es independiente de la Etapa 6** (USACO y CP-Algorithms). Parte de la extensión de problemas tal como la dejaste en `v1.0`. No necesitas lotes ni cola de tasa: un enunciado cabe en una petición, igual que en Codeforces.

---

## Lo que debes saber antes de empezar

**No he podido inspeccionar el DOM de Vjudge** (el sitio bloquea las peticiones automáticas). Por eso esta guía no trae selectores: te dice cómo encontrarlos. Lo único que encontré es un mensaje de un blog de Codeforces de 2019 que mencionaba los ids `problem-name` y `problem-body` en las páginas de problema de Vjudge. Trátalo como una pista que hay que verificar, no como un hecho: puede haber cambiado.

**Por qué Vjudge es distinto a Codeforces y CSES.** Vjudge no escribe los enunciados: los trae de otros jueces (Codeforces, AtCoder, HDU, POJ, SPOJ, UVA…), cada uno con su propio HTML. Tu adapter ya no se enfrenta a un formato, sino a una **colección de formatos** dentro de una misma carcasa. Eso afecta sobre todo a tres cosas:

| Diferencia | Consecuencia |
|---|---|
| El HTML del enunciado varía según el juez de origen | Selectores en forma de unión, y fixtures de varios orígenes |
| Los jueces antiguos usan `<br>`, `<sub>`, `<sup>` y texto suelto dentro de `<div>`, no párrafos `<p>` | Casos que tu extractor v1.0 no ha visto (V05, V06) |
| Hay varias formas de llegar a un enunciado: página de problema, pestaña dentro de un contest, grupo, contest virtual | Cada una puede cargar el contenido de otra manera (V02, V09) |

**Lo que no cambia:** el core (`extract()`, `restore()`, `isValid()`), los proveedores y la caché. Tampoco necesitas manejar sesiones: el content script corre dentro de tu navegador ya autenticado, así que los grupos y contests privados se ven igual que cualquier otra página. La extensión no inicia sesión ni descarga nada por su cuenta; solo lee lo que ya estás viendo.

---

## Mapa

| # | Tarea | Dif. | Tiempo | Depende |
|---|---|---|---|---|
| **Etapa V0 — Reconocimiento** ||||
| V01 | Rama desde `v1.0` | 🟢 | 15 min | — |
| V02 | Mapa de tipos de página de Vjudge | 🟡 | 60 min | V01 |
| V03 | Localizar dónde vive el enunciado (iframe o no) | 🟡 | 45 min | V02 |
| V04 | Fixtures de varios jueces de origen | 🟢 | 45 min | V03 |
| **Etapa V1 — Adapter y core** ||||
| V05 | Adapter `vjudge.ts` v1: selectores en unión | 🟡 | 60 min | V04 |
| V06 | Texto suelto sin `<p>` | 🟡 | 60 min | V05 |
| V07 | Round-trip sobre los fixtures | 🔴 | 90 min | V06 |
| **Etapa V2 — Integración** ||||
| V08 | Manifest, frames y montaje del botón | 🟡 | 45 min | V07 |
| V09 | Cambio de problema dentro de un contest | 🔴 | 75 min | V08 |
| V10 | Convivencia con la traducción propia de Vjudge | 🟡 | 30 min | V08 |
| V11 | Estados especiales: PDF, sin acceso, bajo demanda | 🟡 | 45 min | V09 |
| V12 | Privacidad en contests y grupos privados | 🟡 | 30 min | V08 |
| V13 | Prueba por tipo de página | 🟡 | 60 min | V11, V12 |
| V14 | Cierre: README, etiqueta y bitácora | 🟢 | 45 min | V13 |

**Total: ~12 horas.** El reconocimiento (V02–V04) es lo que más condiciona el resto; no lo recortes.

---

# Etapa V0 — Reconocimiento

### V01 — Rama desde `v1.0`
🟢 Fácil · ⏱ 15 min · 📁 repositorio · ⬅ —

`npm run test` y `npm run build` en verde, y luego:

```bash
git switch -c feat/vjudge
```

Si ya hiciste la Etapa 6, parte de la etiqueta más reciente que tengas. **Verificación:** `git branch` te marca en `feat/vjudge`.

---

### V02 — Mapa de tipos de página de Vjudge
🟡 Media · ⏱ 60 min · 📁 `NOTAS-VJUDGE.md` (nuevo, en la raíz) · ⬅ V01

**🎯 Qué construyes**
Una tabla de todas las páginas donde puede aparecer un enunciado, con su URL y su comportamiento de carga. Sin esto, escribirás un adapter para una sola página y descubrirás las demás en producción.

**🧠 Conceptos previos**
Aplicación de una sola página (SPA) · Carga asíncrona (AJAX) · `hashchange` · Selector CSS 📖

**🔨 Cómo atacarlo**
Visita cada tipo de página y rellena una fila. Los tipos que te interesan:

| Tipo de página | Qué anotar |
|---|---|
| Problema suelto (`/problem/...`) | URL, ¿el enunciado está ya en el HTML o llega después? |
| Problema dentro de un contest | URL, ¿cambia la URL al pasar de A a B? ¿cambia solo la parte tras `#`? |
| Contest dentro de un grupo privado | ¿Es la misma página que un contest normal o distinta? |
| Contest creado por ti, antes de empezar | ¿Hay enunciado visible? ¿Qué ves en su lugar? |
| Contest virtual (repetición de uno pasado) | ¿Igual que el normal? |
| Descripción o anuncios del contest | ¿Hay texto escrito por el organizador que también quieras traducir? |

Para cada una, mira en la pestaña **Network** si el enunciado llega en una petición aparte al cambiar de problema. Esa respuesta es la pista de que el DOM se reconstruye dinámicamente.

Para ver si cambiar de problema cambia la URL, pega esto en la consola y navega por los problemas del contest:

```js
addEventListener('hashchange', () => console.log('hash:', location.hash));
const f = location.href;
setInterval(() => { if (location.href !== f) console.log('url cambió:', location.href); }, 500);
```

**✅ Verificación**
`NOTAS-VJUDGE.md` tiene una fila por tipo de página con su URL real, y una columna "el DOM cambia sin recargar: sí/no".

**💬 Si te atascas**
> "V02: en el contest, al pasar de A a B la URL solo cambia el hash y en Network aparece esta petición: `<pega>`. ¿Cómo debería detectar yo el cambio?"

---

### V03 — Localizar dónde vive el enunciado
🟡 Media · ⏱ 45 min · 📁 `NOTAS-VJUDGE.md` · ⬅ V02

**🎯 Qué construyes**
La respuesta a la pregunta que más afecta a la arquitectura: **¿el enunciado está en la página principal o dentro de un `<iframe>`?** Si está en un iframe, tu content script (que por defecto solo corre en la página principal) ni lo verá.

**🧠 Conceptos previos**
`<iframe>` · Mismo origen / origen distinto 📖 · Contexto de la consola en DevTools

**🔍 Investiga primero**
- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts — busca `all_frames`, `match_about_blank` y `match_origin_as_fallback`

**🔨 Cómo atacarlo**
1. En la página de un problema, pega esta sonda en la consola:

```js
console.table([...document.querySelectorAll('iframe')].map(f => {
  let accesible = false;
  try { accesible = !!f.contentDocument; } catch (e) {}
  return { id: f.id, name: f.name, src: f.src, accesible };
}));
console.log('#problem-name:', document.getElementById('problem-name'));
console.log('#problem-body:', document.getElementById('problem-body'));
```

2. Interpreta el resultado:
   - **No hay iframes y existen esos dos ids** → el enunciado está en la página principal. Es el caso fácil.
   - **Hay un iframe con `src` propio y `accesible: true`** → es del mismo origen. Tienes dos caminos: que el content script también corra dentro del iframe, o que el de la página principal acceda a su documento.
   - **Hay un iframe `accesible: false`** → origen distinto; solo te sirve el camino de ejecutar el script dentro del propio iframe.
3. **Truco de DevTools:** la consola ejecuta por defecto en el contexto `top`. Arriba a la izquierda de la consola hay un selector donde puedes elegir el contexto del iframe y repetir la sonda de `NOTAS-DOM` de T02 **dentro** de él.
4. Anota también: ¿el enunciado tiene varias "versiones" o pestañas (por ejemplo, original y alguna alternativa)? ¿Algunos problemas se muestran como PDF?

**✅ Verificación**
`NOTAS-VJUDGE.md` dice, para cada tipo de página de V02: "enunciado en la página principal" o "en iframe `<src>`", con los selectores del contenedor.

**💬 Si te atascas**
> "V03: la sonda muestra un iframe con src `<…>` y accesible true. ¿Qué es mejor, ejecutar el content script dentro del iframe o acceder a su contentDocument desde la página principal?"

---

### V04 — Fixtures de varios jueces de origen
🟢 Fácil · ⏱ 45 min · 📁 `tests/fixtures/` · ⬅ V03

Guarda, como en T03, el HTML del contenedor del enunciado (`copy($0.outerHTML)`) de **al menos cinco problemas de jueces de origen distintos**. Elige a propósito de tipos diferentes:

| Tipo | Por qué |
|---|---|
| Un problema de Codeforces visto desde Vjudge | Comprueba cómo llega MathJax dentro de la carcasa de Vjudge |
| Uno de AtCoder | Estructura propia, con fórmulas y secciones etiquetadas |
| Uno de un juez antiguo (HDU, POJ o similar) | Aquí aparecen `<br>`, `<sub>`, `<sup>`, texto suelto y fórmulas escritas como texto |
| Uno con imágenes | Ver qué hacen con los diagramas y si hay texto dentro de la imagen |
| Uno cuyo enunciado sea un PDF | Para ver cómo lo presenta Vjudge (probablemente no traducible) |

Nómbralos por origen: `vj-codeforces.html`, `vj-atcoder.html`, `vj-hdu.html`…

**✅ Verificación** — los abres en el navegador y el enunciado se ve completo, con los ejemplos y fórmulas en su sitio.

> El PDF no se puede traducir con este método: no hay texto en el DOM que recorrer. Eso se trata en V11.

---

# Etapa V1 — Adapter y core

### V05 — Adapter `vjudge.ts` v1
🟡 Media · ⏱ 60 min · 📁 `src/adapters/vjudge.ts` · ⬅ V04

**🎯 Qué construyes**
El adapter, con selectores en **unión**: tienen que cubrir el HTML de varios jueces a la vez.

**🧠 Conceptos previos**
Patrón Adapter 📖 · Selector CSS 📖 · `matches()` 📖 · Nodo opaco 📖

**🔨 Cómo atacarlo**
1. Parte de la interfaz `SiteAdapter` de T10 y de los selectores de tus notas V03.
2. `opaqueSelector` (qué se protege): combina lo de los jueces que ya conoces: `pre`, `code`, `kbd`, `samp`, fórmulas de MathJax y KaTeX, imágenes y SVG. Añade lo que el HTML antiguo exige:
   - **`sub` y `sup`:** en HTML antiguo las matemáticas se escriben así (`10<sup>5</sup>`, `a<sub>i</sub>`). Si los tratas como formato inline normal, el modelo recibe `10⟦1⟧5⟦/1⟧`, que es justo el tipo de cosa que puede romper. Como opacos, `10⟦1⟧` es seguro. Compruébalo con tu fixture de un juez antiguo.
   - **`br`:** los saltos de línea. Mira qué hace tu `extract()` con un elemento sin hijos (pista: lo trata como estructural y devuelve cadena vacía, así que **el salto desaparece al restaurar**). Si lo declaras opaco, `restore()` lo reinserta donde corresponde.
3. `inlineSelector`: negritas, cursivas y enlaces.
4. `rawMathPattern`: algunos jueces antiguos escriben LaTeX como texto (`$n \le 10^5$`). Mira en tus fixtures qué delimitadores aparecen, y decide si hace falta un patrón. Ojo con el dólar suelto: en un enunciado sobre dinero, `$5` no es una fórmula.
5. `problemKey`: usa **el juez de origen y el identificador del problema** (algo como `vj:CodeForces-1692A`), no la URL de la página. Así el mismo problema abierto desde un contest, un grupo o la página suelta comparte caché.

**✅ Verificación**
TypeScript compila sin tocar `core/` ni los adapters de Codeforces y CSES, y puedes explicar de dónde sale cada selector (qué fixture lo justifica).

---

### V06 — Texto suelto sin `<p>`
🟡 Media · ⏱ 60 min · 📁 `src/core/segmenter.ts` (cambio **aditivo**) · ⬅ V05

**🎯 Qué construyes**
Soporte para enunciados donde el texto no está en párrafos sino directamente dentro de un `<div>`, separado por `<br>`.

**🔨 Cómo atacarlo**
1. Reproduce el problema primero con el fixture de un juez antiguo: ¿qué devuelve tu `collectBlocks()` actual? Probablemente deja fuera ese texto, porque ningún elemento de tipo "bloque" lo contiene directamente.
2. Diseña una opción nueva del segmentador: "bloque hoja" = elemento con texto propio y sin hijos de tipo bloque. La opción tiene que tener **un valor por defecto que reproduzca exactamente el comportamiento de v1.0**. Solo el adapter de Vjudge la activa.
3. Piensa en el caso mixto: un `div` con texto suelto **y** `<p>` dentro. ¿Se pierde el texto suelto? ¿Se duplica el de los párrafos?

**✅ Verificación**
- Con el fixture del juez antiguo, el texto suelto ya aparece en la lista de bloques.
- Los tests de Codeforces y CSES de `v1.0` siguen en verde **sin modificarlos**. Es la prueba de que el cambio fue aditivo.

**💬 Si te atascas**
> "V06: mi collectBlocks pierde el texto que está directamente en un div junto a otros elementos. Dame una pista de cómo definir 'bloque hoja' sin duplicar texto."

---

### V07 — Round-trip sobre los fixtures
🔴 Difícil · ⏱ 90 min · 📁 `tests/protector.vjudge.spec.ts` · ⬅ V06

El mismo test de T17, con los cinco fixtures de V04: `extract()` → `restore()` sin traducir debe dejar el contenido **idéntico**, y los nodos opacos deben ser **las mismas instancias** (`===`).

Casos que debes cubrir expresamente:
- Saltos de línea (`br`): el número de `br` antes y después es el mismo, en el mismo orden.
- `sub` y `sup`: siguen en su sitio tras la restauración.
- Texto suelto: nada se pierde ni se duplica.
- Ningún signo `$` ni contenido de `<pre>` aparece en el texto que viajaría a la API.

**✅ Verificación**
En verde con los cinco fixtures. Cada fallo apunta a un selector que falta en V05 o a un caso de V06.

---

# Etapa V2 — Integración

### V08 — Manifest, frames y montaje del botón
🟡 Media · ⏱ 45 min · 📁 `src/manifest.json`, `src/content/` · ⬅ V07

**🎯 Qué construyes**
Que la extensión se ejecute en Vjudge, en el sitio correcto (página principal o iframe), y que el botón aparezca donde se vea.

**🔨 Cómo atacarlo**
1. Añade las URLs de Vjudge a `matches` de los `content_scripts`, según los patrones que anotaste en V02. Hazlos lo bastante amplios para cubrir problema suelto, contest y grupo.
2. Según V03:
   - **Enunciado en la página principal:** nada más.
   - **Enunciado en un iframe:** activa `all_frames` en esa entrada, y comprueba que las URLs del iframe también encajan en `matches`. Si el iframe no tiene URL propia (vacío o generado en el momento), revisa en la documentación enlazada en V03 las opciones para frames sin URL.
3. Si el script corre en dos sitios a la vez (página y iframe), asegúrate de que **no se instale dos veces** el botón ni se traduzca dos veces el mismo texto.
4. El botón: ponlo cerca de donde Vjudge muestra sus propias acciones sobre el problema. Usa tu prefijo de clases (`cpt-`) para que no choque con los estilos del sitio, y comprueba que se ve bien en modo claro y oscuro.
5. Recarga la extensión (no basta con recargar la página).

**✅ Verificación**
En un problema suelto y en un problema dentro de un contest aparece **un solo botón**, y pulsarlo traduce. En Codeforces y CSES todo sigue como en `v1.0`.

---

### V09 — Cambio de problema dentro de un contest
🔴 Difícil · ⏱ 75 min · 📁 `src/content/navigation.ts` · ⬅ V08

**🎯 Qué construyes**
Que al pasar del problema A al B dentro de un contest, la extensión se entere, no deje un botón "pegado" del problema anterior y no mantenga una traducción que ya no corresponde.

**🧠 Conceptos previos**
`hashchange` · `MutationObserver` · Estado por problema · Cancelación

**🔍 Investiga primero**
- MDN: `hashchange`, `MutationObserver`
- Si ya hiciste la Etapa 6, tu T41 resuelve esto para USACO; reutiliza lo que hiciste en vez de duplicarlo.

**🔨 Cómo atacarlo**
1. Con lo que descubriste en V02, decide qué señal usar: el cambio del hash, un cambio en el contenedor del enunciado (observador), o ambas.
2. Al detectar el cambio:
   - Quita o reinicia el botón y su estado.
   - Si había una petición de traducción en curso, descártala: su resultado ya no pertenece a la pantalla.
   - Calcula el `problemKey` del problema nuevo.
3. Decide la política y anótala: ¿se traduce automáticamente un problema nuevo si en el anterior pulsaste el botón? Yo empezaría por **no** hacerlo (más barato, más predecible).
4. Atención al orden: el contenedor puede aparecer vacío un instante antes de llenarse. No traduzcas hasta que tenga contenido.

**✅ Verificación**
Dentro de un contest, traduces A, pasas a B, vuelves a A: nunca se ve un botón duplicado, no aparece texto de A en B y la consola está limpia. Al volver a A, la caché lo sirve sin nueva petición.

**💬 Si te atascas**
> "V09: al cambiar de problema mi observador se dispara varias veces seguidas. ¿Cómo evito ejecutar la lógica más de una vez por cambio?"

---

### V10 — Convivencia con la traducción propia de Vjudge
🟡 Media · ⏱ 30 min · 📁 `src/content/` · ⬅ V08

Vjudge ofrece su propio botón de traducción con IA. Si el usuario lo usa y luego pulsa el tuyo, tu extensión traduciría texto ya en español.

1. Primero **observa**: pulsa el botón de Vjudge y mira en Elements qué hace con el DOM (¿sustituye el texto? ¿añade un bloque aparte? ¿lo hace dentro de un iframe?). Anótalo.
2. Una defensa sencilla: antes de traducir, comprueba si el texto del enunciado ya es mayoritariamente español (por ejemplo, contando palabras vacías frecuentes como "de", "la", "que" frente a "the", "of", "and"). Si lo es, no traduzcas y muestra un aviso.
3. Es una heurística, no una garantía. Pruébala con un enunciado traducido por Vjudge y con uno original.

**✅ Verificación** — con el enunciado ya traducido por Vjudge, tu botón avisa en vez de gastar una petición.

---

### V11 — Estados especiales: PDF, sin acceso, bajo demanda
🟡 Media · ⏱ 45 min · 📁 `src/content/`, `src/adapters/vjudge.ts` · ⬅ V09

Casos donde **no** debe haber una traducción normal:

| Caso | Comportamiento esperado |
|---|---|
| Enunciado en PDF | Sin botón, o botón deshabilitado con el motivo ("este enunciado es un PDF y no se puede traducir") |
| Contest que aún no empezó o sin acceso | No hay enunciado en el DOM: no mostrar botón (ni un botón que falle) |
| Enunciado vacío o con error de carga | Mensaje claro, sin traducir una página de error |
| Imágenes con texto dentro | Se quedan como están; avisar si el enunciado tiene muchas |

Y una decisión de coste: en un contest con 10 problemas, **traduce solo el problema que abres**, nunca todos a la vez. Es lo que hace tu botón ahora y conviene mantenerlo así.

**✅ Verificación** — para cada fila de la tabla tienes una página real o un fixture que lo demuestra, y en ninguna el usuario ve un botón que no puede cumplir.

---

### V12 — Privacidad en contests y grupos privados
🟡 Media · ⏱ 30 min · 📁 `src/options/`, `src/content/` · ⬅ V08

**Este punto es de diseño, no de código, y conviene que lo pienses.** Al traducir, el texto del enunciado se envía a un servicio externo (Groq). En un problema público no importa. En un **grupo privado** o en un contest que un organizador preparó y todavía no ha publicado, ese contenido puede ser confidencial, o estar sujeto a reglas del grupo.

1. Lee la política de datos de Groq y anota qué hace con lo que le envías. La fuente de verdad es su sitio, no esta guía.
2. Decide qué haces. Opciones, de menos a más estricta:
   - **Aviso la primera vez** en Vjudge: "el texto se enviará a un servicio externo".
   - **Ajuste en Opciones** para desactivar la traducción por red en Vjudge y usar solo el traductor local, que no envía nada fuera.
   - Ambas.
3. El traductor local de Chrome (Nivel 0 de v1.0) no sale de tu máquina. Para contenido privado es la alternativa natural.
4. Otra cosa que conviene saber: tu caché guarda en `chrome.storage.local` el texto fuente (o su hash) y la traducción. Eso queda en tu navegador; ofrece un botón "borrar caché" si no lo tienes.

Un último aviso, ya fuera del código: muchos contests tienen reglas sobre herramientas externas. Traducir no es resolver, pero comprueba las normas de tu organizador antes de usar la extensión en uno real.

**✅ Verificación** — la primera vez que abres un problema de Vjudge ves el aviso (o tienes el ajuste), y con el traductor local seleccionado no sale ninguna petición de red en la pestaña Network.

---

### V13 — Prueba por tipo de página
🟡 Media · ⏱ 60 min · 📁 `NOTAS-VJUDGE.md` · ⬅ V11, V12

Recorre la tabla de V02 y marca, **en el navegador real**, cada tipo de página:

```
                                       botón  traduce  fórmulas ok  sin errores
Problema suelto                         [ ]     [ ]       [ ]          [ ]
Problema dentro de un contest           [ ]     [ ]       [ ]          [ ]
Contest de grupo privado                [ ]     [ ]       [ ]          [ ]
Contest creado por mí                   [ ]     [ ]       [ ]          [ ]
Contest virtual                         [ ]     [ ]       [ ]          [ ]
Cambio A → B → A                        [ ]     [ ]       [ ]          [ ]
Problema con PDF                        [ ]  (esperado: sin botón)
Problema ya traducido por Vjudge        [ ]  (esperado: aviso)
Codeforces y CSES (regresión)           [ ]     [ ]       [ ]          [ ]
```

Repite con un problema de cada juez de origen de tus fixtures. Cada casilla que falle genera una tarea pequeña: arréglala en el adapter, no en el core.

---

### V14 — Cierre: README, etiqueta y bitácora
🟢 Fácil · ⏱ 45 min · 📁 raíz · ⬅ V13

README: sitios soportados (añade Vjudge), limitaciones (PDF e imágenes), nota de privacidad. Bitácora: qué tipos de página te dieron problemas y por qué. Antes de fusionar:

```bash
npm run test
git tag v1.2   # o el número que corresponda
```

Los tests de `v1.0` deben seguir en verde: es la prueba de que no rompiste Codeforces ni CSES.

---

# Apéndices

## A — Errores probables y su causa

| Lo que ves | Casi siempre es |
|---|---|
| No aparece el botón en el contest pero sí en el problema suelto | El enunciado está en un iframe y falta `all_frames`, o `matches` no cubre la URL del iframe |
| El botón aparece dos veces | El script corre en la página y en el iframe a la vez |
| Los saltos de línea desaparecen tras traducir | `br` no está en `opaqueSelector` |
| `10^5` se rompe en `10 5` o similar | `sub`/`sup` no están protegidos como opacos |
| Parte del enunciado queda sin traducir | Texto suelto en un `div` que `collectBlocks` no considera bloque (V06) |
| Al cambiar de problema queda el botón o el texto del anterior | Falta detectar el cambio dentro del contest (V09) |
| Dos pulsaciones traducen dos veces | Falta marcar el enunciado como ya traducido (idempotencia) |
| Un `$5` se trata como fórmula | `rawMathPattern` demasiado amplio para ese juez |
| La traducción en español se vuelve a traducir | Falta la comprobación de V10 |
| Fallan los tests de Codeforces tras tocar el core | El cambio no fue aditivo; revisa con `git diff v1.0` |

## B — Dónde te conviene pedir pista y dónde código

Quédate en pista o esqueleto en **V03** (qué hacer con el iframe), **V06** (qué es un "bloque hoja") y **V09** (detectar el cambio de problema). Son las decisiones nuevas de esta guía. Para el manifest y la configuración de `all_frames`, pide código directo.

## C — Qué anotar en la bitácora

- Dónde vive el enunciado en cada tipo de página (V03).
- Qué jueces de origen te dieron más problemas y por qué.
- Cuántos bloques rechaza `isValid()` por juez de origen, comparado con Codeforces.
- Qué decidiste sobre privacidad y por qué (V12).

## D — Por dónde empezar

1. **V01** y luego **V02**, sin saltarte nada. Es la tarea que más te va a ahorrar.
2. **V03**: la sonda de los iframes te dice en 5 minutos cuál es el camino.
3. Cuando tengas V02 y V03 rellenos, cuéntame qué encontraste y ajustamos V05 y V08 con datos reales en vez de hipótesis.
