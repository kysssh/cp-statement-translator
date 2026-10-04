# CP Statement Translator

Extensión de Chrome que traduce al español enunciados de **Codeforces** y **CSES**, y artículos de **USACO Guide** y **CP-Algorithms**, preservando fórmulas, código y enlaces. Versión publicada **1.1.0**. La rama actual incluye la integración de VJudge en validación; para probarla, compila y carga `dist/`. El ZIP v1.1.0 no incluye VJudge.

## Sitios soportados

| Sitio | Contenido | Motor |
|---|---|---|
| Codeforces | Problemas en HTML, incluidos contest, gym y group | Proveedor configurado |
| CSES | Enunciados de problemset | Proveedor configurado |
| VJudge (en validación) | Enunciados HTML del problema abierto | Proveedor configurado o Solo local |
| USACO Guide | Módulos de documentación | Groq |
| CP-Algorithms | Artículos de cp-algorithms.com | Groq |

El espejo de CP-Algorithms en GitHub Pages no está incluido. Las páginas de inicio o navegación sin artículo no son contenido traducible.

## Instalación y actualización

Para el traductor local de Chrome se requiere una versión compatible con Translator API (Chrome 138 o superior) y que el dispositivo pueda descargar el modelo de idioma. Los proveedores con API no dependen de esa función.

Desde el paquete:

1. Descomprime `cp-statement-translator-v1.1.0.zip` en una carpeta.
2. Abre `chrome://extensions` y activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y elige esa carpeta.

Desde el código:

```bash
npm install
npm run build
```

Carga `dist/` con **Cargar descomprimida**. Después de actualizar el código, ejecuta `npm run build`, recarga la extensión en `chrome://extensions` y recarga las páginas abiertas para cargar el nuevo content script y los dominios del manifest.

## Uso en Codeforces y CSES

Abre un problema. La barra sobre el enunciado permite **Traducir al español**, alternar **ES | EN**, cambiar el tema y abrir **Ajustes**. El proveedor configurado se utiliza para los enunciados; el predeterminado es Chrome local.

El popup permite elegir proveedor, comprobar si tiene una clave configurada y administrar la caché.

## Uso en VJudge (en validación)

Compila la rama actual con `npm run build`, recarga la extensión y abre un problema suelto o la pestaña de un problema dentro de un contest. La barra aparece en la página principal y traduce el enunciado del iframe visible. Pulsa **Traducir al español** y alterna **ES | EN** para recuperar el original.

Al pasar de A a B, la traducción anterior se descarta y B espera otro clic. Al regresar a A, pulsa Traducir para usar la caché; un mismo juez/id comparte caché entre contest y página suelta si el texto coincide. La extensión no traduce todos los problemas del contest ni sus anuncios.

En **Ajustes**, activa **Solo local en VJudge** para usar el motor de Chrome aunque el proveedor general sea remoto. Si el motor local no está disponible, se muestra el error; no se cambia automáticamente a un proveedor externo. Con motores remotos, la prosa del enunciado se envía al proveedor seleccionado. Puedes borrar la caché desde Ajustes o el popup.

Si un bloque pierde sus marcadores de fórmulas o repite el original en ambos intentos, VJudge realiza un respaldo traduciendo solo sus fragmentos de texto; puede consumir una petición adicional por bloque y pierde parte del contexto entre fragmentos. Si tampoco pasa la validación, el bloque permanece en inglés con un aviso.

Los PDF no muestran botón. Las imágenes y ejemplos se conservan y el texto dentro de imágenes no se traduce. Una versión marcada como española o detectada por la heurística muestra un aviso sin solicitar traducción; la heurística puede equivocarse.

Las capturas de Codeforces, AtCoder, POJ, Gym, CodeChef, HackerRank, Kattis y USACO se verifican con la extensión cargada y traducción simulada. Las variantes de grupo privado, contest propio y virtual, y la acción real de la IA de VJudge siguen pendientes de pruebas autenticadas. Pasos y estado en [VERIFICACION-VJUDGE.md](VERIFICACION-VJUDGE.md) y [NOTAS-VJUDGE.md](NOTAS-VJUDGE.md).

