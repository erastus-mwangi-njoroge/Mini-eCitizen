import { h } from "./dom.js";

/** Short confirmation message in the corner; announced to screen readers via the aria-live region. */
export function toast(message, kind = "ok") {
  const host = document.getElementById("toasts");
  const el = h("div", { class: `toast toast-${kind}` }, message);
  host.append(el);
  setTimeout(() => el.remove(), 4500);
}
