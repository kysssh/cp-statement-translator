export default async function run(page) {
  const urls = [
    "https://usaco.guide/problems/usaco-1209-field-robot/solution",
    "https://usaco.guide/problems/usaco-1062-lilypad-pond/solution",
    "https://usaco.guide/silver/prefix-sums/problem/1",
  ];
  const res = {};
  for (const url of urls) {
    await page.goto(url, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    res[url] = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      if (document.title.includes("404")) return { error404: true };
      const out = { title: document.title };
      const cand = [...document.querySelectorAll("div, article, section")]
        .filter(
          (e) =>
            e.querySelectorAll("p").length >= 2 && e.innerText.length > 500,
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
          details: c.querySelectorAll("details").length,
        };
      out.pestanas = [...document.querySelectorAll('button,[role="tab"],a')]
        .map((b) => b.textContent.trim())
        .filter((t) => /^(c\+\+|cpp|java|python|c)$/i.test(t));
      out.details = [...document.querySelectorAll("details")]
        .map((d) => ({
          s: (d.querySelector("summary")?.textContent || "")
            .trim()
            .slice(0, 35),
          p: d.querySelectorAll("p").length,
          pre: d.querySelectorAll("pre").length,
        }))
        .slice(0, 8);
      const prose =
        c &&
        [...c.querySelectorAll("p")].find(
          (p) => p.innerText.trim().length > 50,
        );
      const btns = [...document.querySelectorAll('button,[role="tab"]')].filter(
        (b) => /^(java|python|cpp|c\+\+|c)$/i.test(b.textContent.trim()),
      );
      out.nTabs = btns.length;
      if (prose && btns.length > 1) {
        prose.dataset.probe = "P";
        prose.textContent = "PROSA_TRADUCIDA";
        btns[1].click();
        await sleep(2000);
        out.exp = {
          sobreviveCambioPestana:
            document.body.innerText.includes("PROSA_TRADUCIDA"),
          mismoNodo: !!document.querySelector("p[data-probe]"),
        };
        btns[0].click();
        await sleep(1500);
        out.exp.trasVolver =
          document.body.innerText.includes("PROSA_TRADUCIDA");
      }
      return out;
    });
  }
  return res;
}
