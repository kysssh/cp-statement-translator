export default async function run(page) {
  return await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { url: location.href };
    // ¿cuál es el contenedor del contenido en una página de solución?
    const cands = [...document.querySelectorAll("div, article, section")]
      .filter((e) => e.innerText && e.innerText.length > 500)
      .map((e) => ({
        sel:
          e.tagName +
          "." +
          String(e.className).split(/\s+/).slice(0, 3).join("."),
        len: e.innerText.length,
        p: e.querySelectorAll("p").length,
        pre: e.querySelectorAll("pre").length,
      }))
      .sort((a, b) => b.len - a.len)
      .slice(0, 8);
    out.candidatos = cands;
    // pestañas de código (react-tabs?)
    out.pestañas = {
      roleTab: document.querySelectorAll('[role="tab"]').length,
      reactTabs: document.querySelectorAll('.react-tabs, [class*="tabs"]')
        .length,
      botones: [...document.querySelectorAll("button")]
        .map((b) => b.textContent.trim())
        .filter((t) => t && t.length < 12)
        .slice(0, 25),
    };
    // el contenedor grande
    const big = [...document.querySelectorAll("div")]
      .filter((e) => e.innerText && e.innerText.length > 500)
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (big) {
      out.contenedor = {
        sel: big.tagName + "." + String(big.className).slice(0, 80),
        p: big.querySelectorAll("p").length,
        pre: big.querySelectorAll("pre").length,
        details: big.querySelectorAll("details").length,
        katex: big.querySelectorAll(".katex").length,
        codigoInline: [...big.querySelectorAll("code")].filter(
          (c) => !c.closest("pre"),
        ).length,
      };
      // experimento de hidratación dentro de un details de esta página
      const det = [...big.querySelectorAll("details")].find(
        (d) => d.querySelectorAll("p").length > 0,
      );
      if (det) {
        const p = det.querySelector("p");
        p.dataset.probe = "D";
        p.replaceChildren(
          Object.assign(document.createElement("span"), {
            textContent: "TRADUCIDO_DETAILS",
          }),
        );
        await sleep(400);
        det.open = true;
        await sleep(700);
        const trasAbrir = det.querySelector("p").innerText;
        det.open = false;
        await sleep(700);
        const trasCerrar = det.querySelector("p").innerText;
        out.expDetails = {
          trasAbrir: trasAbrir.slice(0, 40),
          trasCerrar: trasCerrar.slice(0, 40),
          sobrevive: trasCerrar.includes("TRADUCIDO"),
        };
      }
      // tabs: pulsar otro lenguaje y ver si la prosa se revierte
      const btns = [...document.querySelectorAll('button,[role="tab"]')].filter(
        (b) => /^(c\+\+|java|python|c)$/i.test(b.textContent.trim()),
      );
      out.nTabs = btns.length;
      const prosa = [...big.querySelectorAll("p")].find(
        (p) => p.innerText.trim().length > 60,
      );
      if (prosa && btns.length > 1) {
        prosa.dataset.probe = "P";
        const antes = prosa.innerText.slice(0, 50);
        btns[1].click();
        await sleep(1500);
        const actual = document.body.innerText.includes(antes.slice(0, 40));
        out.expTabs = {
          antes,
          revirtio: !actual,
          marcado: prosa.dataset.probe === "P",
        };
        btns[0].click();
        await sleep(800);
      }
    }
    return out;
  });
}
