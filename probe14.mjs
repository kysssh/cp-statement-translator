export default async function run(page) {
  const urls = [
    "https://usaco.guide/bronze/get-started",
    "https://usaco.guide/silver/prefix-sums",
    "https://usaco.guide/gold/union-find",
    "https://usaco.guide/plat/range-trees",
    "https://usaco.guide/adv/convolution",
    "https://usaco.guide/general/usaco-faq",
  ];
  const out = {};
  for (const url of urls) {
    await page.goto(url, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2800);
    out[url.replace("https://usaco.guide", "")] = await page.evaluate(() => {
      const md = document.querySelector(".markdown");
      if (document.title.includes("404")) return { 404: true };
      if (!md) return { sinMd: true, title: document.title };
      const q = (s) => md.querySelectorAll(s).length;
      const codeInline = [...md.querySelectorAll("code")].filter(
        (c) => !c.closest("pre"),
      );
      return {
        title: document.title.replace(" · USACO Guide", ""),
        chars: md.innerText.length,
        p: q("p"),
        li: q("li"),
        h2: q("h2"),
        h3: q("h3"),
        h4: q("h4"),
        blockquote: q("blockquote"),
        table: q("table"),
        pre: q("pre"),
        codeInline: codeInline.length,
        clasesCodeInline: [...new Set(codeInline.map((c) => c.className))],
        katex: q(".katex"),
        languageMath: q(".language-math"),
        mathDisplay: q(".math-display"),
        details: q("details"),
        img: q("img"),
        svg: q("svg"),
        a: q("a"),
        aInternos: [...md.querySelectorAll("a")].filter((a) => {
          const h = a.getAttribute("href") || "";
          return h && !h.startsWith("http");
        }).length,
        tabsEnTablas: q('table [role="tab"], table button'),
        // ¿el h2 tiene enlace de ancla dentro?
        h2ConAncla: [...md.querySelectorAll("h2,h3")].filter((h) =>
          h.querySelector("a"),
        ).length,
        ejemploH2: md.querySelector("h2")
          ? md.querySelector("h2").outerHTML.slice(0, 200)
          : null,
        ejemploPre: md.querySelector("pre")
          ? { class: md.querySelector("pre").className.slice(0, 80) }
          : null,
      };
    });
  }
  return out;
}
