export default async function run(page) {
  const out = await page.evaluate(() => {
    const root =
      document.querySelector("article") || document.querySelector("main");
    if (!root) return { error: "sin raíz" };
    const n = (s) => root.querySelectorAll(s).length;
    const r = {
      raiz: root.tagName + " | " + root.className,
      counts: {
        pre: n("pre"),
        "code en pre": n("pre code"),
        "code inline": [...root.querySelectorAll("code")].filter(
          (c) => !c.closest("pre"),
        ).length,
        ".katex": n(".katex"),
        "mjx-container": n("mjx-container"),
        table: n("table"),
        details: n("details"),
        "h2-h4": n("h2, h3, h4"),
        p: n("p"),
        li: n("li"),
        "img/svg": n("img, svg"),
      },
      fueraDeRoot: {
        nav: document.querySelectorAll("nav").length,
        header: document.querySelectorAll("header").length,
        aside: document.querySelectorAll("aside").length,
        footer: document.querySelectorAll("footer").length,
      },
      katexParent: (() => {
        const k = root.querySelector(".katex");
        if (!k) return null;
        const p = k.parentElement;
        return {
          padre: p.tagName + "." + p.className,
          html: p.outerHTML.slice(0, 300),
        };
      })(),
      inlineTags: (() => {
        const tags = new Set();
        root.querySelectorAll("p *, li *").forEach((e) => {
          const cls =
            typeof e.className === "string" && e.className.trim()
              ? "." + e.className.trim().split(/\s+/).join(".")
              : "";
          tags.add(e.tagName.toLowerCase() + cls);
        });
        return [...tags].filter(
          (t) => !t.includes("katex") && !/^(svg|path|g)\b/.test(t),
        );
      })(),
    };
    // tablas: muestra la primera con contexto
    const t = root.querySelector("table");
    if (t) {
      const cont = t.closest("div");
      r.tablaEjemplo = {
        clases: t.className,
        th: [...t.querySelectorAll("th")]
          .map((x) => x.textContent.trim())
          .slice(0, 10),
        ancestors: (() => {
          let e = t.parentElement,
            out = [];
          while (e && e !== root.parentElement) {
            out.push(e.tagName + "." + (e.className || ""));
            e = e.parentElement;
          }
          return out.slice(0, 6);
        })(),
      };
    }
    // details: contenido en DOM aunque cerrado?
    const d = root.querySelector("details");
    if (d) {
      r.details = {
        total: n("details"),
        cerrado: !d.open,
        textoHijoVisibleEnDOM: d.querySelectorAll("p").length,
        summary: (d.querySelector("summary")?.textContent || "").slice(0, 80),
      };
    }
    return r;
  });
  return out;
}
