import { h } from "../core/dom.js";

/** Where the county logo lives. Replace this file to change the logo everywhere. */
export const LOGO_URL = "/img/muranga-coat-of-arms.png";

/**
 * The county coat of arms for the header. If the image file is missing it falls back to a lettered badge,
 * so the header never shows a broken-image icon.
 */
export function brandMark(fallbackLetter = "M") {
  const logo = h("img", { class: "brand-logo", src: LOGO_URL, alt: "Murang'a County coat of arms", width: 44, height: 44 });
  logo.addEventListener("error", () => logo.replaceWith(h("span", { class: "brand-mark", "aria-hidden": "true" }, fallbackLetter)), { once: true });
  return logo;
}
