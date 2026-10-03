# NOTAS-DOM — Reconocimiento del DOM

Bitácora de reconocimiento. Cada sección dice **qué se miró, cómo y qué salió**. Nada aquí es supuesto: todo se comprobó en el sitio real con un navegador headless.

Páginas inspeccionadas (todas respondieron 200):

| URL | Tipo | Caracteres de `.markdown` |
|---|---|---|
| `/silver/prefix-sums` | teoría corta, muchas fórmulas y tablas | 5 124 |
| `/silver/binary-search` | teoría larga, 20 `<pre>`, tablas de problemas | 9 313 |
| `/general/usaco-faq` | FAQ, 22 `<li>`, sin código | 12 012 |

---

## 1. ¿Cuál es el contenedor del contenido?

**`div.markdown`**, y solo hay **uno** por página (`document.querySelectorAll('.markdown').length === 1`).

Cadena de ancestros medida, de dentro hacia fuera:

```
DIV.markdown
DIV.order-2 w-0 min-w-0 flex-1 overflow-x-auto px-4 sm:px-6 lg:px-8 max-w-4xl
DIV.flex justify-center
DIV.mx-auto
MAIN.relative overflow-x-hidden pt-6
```

Dos avisos importantes:

- **`main` no sirve.** La sonda inicial de la guía elige `article || main`, y `main` aquí es el *shell* de la aplicación Next.js: contiene también la barra lateral de navegación y la cabecera. `main.querySelectorAll('p')` sobre `/silver/prefix-sums` ya daba las 24 del artículo, pero `main.innerText` incluye el índice lateral completo. Habríamos traducido el menú.
- El ancho máximo del contenido (`max-w-4xl`) está en el ancestro, no en `.markdown`. Para T46 (traducir sección a sección) el anclaje útil es `.markdown`.

### Qué queda **fuera** de `.markdown` y no debe traducirse

| Qué | Dónde está |
|---|---|
| Menú de secciones (Bronze/Silver/Gold…) | `nav` (hay 4 en la página), fuera de `.markdown` |
| Índice lateral del módulo | `nav`, fuera de `.markdown` |
| Cabecera con Search / Login | fuera de `.markdown` |
| Migas de pan (`Silver › Prefix Sums`) | fuera de `.markdown` |
| Botonera de la página ("Source of this module", idioma) | fuera de `.markdown` |
| Tabla de problemas al pie de un módulo | **sí** dentro de `.markdown` (ver §4) |
| Lista de contribuidores del pie | fuera de `.markdown` |

Buena noticia: como el contenido está aislado en `.markdown`, seleccionar con `.markdown p` excluye el menú sin esfuerzo. No hace falta un `opaqueSelector` para la navegación.

---

## 2. ¿Cómo es una fórmula?

KaTeX, con un **contenedor externo propio que es la clave**:

```html
<!-- en línea -->
<span class="language-math math-inline" data-latex="$\mathcal{O}(N)$">
  <span class="katex"><span class="katex-mathml">…MathML…</span><span class="katex-html">…</span></span>
</span>

<!-- en bloque / display -->
<div class="language-math math-display" data-latex="$$$\sum_{i=…}…$$$">
  <span class="katex-display"><span class="katex">…</span></span>
</div>
```

- `.katex` por sí solo es **insuficiente**: `.katex-mathml` está oculto por CSS pero su `textContent` sí existe, y KaTeX escribe el texto matemático legible en `<annotation encoding="application/x-tex">` y en `data-latex`. Traducir por dentro de `.katex` tocaría MathML y sería un desastre.
- **Lo que hay que marcar como opaco es `.language-math`** (51 y 58 ocurrencias en las páginas medidas, y `.katex` nunca aparece sin él). Es el elemento que React controla.
- Medidas: `/silver/prefix-sums` → 58 `.katex`, 58 `.language-math`, 7 `.math-display`. `/silver/binary-search` → 41 `.katex`. Coinciden exactamente: `.language-math` es el único envoltorio.
- **No hay LaTeX sin renderizar**: no hay `mjx-container` (0), no hay MathJax. Todo pasa por KaTeX. Por tanto **`rawMathPattern` no hace falta** en el adapter (confirmado en T42).
- Sí hay texto que parece fórmula pero es un `<span>` de KaTeX interno (`span.mord`, `span.texttt`…). Queda dentro de `.language-math`, así que no hay que worryse de ellas.

