# VJudge — reconocimiento V0

Fecha: 2026-10-04. Base: v1.1.0 (a73b11c). Rama: feat/vjudge.

## Estado y alcance

V0 cerrada como base para implementar V1: capturas de ocho orígenes HTML,
un visor PDF, dos problemas del mismo contest y contexto de iframe válido.
No se considera verificada toda la matriz de páginas de la guía:
grupos privados, contests propios antes del inicio y contests virtuales
quedan pendientes de inspección/prueba real. Tampoco se observó Network al
cambiar A → B → A. Estos límites deben comprobarse durante V2/V13;
si aparecen diferencias, habrá que ampliar el reconocimiento.

V01: rama preparada; baseline de 117 pruebas y build correctos en la primera revisión.
V02: rutas de problema y contest documentadas; variantes anteriores pendientes.
V03: contexto iframe confirmado por captura del usuario.
V04: 11 fixtures HTML recibidos, 10 enunciados HTML y un estado PDF.

No se implementa V1 hasta la confirmación del usuario.

## Hallazgo de arquitectura

tests/fixtures/vj-codeforces-context.json es JSON válido y contiene:
- url: https://vjudge.net/problem/description/321177558442991?3551163336793
- context: iframe
- frames: []

El enunciado capturado vive en un iframe con URL propia en vjudge.net.
frames vacío significa que no hay iframes dentro de ese documento;
no significa que el enunciado esté en la página principal.
Es el mismo dominio que las URLs aportadas, pero no se probó todavía el acceso
desde el documento padre a contentDocument ni su identificador de iframe.

La entrada futura de content scripts debe cubrir /problem/description/*
y permitir ejecución en frames. El botón debe montarse una sola vez dentro del
documento que realmente contiene #description-container, evitando montarlo en
la carcasa del contest. No hay evidencia que justifique match_about_blank ni
match_origin_as_fallback para este iframe con URL propia.

Referencia: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts

## Mapa observado

| Tipo | URL | DOM / carga | Contenedor |
|---|---|---|---|
| Problema suelto | URLs en tests/fixtures/vj-urls.txt | El contexto aportado demuestra un iframe; carga concreta no observada | #description-container observado en cinco orígenes; tres capturas empiezan en dd |
| Documento del enunciado | /problem/description/321177558442991?3551163336793 | Contexto iframe confirmado | Raíz del enunciado en las capturas |
| Contest A | https://vjudge.net/contest/855562#problem/A | Ruta con hash; no se observó la transición en vivo | #description-container > dd |
| Contest B | https://vjudge.net/contest/855562#problem/B | Mismo pathname; cambia el hash | #description-container > dd |
| Grupo privado | Pendiente de muestra | No verificado | No verificado |
| Contest propio antes del inicio | Pendiente de muestra | No verificado | No verificado |
| Contest virtual | Pendiente de muestra | No verificado | No verificado |
| Anuncios/descripción de contest | Fuera del alcance solicitado de traducción de problemas | No verificado | No traducir con el adapter de problemas |

A tiene 13 párrafos, B tiene 12; ambos incluyen encabezados y una tabla de
ejemplos con dos pre. Las URLs ahora pertenecen al mismo contest.
Que cambie únicamente el hash es evidencia de la ruta, no prueba suficiente
de que el iframe se reutilice o de cómo se reemplaza su contenido.

## Fixtures y protección requerida

| Archivo | Evidencia |
|---|---|
| vj-codeforces.html | KaTeX, formato tex-font-style-bf, ejemplos y nota |
| vj-atcoder.html | KaTeX, restricciones, cuatro ejemplos e imagen |
| vj-poj.html | Cero p; texto directo, 14 br, imagen y ejemplos |
| vj-gym.html | KaTeX, imagen con leyenda, listas y ejemplos |
| vj-codechef.html | KaTeX, listas, texto directo y subtareas |
| vj-hackerrank.html | MathJax_SVG, estilos, imágenes y ejemplos |
| vj-kattis.html | style/script propios, KaTeX y ejemplos |
| vj-usaco.html | span.mathjax envuelve prosa/párrafos; KaTeX y texto directo |
| vj-contest-a.html | #description-container, KaTeX, estilos/script, ejemplos y nota |
| vj-contest-b.html | #description-container, KaTeX y ejemplos |
| vj-uva.html | .vjudge-pdf-viewer-container con canvas y textLayer posicionada |

UVA sí tiene texto en el DOM, pero pertenece al visor PDF y depende de
coordenadas sobre canvas. Se excluye de traducción por indicación del usuario,
conservando la captura para el estado especial de V11.

Proteger pre/code, KaTeX, MathJax_SVG, imágenes/SVG, scripts/styles,
controles .copier y br. Proteger sub/sup con casos sintéticos explícitos:
no aparecen en estas capturas. No proteger span.mathjax de USACO como fórmula
porque contiene prosa. Evitar que ejemplos viajen a la API.

POJ prueba que el segmentador actual necesita soporte aditivo de texto directo.
USACO y CodeChef incluyen otros casos de texto directo y estructuras mixtas.
Los ids históricos #problem-body y #problem-name no aparecen en estas capturas;
no se usarán como selectores confirmados.

La URL opaca /problem/description/NUMERO no identifica el juez y problema de origen.
En V1/V2 habrá que resolver esa identidad desde la página padre o metadatos;
no asumir que NUMERO equivale al problemKey de la guía.

## Verificación y herramientas

node tools/analyze-vjudge-fixtures.mjs analiza los HTML sin ejecutar scripts,
valida el JSON de contexto y que A/B pertenecen al mismo contest.
Informe: tools/vjudge-fixtures-report.json con URLs, hashes SHA-256,
raíces, recuentos, imágenes y texto directo.
Los fragmentos se analizan en modo estándar con doctype.

tools/vjudge-dom-report.json registra el intento inicial sin sesión: las
páginas de problema redirigían al login. No sirve de evidencia del enunciado.
tools/inspect-vjudge.mjs reproduce ese diagnóstico con perfil temporal.
tools/capture-vjudge-console.js recoge el contenedor desde DevTools.

Los archivos del usuario se conservaron sin modificación. Sin cambios en src,
manifest o proveedores; sin llamadas de traducción.
