/**
 * Espera a que MathJax (Codeforces) termine de tipografiar. Con red de seguridad
 * por timeout. Nota: el content script vive en un mundo aislado y no ve el
 * `window.MathJax` de la página, así que en la práctica decide el timeout y la
 * presencia de `.MathJax`; rawMathPattern cubre el resto.
 */
export function whenMathReady(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    const w = window as any;
    const done = () => resolve();
    if (w.MathJax?.Hub?.Queue) w.MathJax.Hub.Queue(done);
    else if (w.MathJax?.startup?.promise) w.MathJax.startup.promise.then(done);
    else if (document.querySelector('.MathJax, .katex, mjx-container') || !document.body.textContent?.includes('$$$')) done();
    setTimeout(done, timeoutMs);
  });
}