---

## 3. ¿Cómo es un bloque de código?

Dos elementos distintos conviven, y hay que distinguirlos:

**a) Código real de programa** — el que no se toca:

```html
<div class="relative -mx-4 mb-4 bg-gray-100 p-4 …">
  <pre class="… prism-code language-cpp"><code>…</code></pre>
</div>
```

La clase útil es **`prism-code`** (con `language-cpp` y sisters). `/silver/binary-search` tiene 20 de estos; `pre` a secas también sirve, pero `prism-code` es más preciso y no atrapa los `<pre>` del editor.

**b) Un `<pre>` decorativo sin clase** dentro de `.markdown`, cuyo contenido empieza por `Copy`:

```html
<pre>Copy#include &lt;bits/stdc++.h&gt;…</pre>
```

Aparecen en `/silver/prefix-sums` (2 `<pre>`, uno de ellos este). Es texto de ejemplo de un bloque de código pero **no** es un bloque de código funcional: no tiene `.prism-code`. Decisión: se marca como opaco igualmente (es código, no prosa), así que el texto `Copy` que lleva delante queda dentro del nodo opaco y no se traduce.

**Código inline**, con clase estable y consistente:

```html
<code class="inline-code">f(x)</code>
```

Medido: 1 en `/silver/prefix-sums`, 1 en `/general/usaco-faq`, y varios en los `h3`. **La clase `inline-code` es 100 % estable** en las tres páginas. Este es el caso que la guía anticipa: *"usa `std::vector` para…"*. Aquí es `usa <code class="inline-code">std::vector</code> para…`, dentro de un `h3` con dos `inline-code`.

---

## 4. ¿Cómo es una tabla de problemas?

**Es el punto delicado de este sitio.** HTML real medido en `/silver/binary-search`:

```html
<table class="no-markdown dark:text-dark-med-emphasis min-w-full text-gray-500">
  <thead><tr>
    <th colspan="2">Status</th><th>Source</th><th>Problem Name</th>
    <th>Difficulty</th><th>Tags</th><th></th>
  </tr></thead>
  <tbody class="table-alternating-stripes">
    <tr class="relative">
      <td id="problem-usaco-690" class="absolute bottom-[120px] h-[2px]"></td>   <!-- celda-vacía de anclaje -->
      <td>…<span class="…rounded-full…"></span></td>                            <!-- botón de estado, sin texto -->
      <td><span class="…border-b border-dashed…">Silver</span></td>              <!-- nivel: NO se traduce -->
      <td><a href="http://www.usaco.org/…cpid=690" class="…problem-list-item-anchor…"
             target="_blank" rel="nofollow noopener noreferrer">Cow Dance Show</a></td>  <!-- nombre: NO -->
      <td><span class="…bg-green-100…">Easy</span></td>                            <!-- dificultad: NO -->
      <td><details><summary>Show Tags</summary><span class="text-xs">Binary Search, Sorted Set</span></details></td>
      <td><button aria-expanded="false">…</button></td>                           <!-- kebab menu -->
    </tr>
```

Qué **no** debe traducirse aquí:

1. **Nombres de problema** — el ancla de clase `problem-list-item-anchor`.
2. **Nivel y dificultad** — `Silver`, `Easy`… están en celdas que también contienen texto real.
3. **Tags** — `Binary Search, Sorted Set`. Son identificadores de búsqueda, no prosa. Además el sitio los usa como filtro (`/problems` tiene "Hide tags").
4. **`Show Tags`** — el `<summary>`; no está en español en ninguna parte del sitio.
5. **Cabeceras de la tabla**: `Status`, `Source`, `Problem Name`, `Difficulty`, `Tags`.
6. **Celdas-ancla vacías** (`<td id="problem-…" class="absolute …">`): sin texto, pero `opaqueSelector` debe incluirlas o `extract()` las considerará bloques vacíos.

