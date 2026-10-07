export default async function run(page) {
  await page
    .goto("https://usaco.guide/silver/prefix-sums/solution", { timeout: 60000 })
    .catch((e) => ({ err: String(e) }));
  await page.waitForTimeout(2500);
  const info = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const md = [...document.querySelectorAll(".markdown")].sort(
      (a, b) => b.innerText.length - a.innerText.length,
    )[0];
    const out = { url: location.href, hayMd: !!md };
    if (!md) return out;
    out.counts = {
      details: md.querySelectorAll("details").length,
      pre: md.querySelectorAll("pre").length,
      tabs: md.querySelectorAll('[role="tab"]').length,
      "language-math": md.querySelectorAll(".language-math").length,
    };
    // details con prosa en el DOM
    out.detailsConProsa = [...md.querySelectorAll("details")]
      .map((d) => ({
        s: (d.querySelector("summary")?.textContent || "").trim().slice(0, 50),
        abierto: d.open,
        p: d.querySelectorAll("p").length,
      }))
      .filter((x) => x.p > 0)
      .slice(0, 5);

    // EXPERIMENTO DE HIDRATACIÓN real sobre un details
    const det = [...md.querySelectorAll("details")].find(
      (d) => d.querySelectorAll("p").length > 0,
    );
    if (det) {
      const wasOpen = det.open;
      const p = det.querySelector("p");
      const t0 = p.innerText;
      // simular traducción: sustituir el nodo de texto
      p.dataset.probe = "A";
      const span = document.createElement("span");
      span.textContent = "TEXTO TRADUCIDO PROBE";
      p.replaceChildren(span);
      await sleep(400);
      const enCerrado = det.querySelector("p").innerText;
      det.open = !wasOpen;
      await sleep(600);
      const trasAbrir = det.querySelector("p").innerText;
      det.open = wasOpen;
      await sleep(600);
      const trasCerrar = det.querySelector("p").innerText;
      out.expDetails = {
        original: t0.slice(0, 40),
        enCerrado: enCerrado.slice(0, 40),
        trasAbrir: trasAbrir.slice(0, 40),
        trasCerrar: trasCerrar.slice(0, 40),
        sobrevive: trasCerrar.includes("TRADUCIDO"),
      };
    }

    // EXPERIMENTO: pestaña de código. ¿Cambiar de pestaña revierte la prosa circundante?
    const prosa = [...md.querySelectorAll("p")].find(
      (p) => p.innerText.trim().length > 60,
    );
    if (prosa) {
      prosa.dataset.probe = "P";
      const antes = prosa.innerText.slice(0, 40);
      const buttons = [
        ...document.querySelectorAll('button,[role="tab"]'),
      ].filter((b) =>
        /^(c\+\+|java|python|rst|go|javascript|c)$/i.test(b.textContent.trim()),
      );
      out.nBotonesLenguaje = buttons.length;
      if (buttons.length > 1) {
        buttons[1].click();
        await sleep(1200);
        out.expTabs = {
          antes,
          despues: prosa.innerText.slice(0, 40),
          sigueMarcado: prosa.dataset.probe === "P",
        };
        buttons[0].click();
        await sleep(600);
      }
    }

    // SPA: comprobar si navegar por link interno recarga
    out.spa = {
      navigationAPI: "navigation" in window,
      next: !!document.querySelector("#__NEXT_DATA__"),
    };
    return out;
  });

  // navegación interna: ¿conserva el texto alterado?
  const nav = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const md = [...document.querySelectorAll(".markdown")].sort(
      (a, b) => b.innerText.length - a.innerText.length,
    )[0];
    const p =
      md &&
      [...md.querySelectorAll("p")].find((x) => x.innerText.trim().length > 60);
    if (!p) return { err: "sin párrafo" };
    p.dataset.probe = "ANTES_NAV";
    p.replaceChildren(
      Object.assign(document.createElement("span"), {
        textContent: "SOBREVIVE_NAV",
      }),
    );
    const href = [...document.querySelectorAll("a")]
      .map((a) => a.getAttribute("href"))
      .find((h) => h && /^\/silver\//.test(h));
    return { href, sobreviveAntes: p.innerText.includes("SOBREVIVE") };
  });
  if (nav.href) {
    await page.click(`a[href="${nav.href}"]`).catch(() => {});
    await page.waitForTimeout(3000);
    const despues = await page.evaluate((href) => {
      const md = [...document.querySelectorAll(".markdown")].sort(
        (a, b) => b.innerText.length - a.innerText.length,
      )[0];
      return {
        url: location.href,
        Probe: md ? !!md.querySelector("[data-probe]") : null,
        texto: md ? md.innerText.slice(0, 80) : null,
      };
    }, nav.href);
    return { info, nav, despues };
  }
  return { info, nav };
}
