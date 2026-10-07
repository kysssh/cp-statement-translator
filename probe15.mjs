export default async function run(page) {
  await page
    .goto("https://usaco.guide/silver/binary-search", { timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(3000);
  return await page.evaluate(() => {
    const md = document.querySelector(".markdown");
    const h = md.querySelector("h2");
    const h3 = md.querySelector("h3");
    const tablaProblemas = [...md.querySelectorAll("table")].find((t) =>
      [...t.querySelectorAll("th")].some((x) =>
        /Problem Name/.test(x.textContent),
      ),
    );
    return {
      h2: h ? h.outerHTML : null,
      h3: h3 ? h3.outerHTML : null,
      tablaProblemas: tablaProblemas
        ? tablaProblemas.outerHTML.slice(0, 2500)
        : null,
      tablaAncestros: tablaProblemas
        ? (() => {
            let e = tablaProblemas.parentElement,
              o = [];
            while (e && e !== md) {
              o.push(e.tagName + "." + String(e.className).slice(0, 70));
              e = e.parentElement;
            }
            return o;
          })()
        : null,
      tabsEnTabla: tablaProblemas
        ? [...tablaProblemas.querySelectorAll('button,[role="tab"]')].map((b) =>
            b.textContent.trim().slice(0, 15),
          )
        : null,
      tabsHtml: (() => {
        const b = md.querySelector('button,[role="tab"]');
        return b ? b.outerHTML.slice(0, 400) : null;
      })(),
      pre: [...md.querySelectorAll("pre")]
        .slice(0, 3)
        .map((p) => ({
          class: p.className,
          lang: p.getAttribute("data-lang"),
          padre:
            p.parentElement.tagName +
            "." +
            String(p.parentElement.className).slice(0, 60),
        })),
      inlineCode: (() => {
        const c = [...md.querySelectorAll("code")].find(
          (x) => !x.closest("pre"),
        );
        return c ? c.outerHTML : null;
      })(),
      mathDisplay: (() => {
        const m = md.querySelector(".math-display");
        return m ? m.outerHTML.slice(0, 300) : null;
      })(),
    };
  });
}