**Recomendación (para T42):** excluir la tabla de problemas **entera**. Es la opción que la guía recomienda cuando el aislamiento es frágil, y aquí el aislamiento es real pero con seis reglas distintas — seis oportunidades de equivocarse, y el costo de equivocarse es alto (traducir «Cow Dance Show» o «Show Tags» es visible de inmediato). Las tablas de datos matemáticos (`Index i | 0 | 1 | 2 …`) sí se traducen: son contenido real del artículo. La distinción es fácil: la tabla de problemas es la que tiene la clase `no-markdown` **y** una cabecera `Problem Name`. Hay 2 de esas en `/silver/binary-search` y 6 tablas en `/silver/prefix-sums` (ninguna de problemas).

Aclaración importante: **las tablas de matemáticas con fórmulas dentro se traducen bien**, porque cada celda con fórmula tiene su `.language-math` como opaco. En `/silver/prefix-sums` las cabeceras son `Index iii` y `prefix[i]\texttt{prefix}[i]prefix[i]` — la fórmula ya está protegida, solo queda el texto plano alrededor. Es el caso ideal para este protector.

---

## 5. ¿Los desplegables tienen su contenido en el DOM aunque estén cerrados?

**Sí, pero vacíos.** En `/silver/prefix-sums` hay 13 `<details>`; los 13 tienen `summary` = `Show Tags` y **0 `<p>`** dentro mientras están cerrados. Todos comparten la misma etiqueta, sin excepción. `/silver/binary-search`: 20 `<details>`, el mismo patrón. Los 13 de `/silver/prefix-sums` y `/general/usaco-faq` tiene 0.

Interpretación: el contenido de un `details` que depende del estado no está montado. O sea, **`MutationObserver` es obligatorio para el contenido que aparece al abrir** (T45): no basta con traducir al pulsar el botón.

Corolario práctico: hoy, en el sitio, los desplegables que hay son todos de etiquetas de problemas, y su contenido («Binary Search, Sorted Set») es identificador que **no** queremos traducir. Así que T45, para USACO, es menos crítico de lo previsto — pero sigue siendo obligatorio para CP-Algorithms y por si el sitio añade desplegables de soluciones.

---

## 6. Segundo experimento de hidratación

Se hizo con el DOM real, no con un párrafo suelto. En `/silver/prefix-sums`, con esperas de 1,5–2 s después de cada cambio para dar margen a un re-render:

| Elemento tocado | ¿Revive al original? | ¿Sigue siendo el mismo nodo? |
|---|---|---|
| `<p>` suelto en `.markdown` | **no** | **sí** |
| `<h2>` (con su enlace de ancla) | **no** | **sí** |
| `<td>` de tabla | **no** | **sí** |
| `<summary>` de un `details` (abrir → cerrar → abrir) | **no** | **sí** |

Traducción: **la hidratación de React no borra lo que escribimos en estos nodos.** El `data-probe` seguía puesto tras 2 s y el árbol de nodos conservaba la identidad. Coincide con lo que el usuario ya había comprobado a mano en un párrafo suelto; ahora está comprobado también en encabezado, celda y `summary`.

Consecuencias para el diseño:

1. **No hace falta un `MutationObserver` agresivo para re-aplicar** la traducción en el mismo documento. Solo hace falta para contenido que se *monta* después (los `details`, ver §5).
2. **Lo que sí destruye la traducción es navegar**, confirmado en la misma sesión: desde `/silver/prefix-sums` se pulsó un enlace del índice lateral a `/silver/two-pointers`; el `.markdown` se reemplazó por completo (`innerText` pasó de 5 124 a 5 542 de contenido nuevo) y **los `data-probe` residuales fueron 0**. Es una SPA de Next.js que no recarga. → **T41 es imprescindible aquí**; no es una medida preventiva, es una necesidad medida.

### Sobre el enlace de ancla de los encabezados

Los `h2` y `h3` llevan dentro un enlace decorativo que **es texto del encabezado**:

```html
<h2 class="…">
  <span id="resources" class="absolute" style="bottom:60px;height:2px"></span>
  <a aria-hidden="true" tabindex="-1" class="anchor before" href="#resources">
    <svg …>…</svg>
  </a>Resources
</h2>
```

