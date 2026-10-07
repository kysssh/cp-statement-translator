export default async function run(page) {
  await page
    .goto("https://usaco.guide/problems", { timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(3000);
  const lista = await page.evaluate(() =>
    [...document.querySelectorAll("a")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && h.startsWith("/problems/"))
      .slice(0, 12),
  );
  const out = { lista };
  if (lista.length) {
    await page
      .goto("https://usaco.guide" + lista[0], { timeout: 60000 })
      .catch(() => {});
    await page.waitForTimeout(3000);
    out.problema = await page.evaluate(() => {
      const md = document.querySelector(".markdown");
      return {
        url: location.href,
        title: document.title,
        hayMd: !!md,
        len: md ? md.innerText.length : 0,
        counts: md
          ? {
              p: md.querySelectorAll("p").length,
              pre: md.querySelectorAll("pre").length,
              details: md.querySelectorAll("details").length,
              katex: md.querySelectorAll(".katex").length,
            }
          : null,
        hrefs: [
          ...new Set(
            [...document.querySelectorAll("a")]
              .map((a) => a.getAttribute("href"))
              .filter((h) => h && h.startsWith("/problems/")),
          ),
        ].slice(0, 6),
      };
    });
    // ver la pestaña "solution"
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll('a,button,[role="tab"]')]
        .map((e) => ({
          tag: e.tagName,
          t: e.textContent.trim().slice(0, 20),
          href: e.getAttribute("href"),
        }))
        .filter(
          (x) =>
            /solution|hint|problem|video/i.test(x.t) ||
            (x.href && /solution/.test(x.href)),
        )
        .slice(0, 10),
    );
    out.tabs = tabs;
  }
  return out;
}
