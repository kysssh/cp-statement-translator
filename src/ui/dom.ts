type Child = Node | string | null | undefined | false;

/** Constructor de DOM minimalista. Nunca usa innerHTML: el texto entra como TextNode. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k.includes('-') || ['list', 'for', 'role'].includes(k)) e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of kids) if (c != null && c !== false) e.append(c);
  return e;
}
