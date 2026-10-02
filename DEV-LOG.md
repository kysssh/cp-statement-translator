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
