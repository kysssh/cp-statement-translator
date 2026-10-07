export default async function run(page) {
  const res = {};
  for (const url of [
    "https://usaco.guide/silver/binary-search/solution?lang=cpp",
    "https://usaco.guide/silver/binary-search/solution?lang=java",
  ]) {
    await page.goto(url, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    res[url] = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      if (document.title.includes("404")) return { error404: true };
      const out = { title: document.title };
      // localizar el contenedor de contenido: el más pequeño con >800 chars y prose real
      const cand = [...document.querySelectorAll("div, article, section")]
        .filter(
          (e) =>
            e.querySelectorAll("p").length >= 3 && e.innerText.length > 800,
        )
        .sort((a, b) => a.innerText.length - b.innerText.length);
      const c = cand[0];
      if (c)
        out.contenedor = {
          sel: c.tagName + "." + String(c.className).slice(0, 90),
          len: c.innerText.length,
          p: c.querySelectorAll("p").length,
          pre: c.querySelectorAll("pre").length,
          katex: c.querySelectorAll(".katex").length,
        };
      out.pestanasLenguaje = [
        ...document.querySelectorAll('button,[role="tab"],a'),
      ]
        .map((b) => b.textContent.trim())
        .filter((t) =>
          /^(c\+\+|cpp|java|python|rst|go|javascript|c)$/i.test(t),
        );
      // elementos de lista y tablas de problemas
      out.tablas = [...document.querySelectorAll("table")].map((t) => ({
        th: [...t.querySelectorAll("th")].map((x) =>
          x.textContent.trim().slice(0, 15),
        ),
      }));
      // experimento: cambiar de pestaña de lenguaje y ver si la prosa se revierte
      const prose =
        c &&
        [...c.querySelectorAll("p")].find(
          (p) => p.innerText.trim().length > 60,
        );
      if (prose) {
        const orig = prose.innerText;
        prose.dataset.probe = "P";
        prose.textContent = "PROSA_TRADUCIDA";
        const btns = [
          ...document.querySelectorAll('button,[role="tab"],a'),
        ].filter(
          (b) =>
            /^(java|python|cpp)$/i.test(b.textContent.trim()) &&
            !b.hasAttribute("data-probe"),
        );
        if (btns.length) {
          btns[0].click();
          await sleep(2000);
          out.exp = {
            nTabs: btns.length,
            sobreviveEnNuevaPestana:
              document.body.innerText.includes("PROSA_TRADUCIDA"),
            mismoNodo: !!document.querySelector("p[data-probe]"),
          };
          // volver
          const back = [
            ...document.querySelectorAll('button,[role="tab"],a'),
          ].filter((b) => /^(cpp|c\+\+)$/i.test(b.textContent.trim()))[0];
          back && back.click();
          await sleep(1500);
          out.exp.trasVolver =
            document.body.innerText.includes("PROSA_TRADUCIDA");
        } else out.exp = { nTabs: 0, orig: orig.slice(0, 40) };
      }
      return out;
    });
  }
  return res;
}
