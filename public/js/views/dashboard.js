import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { session, category } from "../core/session.js";
import { formatDate, formatDuration } from "../core/format.js";
import { statusBadge, priorityBadge } from "../components/badges.js";
import { stackedBars, legend, dailyTrend } from "../components/charts.js";
import { select } from "../components/form.js";

// ---- Analytics ------------------------------------------------------------

/** Big number tile; clicking it filters the table below. */
const statCard = ({ label, value, tone, onclick, note }) =>
  h(onclick ? "button" : "div", { class: `stat stat-${tone}`, type: onclick ? "button" : null, onclick },
    h("span", { class: "stat-label" }, label), h("span", { class: "stat-value" }, value), note ? h("span", { class: "stat-note" }, note) : null);

function analyticsSection(a, applyStatus) {
  const t = a.totals;
  const split = h("div", { class: "split-bar", role: "img", "aria-label": `${t.open} open, ${t.resolved} resolved` },
    h("span", { class: "seg-open", style: { width: `${t.all ? (t.open / t.all) * 100 : 0}%` } }),
    h("span", { class: "seg-resolved", style: { width: `${t.all ? (t.resolved / t.all) * 100 : 0}%` } }));

  return h("section", { "aria-labelledby": "analytics-h" },
    h("h2", { id: "analytics-h" }, "Overview"),
    h("div", { class: "stats" },
      statCard({ label: "Open cases", value: t.open, tone: "open", note: "Pending + in progress", onclick: () => applyStatus("open") }),
      statCard({ label: "Pending", value: t.pending, tone: "pending", note: "Not yet started", onclick: () => applyStatus("pending") }),
      statCard({ label: "In progress", value: t.inProgress, tone: "progress", note: "Being worked on", onclick: () => applyStatus("in_progress") }),
      statCard({ label: "Resolved", value: t.resolved, tone: "resolved", note: `${a.resolutionRate}% of all cases`, onclick: () => applyStatus("resolved") })),

    h("div", { class: "panels" },
      h("div", { class: "card" }, h("h3", null, "Open vs resolved"), split, legend(),
        h("dl", { class: "facts" },
          h("div", null, h("dt", null, "Total cases"), h("dd", null, t.all)),
          h("div", null, h("dt", null, "Average time to resolve"), h("dd", null, formatDuration(a.avgResolutionHours))),
          h("div", null, h("dt", null, "Open for over 7 days"), h("dd", { class: t.overdue ? "text-bad" : null }, t.overdue)))),
      h("div", { class: "card" }, h("h3", null, "Last 14 days"), dailyTrend(a.daily),
        h("p", { class: "legend small" }, h("span", { class: "dot seg-open" }), " Submitted  ", h("span", { class: "dot seg-resolved" }), " Resolved")),
      h("div", { class: "card" }, h("h3", null, "By category"), legend(),
        stackedBars(a.byCategory.map((c) => ({ ...c, icon: category(c.key).icon })))),
      h("div", { class: "card" }, h("h3", null, "Busiest wards"), legend(), stackedBars(a.byWard))));
}

// ---- Request table --------------------------------------------------------

const STATUS_FILTERS = [["", "All statuses"], ["open", "Open (not resolved)"], ["pending", "Pending"], ["in_progress", "In progress"], ["resolved", "Resolved"]];

function requestsSection() {
  const filters = { q: "", status: "", category: "", priority: "", sort: "newest", page: 1 };
  const body = h("tbody");
  const pager = h("div", { class: "pager" });
  const summary = h("p", { class: "muted small", role: "status" });
  const searchBox = h("input", { type: "search", placeholder: "Search reference, name, place…", "aria-label": "Search requests" });
  const statusSel = select("status", STATUS_FILTERS.map(([value, label]) => ({ value, label })));
  const categorySel = select("category", session.meta.categories.map((c) => ({ value: c.id, label: c.label })), "All categories");
  const prioritySel = select("priority", session.meta.priorities.map((p) => ({ value: p.id, label: p.label })), "Any priority");
  const sortSel = select("sort", [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "priority", label: "Highest priority" }]);
  const sels = { status: statusSel, category: categorySel, priority: prioritySel, sort: sortSel };

  const query = () => new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "" && v != null)).toString();

  async function load() {
    const data = await api.get(`/api/admin/requests?${query()}`);
    body.replaceChildren(...(data.items.length ? data.items.map(row) : [h("tr", null, h("td", { colSpan: 6, class: "empty" }, "No requests match these filters."))]));
    summary.textContent = `${data.total} request${data.total === 1 ? "" : "s"}`;
    pager.replaceChildren(
      h("button", { class: "btn btn-ghost btn-sm", disabled: data.page <= 1, onclick: () => go(data.page - 1) }, "← Previous"),
      h("span", { class: "small" }, `Page ${data.page} of ${data.pages}`),
      h("button", { class: "btn btn-ghost btn-sm", disabled: data.page >= data.pages, onclick: () => go(data.page + 1) }, "Next →"));
  }
  const go = (page) => { filters.page = page; load(); };

  function row(r) {
    const c = category(r.category);
    return h("tr", { class: "row-link", onclick: () => navigate(`/staff/requests/${r.id}`) },
      h("td", { "data-label": "Request" }, h("a", { href: `#/staff/requests/${r.id}`, onclick: (e) => e.stopPropagation() }, r.ref), h("div", { class: "muted small" }, formatDate(r.createdAt))),
      h("td", { "data-label": "Category" }, `${c.icon} ${c.label}`),
      h("td", { "data-label": "Location" }, r.ward, h("div", { class: "muted small" }, r.subCounty)),
      h("td", { "data-label": "Reported by" }, r.citizen?.name || "–"),
      h("td", { "data-label": "Priority" }, priorityBadge(r.priority) || h("span", { class: "muted" }, "Normal")),
      h("td", { "data-label": "Status" }, statusBadge(r.status)));
  }

  let timer;
  searchBox.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { filters.q = searchBox.value; go(1); }, 250); });
  for (const [key, el] of Object.entries(sels)) el.addEventListener("change", () => { filters[key] = el.value; go(1); });

  const exportLink = h("a", { class: "btn btn-ghost btn-sm", href: "#", onclick: (e) => { e.currentTarget.href = `/api/admin/export.csv?${query()}`; } }, "⬇ Export CSV");

  load();
  const section = h("section", { id: "requests", "aria-labelledby": "requests-h" },
    h("div", { class: "page-head" }, h("h2", { id: "requests-h" }, "Service requests"), exportLink),
    h("div", { class: "filters" }, searchBox, statusSel, categorySel, prioritySel, sortSel),
    summary,
    h("div", { class: "table-wrap" }, h("table", { class: "table" },
      h("thead", null, h("tr", null, ["Request", "Category", "Location", "Reported by", "Priority", "Status"].map((t) => h("th", { scope: "col" }, t)))), body)),
    pager);

  /** Called by the stat tiles. */
  section.applyStatus = (status) => { filters.status = status; statusSel.value = status; go(1); section.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return section;
}

route("/staff", {
  title: "Staff dashboard",
  access: "staff",
  async render() {
    const analytics = await api.get("/api/admin/analytics");
    const table = requestsSection();
    return h("div", { class: "wrap" },
      h("div", { class: "page-head" }, h("h1", null, "Staff dashboard")),
      analyticsSection(analytics, (status) => table.applyStatus(status)),
      table);
  },
});
