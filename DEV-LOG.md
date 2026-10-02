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
