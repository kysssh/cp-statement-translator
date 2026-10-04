# Verificación manual VJudge — V13

Recarga la extensión desde chrome://extensions y usa la carpeta dist actual. Estas pruebas requieren tu sesión; no compartas cookies ni claves. Las pruebas automáticas usan capturas y un proveedor simulado.

Para cada prueba, indica: tipo de página, resultado y errores de consola de la extensión (si aparecen). No hace falta compartir el enunciado privado.

1. Grupo https://vjudge.net/group/clubespc y contest https://vjudge.net/contest/805156#problem/A: confirma acceso y una sola barra. Activa Solo local en VJudge en Opciones; traduce solo si el motor local está disponible. En Network no debe salir una petición del enunciado a un proveedor externo. Si el modelo falta, registra el aviso.
2. Contest creado por ti antes del inicio: si no hay enunciado visible, no debe aparecer la barra. No cambies la hora ni las reglas para la prueba.
3. Contest virtual ya disponible: abre A, traduce, pasa a B y vuelve a A. B debe esperar un clic; A debe recuperar caché al pulsar Traducir. No se crea ni inicia una participación virtual automáticamente.
4. IA propia de VJudge: solo en un problema público y si decides usar esa función. Observa si cambia de versión/iframe o reemplaza el texto. Al quedar en español, el botón de la extensión debe avisar sin enviar otra traducción.
5. PDF UVA https://vjudge.net/problem/UVA-108: no debe aparecer un botón de traducción de la extensión.
6. Codeforces y CSES: abre un problema de cada sitio, comprueba una barra, traducción y fórmulas intactas.

Las filas de grupo privado, contest propio y virtual siguen pendientes hasta recibir resultados de sesión real. No se marca V14 como cerrada ni se genera una etiqueta por las pruebas con capturas.