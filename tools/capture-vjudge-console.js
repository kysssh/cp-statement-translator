/**
 * V0: ejecutar en DevTools de una página de VJudge con el enunciado visible.
 * Selecciona primero en Elements el contenedor completo ($0).
 * Copia el resultado de la consola y guárdalo como tools/vjudge-capture-ORIGEN.json.
 * No recoge cookies, almacenamiento, cabeceras de red ni credenciales.
 */
(() => {
  const selected = typeof $0 !== 'undefined' && $0?.nodeType === 1 ? $0 : null;
  const root = selected || document.querySelector('#problem-body');
  const counts = (el) => Object.fromEntries([
    'p', 'div', 'br', 'sub', 'sup', 'pre', 'code', 'img', 'svg',
    '.tex-span', '.MathJax', 'mjx-container', '.katex', 'iframe', 'embed', 'object',
  ].map(selector => [selector, el.querySelectorAll(selector).length]));
  const frames = [...document.querySelectorAll('iframe')].map(frame => {
    let accessible = false;
    try { accessible = !!frame.contentDocument; } catch {}
    return { id: frame.id, src: frame.getAttribute('src'), accessible };
  });
  const result = {
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    context: window === window.top ? 'top' : 'iframe',
    root: root ? { tag: root.tagName, id: root.id, class: root.className,
      counts: counts(root), html: root.outerHTML } : null,
    problemName: document.querySelector('#problem-name')?.outerHTML || null,
    frames,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!root) console.info('Selecciona el contenedor del enunciado en Elements y vuelve a ejecutar. Si está en un iframe, cambia el contexto de la consola.');
  return result;
})();
