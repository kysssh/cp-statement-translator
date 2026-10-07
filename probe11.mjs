export default async function run(page) {
  await page
    .goto("https://usaco.guide/problems", { timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(3500);
  const links = await page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll("a")]
          .map((a) => a.getAttribute("href"))
          .filter((h) => h && /^\/problems\/usaco-/.test(h)),
      ),
    ].slice(0, 10),
  );
  const out = { links };
  if (links.length) {
    for (const suf of ["", "/solution"]) {
      const url = "https://usaco.guide" + links[0] + suf;
      await page.goto(url, { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
      out[suf || "raiz"] = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        if (document.title.includes("404") || !document.title)
          return { error404: true, title: document.title };
        const md = document.querySelector(".markdown");
        const r = {
          title: document.title,
          hayMd: !!md,
          len: md ? md.innerText.length : 0,
        };
        if (md)
          r.counts = {
            p: md.querySelectorAll("p").length,
            pre: md.querySelectorAll("pre").length,
            details: md.querySelectorAll("details").length,
            katex: md.querySelectorAll(".katex").length,
            code: md.querySelectorAll("code").length,
          };
        r.tabs = [...document.querySelectorAll('a,button,[role="tab"]')]
          .map((e) => e.textContent.trim().slice(0, 22))
          .filter((t) => /^(c\+\+|cpp|java|python|c)$/i.test(t));
        r.detailsSums = [
          ...new Set(
            [...document.querySelectorAll("details > summary")].map((s) =>
              s.textContent.trim().slice(0, 35),
            ),
          ),
        ].slice(0, 10);
        return r;
      });
    }
  }
  return out;
}
