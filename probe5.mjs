export default async function run(page) {
  const spa = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const marks = document.querySelectorAll("[data-probe]").length;
    return { marksAntes: marks, url: location.href };
  });
  // navegación SPA real: pulsar un enlace del índice lateral
  await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) =>
      (x.getAttribute("href") || "").startsWith("/silver/two-pointers"),
    );
    a && a.click();
  });
  await page.waitForTimeout(3500);
  const despues = await page.evaluate(() => {
    const md = document.querySelector(".markdown");
    return {
      url: location.href,
      hayMd: !!md,
      titulo: document.title,
      marksResiduales: document.querySelectorAll("[data-probe]").length,
      len: md ? md.innerText.length : 0,
    };
  });
  // details con prosa en esta página
  const details = await page.evaluate(() => {
    const md = document.querySelector(".markdown");
    if (!md) return null;
    return [...md.querySelectorAll("details")].map((d) => ({
      s: (d.querySelector("summary")?.textContent || "").trim().slice(0, 45),
      abierto: d.open,
      p: d.querySelectorAll("p").length,
      pre: d.querySelectorAll("pre").length,
    }));
  });
  return { spa, despues, details };
}
