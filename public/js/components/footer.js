import { h, replace } from "../core/dom.js";
import { currentPath, inStaffPortal } from "../core/router.js";

export function renderFooter(el) {
  const staff = inStaffPortal(currentPath());
  replace(el, h("div", { class: "wrap footer-inner" },
    h("p", null, "© ", new Date().getFullYear(), " County Government of Murang'a · ", staff ? "Staff Portal — authorised county staff only" : "Public Service Request System"),
    staff
      ? h("p", null, h("a", { href: "#/" }, "← Back to the citizen site"))
      : [h("p", null, h("a", { href: "#/staff/login" }, "County staff portal")),
         h("p", { class: "muted" }, "Emergencies (fire, medical, crime): dial 999 or 112 — this service is for non-emergency issues.")]));
}
