export function vjudgeSourceKey(url: string): string | null {
  const source = new URL(url, 'https://vjudge.net');
  if (source.origin !== 'https://vjudge.net') return null;
  const match = /^\/problem\/(?!description\/)([^/]+-[^/]+)\/?$/.exec(source.pathname);
  return match ? 'vj:' + match[1] : null;
}

/** Identidad del problema visible: se comprueba la tabla contra título y pestaña. */
export function vjudgePageKey(doc: Document, loc: Location): string | null {
  const direct = vjudgeSourceKey(loc.href);
  if (direct) return direct;
  if (!/^\/contest\/\d+\/?$/.test(loc.pathname)) return null;
  const letter = /^#problem\/([A-Z]+)$/.exec(loc.hash)?.[1];
  if (!letter) return null;
  const active = doc.querySelector('#problem-nav .active')?.getAttribute('num');
  if (active && active !== letter) return null;
  const row = [...doc.querySelectorAll('#contest-problems tbody tr')].find(row =>
    row.querySelector('.prob-num')?.textContent?.trim() === letter);
  const source = row?.querySelector('.prob-origin a')?.getAttribute('href');
  const titleSource = doc.querySelector('#problem-title a')?.getAttribute('href');
  const rowKey = source ? vjudgeSourceKey(source) : null;
  const titleKey = titleSource ? vjudgeSourceKey(titleSource) : null;
  if (rowKey && titleKey && rowKey !== titleKey) return null;
  return rowKey ?? (active === letter ? titleKey : null);
}

