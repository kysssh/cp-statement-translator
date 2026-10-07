export default async function run(page) {
  const fs = await import("node:fs");
  const out = {};
  const pages = [
    ["usaco-corto.html", "https://usaco.guide/general/usaco-faq"],
    ["usaco-formulas.html", "https://usaco.guide/silver/prefix-sums"],
    ["usaco-tablas.html", "https://usaco.guide/silver/binary-search"],
  ];
  for (const [file, url] of pages) {
    await page.goto(url, { timeout: 60000 }).catch(() => {});
    await page.waitForSelector(".markdown", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const html = await page.evaluate(() => {
      const md = document.querySelector(".markdown");
      if (!md) return null;
      // quitar <details> con contenido no montado: no aportan al test
      return md.outerHTML;
    });
    if (html) {
      fs.writeFileSync(`tests/fixtures/${file}`, html, "utf8");
      out[file] = { url, bytes: html.length };
    } else out[file] = { url, error: "sin .markdown" };
  }
  return out;
}
