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
- Sí hay texto que parece fórmula pero es un `<span>` de KaTeX interno (`span.mord`, `span.texttt`…). Queda dentro de `.language-math`, así que no hay que worryse.

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
