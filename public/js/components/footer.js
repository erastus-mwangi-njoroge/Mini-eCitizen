import { h, replace } from "../core/dom.js";

export function renderFooter(el) {
  replace(el, h("div", { class: "wrap footer-inner" },
    h("p", null, "© ", new Date().getFullYear(), " County Government of Murang'a · Public Service Request System"),
    h("p", null, h("a", { href: "#/login?staff=1" }, "Staff sign-in (admin dashboard)")),
    h("p", { class: "muted" }, "Emergencies (fire, medical, crime): dial 999 or 112 — this service is for non-emergency issues.")));
}
