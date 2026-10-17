/**
 * Tiny element builder so views read like markup and never build HTML from strings
 * (text is always inserted as text, which rules out HTML injection).
 *
 *   h("button", { class: "btn", onclick: save }, "Save")
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "class") el.className = value;
    else if (key === "for") el.htmlFor = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style") Object.entries(value).forEach(([k, v]) => (k.startsWith("--") ? el.style.setProperty(k, v) : (el.style[k] = v)));
    else if (key in el && key !== "list") el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  append(el, children);
  return el;
}

/** Append strings, nodes and (nested) arrays of them; skips null/false. */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Replace everything inside parent. */
export function replace(parent, ...children) {
  parent.replaceChildren();
  return append(parent, children);
}
