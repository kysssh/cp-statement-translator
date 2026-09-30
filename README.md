# CP Statement Translator

Extensión de Chrome que traduce al español los enunciados de **Codeforces** y **CSES** **sin tocar las fórmulas ni el código**: el LaTeX, los `<pre>` de los ejemplos, las imágenes y los identificadores nunca llegan al traductor, así que no pueden montarse ni deformarse como pasa con el traductor web.

## Instalación

Requiere Chrome (o Brave/Edge) **138 o superior** para el traductor local. Los motores con API funcionan en versiones anteriores.

**Desde el `.zip` (para usuarios)**
1. Descomprime `cp-statement-translator-v1.0.0.zip` en una carpeta.
2. Abre `chrome://extensions` y activa el **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y elige esa carpeta.

**Desde el código (para desarrolladores)**
```bash
npm install
npm run build        # genera dist/
```
Carga `dist/` como se indica arriba. Cada vez que cambies código: `npm run build` y ↻ en `chrome://extensions`.

## Uso

Abre un problema de Codeforces o CSES. Aparece una barra sobre el enunciado:

- **Traducir al español**: traduce el problema. Después puedes alternar **ES | EN** sin perder nada.
- 🌙/☀️ **Modo oscuro** y ⚙ **Ajustes**.
- El icono de la extensión abre un popup para cambiar de motor rápido, ver el estado de las keys, elegir el modo oscuro o vaciar la caché.

## Motores de traducción

| Motor | Coste | Glosario | Notas |
|---|---|---|---|
| **Chrome local** (por defecto) | Gratis | No | Sin cuenta ni red. Descarga un paquete de idioma la primera vez |
| **Groq** | Gratis | Sí | Rápido. Key en console.groq.com |
| **Gemini** | Gratis | Sí | Key en Google AI Studio. Las peticiones gratuitas pueden usarse para entrenar |
| **DeepL** | Gratis hasta 500 K car./mes | No | Muy fiel con las fórmulas. Las keys gratuitas terminan en `:fx` |
| **Claude Haiku** | De pago (~0,01 USD/enunciado) | Sí | Máxima calidad |

En **Ajustes** pegas la key, eliges el modelo y pulsas **Guardar y probar**. Los nombres de modelo cambian con frecuencia: el botón **Cargar modelos** consulta a la API cuáles ofrece tu key.

## Cómo protege las fórmulas

1. Cada bloque del enunciado se recorre como árbol DOM (nunca con regex sobre HTML).
2. Todo lo que no debe traducirse se sustituye por un marcador `⟦n⟧`; el formato (negritas, enlaces) por un par `⟦n⟧…⟦/n⟧`.
3. Se traduce solo el texto con marcadores.
4. Se **valida** que vuelven los mismos marcadores en el mismo orden. Si no, se reintenta ese bloque aislado (enviando solo el texto entre marcadores).
5. Si aun así falla, el bloque **se queda en inglés** (con borde punteado): un enunciado en inglés es útil, uno con la fórmula cambiada de sitio no.
6. Se reconstruye el DOM **moviendo los nodos originales** (no con `innerHTML`), por lo que las fórmulas ya renderizadas no parpadean y no hay XSS posible.

## Privacidad y seguridad

- Fórmulas, ejemplos y código no salen del navegador.
- Las API keys se guardan en `chrome.storage.local` y solo las lee el service worker, nunca el código que corre en la página. Están en texto plano dentro de tu perfil de Chrome: usa keys propias y con límite de gasto.
- Permisos: `storage` y acceso a los dominios de las APIs que usas. El traductor local no usa red.
- Uso personal: la extensión solo lee el DOM y no automatiza envíos ni acciones en los jueces. No redistribuyas enunciados traducidos.

## Desarrollo

```bash
npm run check    # tsc + tests (Vitest + jsdom)
npm run build    # compila a dist/
npm run zip      # build + dist/ → cp-statement-translator-v<versión>.zip
```

```
src/
  core/         lógica pura sin chrome.*: extract/restore, validador, segmentador, pipeline
  adapters/     todo lo específico de cada juez (selectores). Añadir un juez = un archivo
  content/      barra inyectada, modo oscuro, alternar ES/EN, caché
  background/   service worker y proveedores (único que ve las keys)
  options/, popup/, ui/, shared/
tests/          fixtures HTML reales de Codeforces y CSES
```

Para añadir un juez nuevo (AtCoder, etc.): crea `src/adapters/<juez>.ts` con sus selectores, regístralo en `adapters/index.ts` y añade su URL a `matches` en `src/manifest.json`. No debería hacer falta tocar `core/`.

## Limitaciones conocidas

- El traductor local no admite glosario: puede traducir `array` como «matriz». Para eso están los motores con LLM.
- Los enunciados de gym que son PDF no se pueden traducir.
- El modo oscuro de Codeforces es un filtro de inversión; alguna imagen puede verse rara.
- Si Codeforces o CSES cambian su HTML, solo hay que actualizar el adapter correspondiente.
