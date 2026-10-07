export default async function run(page) {
  const structure = await page.evaluate(() => {
    const md = document.querySelectorAll(".markdown");
    const pick = (el) => {
      const chain = [];
      let e = el;
      while (e && e !== document.body) {
        chain.push(
          e.tagName +
            (e.className
              ? "." +
                String(e.className).trim().split(/\s+/).slice(0, 4).join(".")
              : ""),
        );
        e = e.parentElement;
      }
      return chain;
    };
    const mdCount = md.length;
    const largest = [...md].sort(
      (a, b) => b.innerText.length - a.innerText.length,
    )[0];
    const n = (s) => (largest ? largest.querySelectorAll(s).length : 0);
    return {
      markdownCount: mdCount,
      cadena: pick(largest),
      innerTextLen: largest ? largest.innerText.length : 0,
      counts: {
        p: n("p"),
        li: n("li"),
        h2: n("h2"),
        h3: n("h3"),
        table: n("table"),
        pre: n("pre"),
        "code inline": [...largest.querySelectorAll("code")].filter(
          (c) => !c.closest("pre"),
        ).length,
        ".katex": n(".katex"),
        details: n("details"),
        "span.language-math": n("span.language-math"),
        a: n("a"),
        'a[href^="http"]': n('a[href^="http"]'),
        "img/svg": n("img, svg"),
        ".language-math": n(".language-math"),
      },
      inlineTags: (() => {
        const tags = new Set();
        largest.querySelectorAll("p *, li *").forEach((e) => {
          const cls =
            typeof e.className === "string" && e.className.trim()
              ? "." + e.className.trim().split(/\s+/).join(".")
              : "";
          tags.add(e.tagName.toLowerCase() + cls);
        });
        return [...tags].filter(
          (t) =>
            !t.includes("katex") &&
            !/^(svg|path|g|math|semantics|mrow|annotation|mtext|mo|mi|mn)\b/.test(
              t,
            ),
        );
      })(),
      tablas: [...largest.querySelectorAll("table")].slice(0, 3).map((t) => ({
        clases: t.className,
        cabeceras: [...t.querySelectorAll("th")].map((x) =>
          x.textContent.trim(),
        ),
        primeraFila: [...t.querySelectorAll("tbody tr")]
          .slice(0, 1)
          .map((tr) =>
            [...tr.children].map((td) => td.textContent.trim().slice(0, 40)),
          ),
      })),
      details: [...largest.querySelectorAll("details")]
        .slice(0, 4)
        .map((d) => ({
          summary: (d.querySelector("summary")?.textContent || "")
            .trim()
            .slice(0, 60),
          abierto: d.open,
          parrafosEnHijo: d.querySelectorAll("p").length,
        })),
      codigoEnPre: [...largest.querySelectorAll("pre")]
        .slice(0, 3)
        .map((p) => ({
          lang: p.className,
          head: p.textContent.slice(0, 60).replace(/\n/g, "\\n"),
        })),
      tabs: [
        ...document.querySelectorAll(
          '[role="tab"], [role="tablist"], .tabs, [class*="tab"]',
        ),
      ]
        .slice(0, 6)
        .map((e) => e.tagName + "." + String(e.className).slice(0, 60)),
    };
  });

  // Experimento de hidratación: párrafo dentro de details y dentro de contenido de pestaña
  const hydration = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const md = [...document.querySelectorAll(".markdown")].sort(
      (a, b) => b.innerText.length - a.innerText.length,
    )[0];
    const marks = [];
    const mark = (el, tag) => {
      if (!el) return;
      el.dataset.probe = tag;
      const r = document.createRange();
      r.selectNodeContents(el);
      const w = window.getSelection();
      w.removeAllRanges();
      w.addRange(r);
      marks.push({ tag, original: el.innerText.slice(0, 40) });
    };
    // 1. párrafo suelto en el markdown
    mark(md.querySelector("p"), "suelto");
    // 2. paragraph dentro de un details cerrado (forzarlo a abierto en el DOM)
    const d = md.querySelector("details");
    let enDetails = null;
    if (d) {
      const p = d.querySelector("p");
      mark(p, "details-cerrado");
      enDetails = { tag: "details-cerrado", texto: p?.innerText.slice(0, 30) };
      d.open = true;
      await sleep(700);
      enDetails.trasAbrir = p?.innerText.slice(0, 30);
      enDetails.aunMarcado = p?.dataset.probe === "details-cerrado";
      d.open = false;
      await sleep(700);
      enDetails.trasCerrar = p?.innerText.slice(0, 30);
      enDetails.sigueMarcado = p?.dataset.probe === "details-cerrado";
    }
    // 3. pestañas de código: ¿el código es la única pestaña o hay prosa?
    await sleep(300);
    // simular cambio de pestaña
    const tabEls = [...document.querySelectorAll("button")].filter((b) =>
      /^(c\+\+|java|python|rust|go)/i.test(b.textContent.trim()),
    );
    let pestañas = null;
    if (tabEls.length) {
      const solto = md.querySelector("p");
      solto.dataset.probe = "p-antes-pestana";
      const antes = solto.innerText.slice(0, 40);
      tabEls[Math.min(1, tabEls.length - 1)].click();
      await sleep(800);
      pestañas = {
        nTabs: tabEls.length,
        antes,
        despues: solto.innerText.slice(0, 40),
        sigueMarcado: solto.dataset.probe === "p-antes-pestana",
        textoActual: solto.innerText.slice(0, 40),
      };
      tabEls[0].click();
      await sleep(500);
    }
    return { enDetails, pestañas, marks };
  });

  // ¿la página es SPA? comprobar si navigation API existe
  const spa = await page.evaluate(() => ({
    navigationAPI: "navigation" in window,
    next: !!document.querySelector("#__NEXT_DATA__"),
    gatsby: !!document.querySelector("#___gatsby"),
  }));
  return { structure, hydration, spa };
}
