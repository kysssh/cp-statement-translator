export default async function run(page) {
  const res = {};
  for (const url of [
    "https://usaco.guide/bronze/introduction",
    "https://usaco.guide/silver/binary-search",
    "https://usaco.guide/gold/dynamic-programming",
  ]) {
    await page.goto(url, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    res[url] = await page.evaluate(() => {
      const md = document.querySelector(".markdown");
      if (!md) return { error404: document.title };
      return {
        title: document.title,
        len: md.innerText.length,
        counts: {
          p: md.querySelectorAll("p").length,
          h2: md.querySelectorAll("h2").length,
          h3: md.querySelectorAll("h3").length,
          table: md.querySelectorAll("table").length,
          pre: md.querySelectorAll("pre").length,
          katex: md.querySelectorAll(".katex").length,
          details: md.querySelectorAll("details").length,
          li: md.querySelectorAll("li").length,
        },
        detailsSummaries: [
          ...new Set(
            [...md.querySelectorAll("details > summary")].map((s) =>
              s.textContent.trim().slice(0, 40),
            ),
          ),
        ].slice(0, 12),
        detailsConCodigo: [...md.querySelectorAll("details")].filter((d) =>
          d.querySelector("pre"),
        ).length,
        tablasCabeceras: [...md.querySelectorAll("table")]
          .slice(0, 4)
          .map((t) =>
            [...t.querySelectorAll("th")].map((x) =>
              x.textContent.trim().slice(0, 20),
            ),
          ),
        enlacesExternos: md.querySelectorAll('a[href^="http"]').length,
      };
    });
  }
  return res;
}
