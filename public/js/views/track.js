import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { category } from "../core/session.js";
import { formatDate } from "../core/format.js";
import { statusBadge } from "../components/badges.js";
import { timeline } from "../components/timeline.js";

/** Public status page: look a request up by reference number, no sign-in required. */
const trackView = {
  title: "Track a request",
  access: "public",
  async render({ params }) {
    const input = h("input", { name: "ref", value: params.ref || "", placeholder: "e.g. SR-2026-00042", "aria-label": "Reference number", autocomplete: "off" });
    const form = h("form", { class: "track-form", onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) navigate(`/track/${encodeURIComponent(input.value.trim())}`); } },
      input, h("button", { class: "btn btn-primary", type: "submit" }, "Track"));

    let result = null;
    if (params.ref) {
      try {
        const r = await api.get(`/api/track/${encodeURIComponent(params.ref)}`);
        result = h("div", { class: "card" },
          h("div", { class: "page-head" }, h("h2", null, category(r.category).icon, " ", r.categoryLabel), statusBadge(r.status)),
          h("p", { class: "muted" }, `${r.ref} · ${r.ward}, ${r.subCounty} · reported ${formatDate(r.createdAt)}`),
          h("h3", null, "Progress"), timeline(r.history, { showNotes: false }),
          h("p", { class: "small muted" }, "Sign in to see staff notes and photos on your own requests."));
      } catch (err) {
        result = h("div", { class: "notice notice-bad", role: "alert" }, err.message);
      }
    }
    return h("div", { class: "wrap narrow" }, h("h1", null, "Track a request"), h("p", { class: "muted" }, "Enter the reference number you received when you submitted (it looks like SR-2026-00042)."), form, result);
  },
};

route("/track", trackView);
route("/track/:ref", trackView);
