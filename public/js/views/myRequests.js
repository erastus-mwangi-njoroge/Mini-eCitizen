import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route } from "../core/router.js";
import { category } from "../core/session.js";
import { formatDate } from "../core/format.js";
import { statusBadge } from "../components/badges.js";

const FILTERS = [["all", "All"], ["open", "Open"], ["resolved", "Resolved"]];

function requestCard(r) {
  const c = category(r.category);
  return h("a", { class: "req-card", href: `#/requests/${r.id}` },
    h("span", { class: "req-icon", "aria-hidden": "true" }, c.icon),
    h("span", { class: "req-main" },
      h("strong", null, c.label),
      h("span", { class: "muted small" }, `${r.ward}, ${r.subCounty} · ${r.ref}`),
      h("span", { class: "req-desc" }, r.description)),
    h("span", { class: "req-side" }, statusBadge(r.status), h("span", { class: "muted small" }, formatDate(r.createdAt))));
}

route("/requests", {
  title: "My requests",
  access: "user",
  async render() {
    const { requests } = await api.get("/api/requests");
    const list = h("div", { class: "req-list" });
    const tabs = h("div", { class: "tabs", role: "group", "aria-label": "Filter requests" });

    function show(filter) {
      const rows = requests.filter((r) => filter === "all" || (filter === "open" ? r.status !== "resolved" : r.status === "resolved"));
      list.replaceChildren(...(rows.length ? rows.map(requestCard) : [h("p", { class: "empty" }, filter === "all" ? "You have not reported anything yet." : "Nothing here.")]));
      tabs.replaceChildren(...FILTERS.map(([id, label]) =>
        h("button", { class: "tab", "aria-pressed": String(id === filter), onclick: () => show(id) }, label)));
    }
    show("all");

    return h("div", { class: "wrap" },
      h("div", { class: "page-head" }, h("h1", null, "My requests"), h("a", { class: "btn btn-primary", href: "#/new" }, "Report a problem")),
      requests.length ? tabs : null, list);
  },
});
