import { h } from "../core/dom.js";
import { route, navigate } from "../core/router.js";
import { session } from "../core/session.js";

const STEPS = [
  ["1", "Report it", "Pick a category, say where it is and describe the problem. A photo helps but is optional."],
  ["2", "We assign it", "County staff review your request and move it to In Progress when a team is on it."],
  ["3", "Track it", "Follow every update with your reference number until it is marked Resolved."],
];

function trackForm() {
  const input = h("input", { name: "ref", placeholder: "e.g. SR-2026-00042", "aria-label": "Reference number", autocomplete: "off" });
  return h("form", { class: "track-form", onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) navigate(`/track/${encodeURIComponent(input.value.trim())}`); } },
    input, h("button", { class: "btn btn-gold", type: "submit" }, "Track"));
}

route("/", {
  title: "Home",
  access: "public",
  render() {
    return h("div", null,
      h("section", { class: "hero" }, h("div", { class: "wrap hero-inner" },
        h("h1", null, "See a problem in your ward? Tell us."),
        h("p", { class: "lead" }, "Report broken streetlights, water problems, uncollected garbage and more to Murang'a County — and follow progress until it is fixed."),
        h("div", { class: "hero-actions" },
          h("a", { class: "btn btn-gold btn-lg", href: "#/new" }, "Report a problem"),
          session.user ? h("a", { class: "btn btn-outline-light btn-lg", href: "#/requests" }, "My requests") : h("a", { class: "btn btn-outline-light btn-lg", href: "#/login" }, "Sign in")))),

      h("section", { class: "wrap section" },
        h("h2", null, "What would you like to report?"),
        h("div", { class: "tiles" }, session.meta.categories.map((c) =>
          h("a", { class: "tile", href: `#/new?category=${c.id}` },
            h("span", { class: "tile-icon", "aria-hidden": "true" }, c.icon), h("strong", null, c.label), h("small", null, c.department))))),

      h("section", { class: "wrap section" },
        h("h2", null, "How it works"),
        h("ol", { class: "steps" }, STEPS.map(([n, title, text]) => h("li", null, h("span", { class: "step-n" }, n), h("div", null, h("strong", null, title), h("p", null, text)))))),

      h("section", { class: "band" }, h("div", { class: "wrap band-inner" },
        h("div", null, h("h2", null, "Already reported something?"), h("p", null, "Enter your reference number to see its status. No sign-in needed.")),
        trackForm())));
  },
});