En `/silver/prefix-sums` los 7 `h2` lo tienen; en `/general/usaco-faq`, 26 de 26 encabezados (`h2`+`h3`). Contiene `<svg>`, no texto, así que no ensucia la traducción — pero `restore()` mueve nodos y es exactamente el caso que el apéndice A de la guía marca como «Aparece `¶` o texto de navegación traducido». **El `.svg` interior debe ser opaco**, y el `span.absolute` del ancla también (es un artefacto de layout sin texto). Ambos son inocuos hoy, pero los marcamos por si el sitio cambia.

Detalle que sí importa: el `h3` de ejemplo contiene **código inline** dentro del encabezado:

```
Finding The Maximum <code class="inline-code">x</code> Such That <code class="inline-code">f(x) = true</code>
```

Es decir: los encabezados son bloques traducibles que **contienen código inline**. `extract()` tiene que proteger esos `code.inline-code` o la traducción se come la expresión.

---

## 7. Navegación

| Comprobación | Resultado |
|---|---|
| Next.js (`#__NEXT_DATA__`) | **sí** |
| Gatsby | no |
| Navigation API (`'navigation' in window`) | **true** |
| ¿Recarga al navegar entre módulos? | **no** — SPA pura; el `location.href` cambia a `/silver/two-pointers?lang=cpp` sin recarga |
| ¿Sobrevive el DOM antiguo? | no; `.markdown` se reconstruye |

El parámetro `?lang=cpp` viaja en la URL. No afecta al texto (el conmutador de idioma es solo de código), pero sí explica por qué los enlaces del índice llevan `?lang=cpp` y por qué la URL sirve para detectar navegación.

**Recomendación para T41:** la Navigation API está disponible (`true`), así que empieza por `navigation.addEventListener('navigatesuccess', …)` — no necesita el permiso extra de `webNavigation`. Y como ya está comprobado que `.markdown` se *reemplaza* (no se muta), el observador debe mirar si la **identidad** del nodo `.markdown` cambió, no si su contenido cambió.

---

## Resumen operativo para T42

```text
raíz de contenido      .markdown            (1 por página; NO main)
traducir               .markdown p, .markdown li, .markdown h2, .markdown h3,
                       .markdown h4, .markdown td, .markdown th, .markdown blockquote
opaco                  .language-math, .math-display, pre, .prism-code,
                       code.inline-code, img, svg, button, a.anchor, span.absolute,
                       details > summary, table.no-markdown
inline (formato)       strong, em, a
no existe              mjx-container (MathJax), rawMathPattern
```

Cosas que **no** vi en el sitio y que la guía mencionaba, para no buscarlas luego:

- **Pestañas de código con selector de lenguaje.** No hay ninguna: `/silver/binary-search` tiene 20 bloques `prism-code` y **cero** `[role="tab"]` ni botones de lenguaje. El conmutador `?lang=cpp` es un desplegable de la cabecera, fuera de `.markdown`, y no forma parte del texto traducible. → **T45 se simplifica mucho en USACO**: no hay pestañas de código que re-rendericen.
- **Pestañas de contenido tipo `tabbed`.** No hay.
- **`img` dentro del artículo**: 0 en las dos páginas de teoría, 1 en la FAQ. El artículo usa `svg` inline (31–33 por página) para iconos.
- **`li` en las páginas de teoría**: 0 en `/silver/prefix-sums`, 4 en `/silver/binary-search`, 22 en la FAQ. Las listas son poco frecuentes pero existen.

---

## Tareas de T32 que quedan para ti

Nada bloqueante. Dos detalles que solo tú puedes decidir y que T42 necesita:

1. **La tabla de problemas**: la recomendación de arriba es excluirla entera (`table.no-markdown` con cabecera `Problem Name`). Si prefieres traducir solo los encabezados de columna y el nivel, la alternativa es una lista de exclusión más larga y frágil. Decide antes de T42.
2. **La «pestaña de código»**: confirmamos que no existe como componente con estado. Cuando lleguemos a T45, no busquemos algo que no está; lo que sí hay que vigilar es el `details` (montado bajo demanda) y la navegación SPA.