## Uso en USACO Guide y CP-Algorithms

1. En **Ajustes**, selecciona **Groq**, configura tu API key y guarda los cambios.
2. Abre un módulo del Guide o un artículo de CP-Algorithms.
3. Elige **Todo** para traducir los bloques seleccionados del documento, o **Al leer** para traducir secciones al entrar en pantalla. Pulsa **Traducir al español**.
4. Puedes cancelar entre lotes y alternar **ES | EN**. Se conservan fórmulas, código y controles de las pestañas.

Las traducciones de documentos usan Groq y el glosario técnico; los otros motores siguen disponibles para CF/CSES. La caché guarda bloques individuales y permite recuperar una traducción sin otra petición si el texto y la versión del glosario coinciden.

En CP-Algorithms, cambiar de artículo recarga la página y muestra de nuevo el botón; pulsa **Traducir** para aplicar la caché o traducir ese artículo. Cambiar la pestaña de código o el enlace de un encabezado conserva la traducción. USACO mantiene su comportamiento de navegación SPA.

Cada artículo traducido muestra una atribución al sitio y su licencia: **CC BY-NC-SA 4.0** para USACO Guide y **CC BY-SA 4.0** para CP-Algorithms.

## Groq: límites y ahorro de cuota

Según los [límites oficiales de Groq](https://console.groq.com/docs/rate-limits), consultados el 3 de octubre de 2026, el plan gratuito de `openai/gpt-oss-120b` y `openai/gpt-oss-20b` publica **30 peticiones/minuto**, **1 000 peticiones/día**, **8 000 tokens/minuto** y **200 000 tokens/día**. Son límites por organización; los valores exactos de tu cuenta y modelo se consultan en la [página de límites](https://console.groq.com/settings/limits).

- Usa **Al leer** si solo necesitas una parte del artículo.
- Conserva la caché: recargar o volver a una página permite reutilizar los bloques.
- Cancela cuando ya tengas la sección que necesitas. Los lotes completados se conservan.
- Evita traducir muchos artículos largos seguidos. Un artículo puede requerir varios lotes.

La cola utiliza las cabeceras de cuota disponibles y hace reintentos limitados ante errores 429. No cuenta localmente todos los tokens del día; agotar la cuota diaria puede requerir esperar al reinicio. El glosario de v1.1 usa versión 2: los bloques guardados con la versión anterior se volverán a traducir.

## Mediciones de documentos

Estimaciones offline con los adapters actuales, presupuesto de 3 000 tokens de bloques por lote, prompt repetido en cada lote y salida estimada un 15 % mayor. Incluyen el prompt, pero no el JSON adicional, razonamiento del modelo ni reintentos. **No son consumo real de API**; las pruebas utilizaron respuestas simuladas y gastaron cero tokens de Groq.

| Fixture real | Bloques | Lotes | Entrada estimada | Salida estimada | Total estimado |
|---|---:|---:|---:|---:|---:|
| USACO corto | 97 | 1 | 3 813 | 3 469 | 7 282 |
| USACO fórmulas | 24 | 1 | 1 489 | 761 | 2 250 |
| USACO tablas | 49 | 1 | 2 001 | 1 360 | 3 361 |
| CP-Algorithms corto | 35 | 1 | 2 004 | 1 355 | 3 359 |
| CP-Algorithms código (Segment Tree) | 215 | 5 | 16 398 | 14 146 | 30 544 |
| CP-Algorithms pestañas (BFS) | 48 | 1 | 2 492 | 1 926 | 4 418 |

Una revisita completamente cubierta por la caché requiere cero peticiones. Para repetir la medición: `node tools/measure-document-tokens.mjs`. Resultados detallados en `tools/document-token-estimates.json`.

## Motores

| Proveedor | Uso |
|---|---|
| Chrome local | Enunciados; sin cuenta ni envío del texto a una API |
| Groq | Enunciados y documentación; requiere clave |
| Gemini | Enunciados; requiere clave |
| DeepL | Enunciados; requiere clave |
| Claude | Enunciados; requiere clave |

En **Ajustes**, configura la clave y el modelo, y pulsa **Guardar y probar**. **Cargar modelos** consulta los modelos disponibles para tu cuenta. Los precios y las cuotas dependen del proveedor y del plan.

## Protección y privacidad

La extensión recorre el DOM y sustituye fórmulas, código e imágenes por marcadores. Traduce la prosa y valida que los marcadores regresen en el mismo orden antes de reconstruir el bloque. Conserva los atributos de enlaces y formato; las respuestas incompletas no se aplican al bloque. En enunciados se intenta una traducción aislada del bloque inválido antes de dejarlo en inglés. La caché de documentos también se valida antes de aplicarse.

Las claves se guardan en `chrome.storage.local` dentro del perfil del navegador. Solo el service worker las lee; el content script no necesita acceder a ellas. Con proveedores remotos se envía la prosa seleccionada y sus marcadores a la API. El traductor local no envía ese texto a un proveedor remoto.

Los permisos incluyen almacenamiento, ejecución en los sitios soportados y acceso a las APIs configuradas. La extensión no envía soluciones ni automatiza acciones de los jueces.

## Desarrollo y verificación

```bash
npm run check    # TypeScript y suite completa de Vitest/jsdom
npm run build    # compila a dist/
npm run zip      # compila y genera el ZIP según la versión de package.json
node tools/measure-document-tokens.mjs
node tools/verify-cpalgorithms-navigation.mjs
node tools/verify-vjudge-navigation.mjs
```

La prueba de navegador requiere Chromium con soporte para extensiones descomprimidas; puedes indicar su ruta con la variable de entorno `CPT_TEST_BROWSER`. Crea un perfil temporal, carga dist y simula Groq en el worker de prueba. No usa claves personales ni consume cuota. En sistemas distintos de Windows, el comando de empaquetado requiere `zip`; en Windows utiliza `tar`.

Validación de la integración VJudge en esta rama: 179 pruebas automatizadas y 23 comprobaciones en Chromium, con capturas, navegación reconstruida y traducción simulada. El informe está en `tools/vjudge-navigation-report.json`; las variantes autenticadas siguen pendientes.

Validación del cierre publicado v1.1.0: 117 pruebas automatizadas, incluidos CF, CSES y USACO, y 10 comprobaciones de navegación en Chromium con la extensión real. Los fixtures principales se capturaron de páginas reales; el fixture de casos especiales de CP-Algorithms está identificado como sintético.

```text
src/
  core/         extracción/restauración, validación, segmentación y pipeline
  adapters/     configuración y selectores por sitio
  content/      barra, traducción de documentos, cola, caché y navegación
  background/   service worker y proveedores
  options/, popup/, ui/, shared/
tests/          pruebas y fixtures de los sitios soportados y VJudge
tools/          inspección, mediciones, prueba de navegador y empaquetado
```

Para añadir un sitio, crea su adapter, regístralo en `src/adapters/index.ts` y añade las rutas al manifest. Un sitio de documentación necesita además `contentType: 'doc'` y la configuración `documentation` para raíz, atribución y navegación.

## Limitaciones comprobadas

- Los PDF de gym no se traducen.
- El traductor local no admite el glosario técnico.
- Un cambio en el HTML de un sitio puede requerir actualizar su adapter.
- Los artículos largos pueden tardar por los límites del proveedor.
- Las pruebas de documentación usaron traducciones simuladas: no evalúan la calidad ni disponibilidad de Groq real.
- Los avisos, desplegables y tablas adicionales de CP-Algorithms se cubren con casos sintéticos; su comportamiento en otras páginas reales puede requerir más inspección.
- El tema oscuro de Codeforces utiliza inversión y puede alterar la apariencia de algunas imágenes.
