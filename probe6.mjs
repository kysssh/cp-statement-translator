export default async function run(page) {
  return await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const md = document.querySelector(".markdown");
    const out = {};
    const setProbe = (p) => {
      p.dataset.probe = "X";
      p.replaceChildren(
        Object.assign(document.createElement("span"), {
          textContent: "TXT_PROBE",
        }),
      );
    };
    const isProbe = (p) => p && p.innerText.includes("TXT_PROBE");

    // 1. párrafo suelto
    const p1 = [...md.querySelectorAll("p")].find(
      (p) => p.innerText.trim().length > 60,
    );
    setProbe(p1);
    await sleep(2000);
    out.parrafoSuelto = {
      sobrevive: isProbe(p1),
      mismoNodo: !!md.querySelector("p[data-probe]"),
    };

    // 2. párrafo dentro de un details de contenido
    const det = md.querySelector("details");
    let details = null;
    if (det) {
      const resumen = det.querySelector("summary");
      const objetivos = [...det.querySelectorAll("*")].filter(
        (e) => e.children.length === 0 && e.textContent.trim().length > 25,
      );
      if (objetivos.length) {
        const el = objetivos[0];
        el.dataset.probe = "D";
        el.textContent = "TXT_DETAILS_PROBE";
        await sleep(500);
        const antes = el.textContent;
        // abrir el desplegable
        if (resumen) {
          resumen.click();
          await sleep(1200);
        }
        const nodoTrasAbrir = det.querySelector("[data-probe]");
        out.details = {
          summary: resumen?.textContent.trim().slice(0, 40),
          abierto: det.open,
          antes,
          tras: nodoTrasAbrir ? nodoTrasAbrir.textContent : null,
          mismoNodo: nodoTrasAbrir === el,
          sobrevive: nodoTrasAbrir
            ? nodoTrasAbrir.textContent.includes("PROBE")
            : false,
        };
        if (resumen) {
          resumen.click();
          await sleep(1000);
        }
        out.details.trasCerrar =
          det.querySelector("[data-probe]")?.textContent || null;
      }
    }

    // 3. texto dentro de un <summary> (Show Tags) — ¿se re-renderiza?
    const sum = md.querySelector("details summary");
    if (sum) {
      sum.dataset.probe = "S";
      const orig = sum.innerHTML;
      sum.textContent = "TAGS PROBE";
      sum.click();
      await sleep(1200);
      sum.click();
      await sleep(1200);
      out.summary = {
        sobrevive: sum.innerText.includes("PROBE"),
        mismoNodo: !!md.querySelector("summary[data-probe]"),
      };
      if (!out.summary.sobrevive) sum.innerHTML = orig;
    }

    // 4. celda de tabla
    const td = md.querySelector("td");
    if (td) {
      td.dataset.probe = "TD";
      td.textContent = "TD_PROBE";
      await sleep(1500);
      out.td = {
        sobrevive: !!md.querySelector("td[data-probe]"),
        texto: md.querySelector("td[data-probe]")?.textContent,
      };
    }

    // 5. encabezado h2
    const h2 = md.querySelector("h2");
    if (h2) {
      h2.dataset.probe = "H";
      h2.textContent = "H2_PROBE";
      await sleep(1500);
      out.h2 = { sobrevive: !!md.querySelector("h2[data-probe]") };
    }
    return out;
  });
}