---

# CP-Algorithms — T48 (2026-10-03)

Reconocimiento realizado con Chrome headless y Chrome DevTools Protocol. Se inspeccionó el DOM tras cargar JavaScript y MathJax; no solo el HTML de la respuesta HTTP. Script reproducible: `node tools/inspect-cpalgorithms.mjs` (requiere Chrome instalado en la ruta indicada, red y permiso de escritura). Cada ejecución crea un perfil temporal independiente; no utiliza el perfil personal. Informe completo: `tests/fixtures/cpalgorithms-dom-report.json`.

## Páginas y fixtures

| Artículo | Fixture | Párrafos | Bloques pre | Fórmulas .arithmatex | Conjuntos de pestañas |
|---|---|---:|---:|---:|---:|
| https://cp-algorithms.com/algebra/euclid-algorithm.html | cpalgorithms-corto.html | 23 | 5 | 55 | 0 |
| https://cp-algorithms.com/data_structures/segment_tree.html | cpalgorithms-codigo.html | 153 | 23 | 306 | 0 |
| https://cp-algorithms.com/graph/breadth-first-search.html | cpalgorithms-pestanas.html | 18 | 4 | 57 | 2 |

Los fixtures guardan el artículo renderizado completo, con procedencia y fecha en un comentario. No contienen la sonda de edición: se capturaron antes del experimento. La muestra corta es relativa a Segment Tree; conserva fórmulas y código reales.

## Contenedor y exclusiones

- Existe exactamente un `article.md-content__inner` por página. El índice y la navegación lateral quedan fuera; no usar `main` ni `.md-typeset` como raíz global.
- Dentro del artículo hay elementos ajenos a la prosa: `script`, enlaces `.md-content__button` y listas `.metadata.page-metadata` al comienzo y al final (fecha, procedencia y autores). Excluirlos completos.
- Prosa candidata para T49: `p, li, h1, h2, h3, h4, h5, h6, td, th`; el recolector debe excluir descendientes de elementos opacos y evitar duplicar bloques anidados. Incluir h1, a diferencia del adapter actual de USACO.
- Cada encabezado lleva `a.headerlink` con texto `¶` (7, 33 y 5 respectivamente). Mantener el nodo opaco, sin enviar el símbolo a traducción.

## Fórmulas y código

- MathJax 3 genera `mjx-container.MathJax` dentro de `.arithmatex` tanto inline como display. Proteger el envoltorio `.arithmatex` entero; contar contenedores MathJax no equivale a contar fórmulas (en estas capturas hay contenedores anidados de accesibilidad).
- Proteger también `mjx-container, .MathJax` como respaldo. En los párrafos inspeccionados no se encontraron dólares restantes fuera de `.arithmatex` y `code`; T49 debe considerar el estado previo al renderizado y T50 debe verificarlo.
- Código de bloque dentro de `.highlight`, con `pre`, `code` y botones de copiar. Proteger `.highlight, pre, code` y controles; no traducir nombres de variables ni el código inline (3 y 7 elementos adicionales a los bloques en los dos primeros artículos).
- Conservar imágenes, SVG, script, style, input y button como elementos opacos. Formato traducible: strong, em y enlaces de prosa, conservando atributos.

## Pestañas y navegación

BFS tiene dos `.tabbed-set.tabbed-alternate`, con cuatro inputs en total, etiquetas dentro de `.tabbed-labels` y contenido `.tabbed-content`. Los controles de lenguaje deben preservarse completos. Al pulsar la etiqueta de la segunda pestaña, el input quedó seleccionado y tanto el nodo del primer párrafo como la edición de prueba se conservaron. No hubo reemplazo del artículo por ese cambio.

Se pulsó el enlace real de navegación a Binary Exponentiation, después de guardar `window.__t48Sentinel = true`. La URL cambió a `/algebra/binary-exp.html` y la variable desapareció: hubo carga de un documento nuevo. Además, `__config.features` contiene `toc.integrate`, `search.suggest`, `content.code.copy`, sin `navigation.instant`. En esta versión, el content script se ejecutará otra vez al navegar; no se necesita añadir un parche de historial para CP-Algorithms. T51 verificará la integración real de la extensión.

## Límites de la muestra y decisiones pendientes

No hubo tablas, admoniciones ni details en estos tres artículos. Esto no demuestra que no existan en el sitio: T50 debe incluir cobertura explícita con casos adicionales, distinguiendo fixtures reales de ejemplos sintéticos. No se inspeccionó el espejo de GitHub Pages; el primer alcance de T49 será únicamente `cp-algorithms.com`.

El footer real enlaza la licencia CC BY-SA 4.0 del repositorio, distinta de la de USACO. T49 debe pasar la atribución específica de CP-Algorithms al helper existente.

## Integración posterior y estado base

`src/content/docs.ts` está ligado a USACO en la búsqueda de raíz, selectores, protección y espera de `.markdown`. T49 deberá seleccionar un adapter por hostname y parametrizar esos puntos. Mantener la configuración y atribución de USACO. CF y CSES usan el content script de problemas, que no necesita cambios para esta incorporación.

Verificación base: `npm run check` pasó (TypeScript y 11 archivos, 96 pruebas). T48 solo añade documentación, fixtures e inspección; no modifica src ni el manifest. Esto registra el estado actual, sin prometer ausencia de regresiones en cambios futuros. T49/T50 volverán a verificar las traducciones existentes.

## T50 — Hallazgos de preservación (2026-10-03)

Las tres capturas renderizadas se verificaron con extracción/restauración y traducción simulada. Segment Tree contiene tres anclas vacías con `name` (advanced-versions-of-segment-trees, saving-the-entire-subarrays-in-each-vertex y generalization-to-higher-dimensions). No son enlaces de prosa: el adapter ahora protege `a[name]:not([href])` para conservar sus destinos. BFS usa saltos `br`; se protegen como nodos para conservar el salto y el texto del round-trip.

Se añade summary a los bloques traducibles de CP-Algorithms. La cobertura de avisos, details y tablas usa `tests/fixtures/cpalgorithms-casos-sinteticos.html`: estos casos son sintéticos, no nuevas evidencias del sitio real. Se comprobó prosa de ambas pestañas, controles seleccionados, details abierto, listeners y conservación de atributos de enlaces. Las cuatro formas de LaTeX crudo ($, $$, paréntesis y corchetes escapados) y el wrapper .arithmatex sin renderizar quedan protegidos.

La prueba de caché incompleta reveló una vía de pérdida de nodos en el content script de documentos. Ahora se validan marcadores antes de aplicar aciertos; si fallan, el bloque se vuelve a traducir sin modificar el original. La respuesta incompleta de API también conserva el bloque original. Todas las 117 pruebas y TypeScript pasaron; compilación actualizada. T51 sigue pendiente.

## T51 — Navegación comprobada con extensión real (2026-10-03)

Se cargó dist como extensión unpacked en Chromium 153 con perfil temporal. `tools/verify-cpalgorithms-navigation.mjs` permite repetir las diez comprobaciones; el informe está en `tools/cpalgorithms-navigation-report.json`. Se simula únicamente Groq en el worker de ese perfil, con clave ficticia que nunca se envía a la red.

En BFS hay una única UI funcional. Cambiar la pestaña C++/Python o el hash de un encabezado conserva tanto la UI como la traducción; EN/ES conserva la pestaña seleccionada. Navegar por el enlace real a Binary Exponentiation elimina una variable global de prueba y carga una UI nueva en idle: es recarga completa, no SPA. El artículo nuevo se traduce correctamente con el flujo real de mensajes y cola y la respuesta simulada.

Recargar y regresar por historial conserva una única UI y permite recuperar traducciones de la caché persistente sin llamadas adicionales. Informe final: 10 comprobaciones aprobadas, 0 excepciones, 0 errores de consola, 2 solicitudes simuladas en total y ninguna solicitud real a Groq. No se requiere modificar navigation.ts ni la configuración de navegación de CP-Algorithms. La calidad de traducción real del proveedor no forma parte de esta comprobación.
