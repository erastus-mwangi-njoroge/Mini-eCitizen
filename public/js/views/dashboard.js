import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { session, category } from "../core/session.js";
import { formatDate, formatDuration } from "../core/format.js";
import { statusBadge, priorityBadge } from "../components/badges.js";
import { legend, dailyTrend } from "../components/charts.js";
import { interactiveBars } from "../components/interactiveBars.js";
import { inviteManager } from "../components/inviteManager.js";
import { select } from "../components/form.js";

// ---- Analytics ------------------------------------------------------------

/** Big number tile; clicking it filters the table below. */
const statCard = ({ label, value, tone, onclick, note }) =>
  h(onclick ? "button" : "div", { class: `stat stat-${tone}`, type: onclick ? "button" : null, onclick },
    h("span", { class: "stat-label" }, label), h("span", { class: "stat-value" }, value), note ? h("span", { class: "stat-note" }, note) : null);

function analyticsSection(a, applyFilter) {
  const t = a.totals;
  const share = (n) => (t.all ? Math.round((n / t.all) * 100) : 0);
  // Two clickable segments: each lists those requests in the table below.
  const segment = (cls, label, n, status) =>
    h("button", { type: "button", class: `split-seg ${cls}`, style: { width: `${t.all ? (n / t.all) * 100 : 0}%` }, title: `${label}: ${n} (${share(n)}%) — click to list`, "aria-label": `${label}: ${n} cases, ${share(n)} percent. Show them.`, onclick: () => applyFilter({ status }) });
  const split = h("div", { class: "split-bar" }, segment("seg-open", "Open", t.open, "open"), segment("seg-resolved", "Resolved", t.resolved, "resolved"));

  return h("section", { "aria-labelledby": "analytics-h" },
    h("h2", { id: "analytics-h" }, "Overview"),
    h("div", { class: "stats" },
      statCard({ label: "Open cases", value: t.open, tone: "open", note: "Pending + in progress", onclick: () => applyFilter({ status: "open" }) }),
      statCard({ label: "Pending", value: t.pending, tone: "pending", note: "Not yet started", onclick: () => applyFilter({ status: "pending" }) }),
      statCard({ label: "In progress", value: t.inProgress, tone: "progress", note: "Being worked on", onclick: () => applyFilter({ status: "in_progress" }) }),
      statCard({ label: "Resolved", value: t.resolved, tone: "resolved", note: `${a.resolutionRate}% of all cases`, onclick: () => applyFilter({ status: "resolved" }) })),

    h("div", { class: "panels" },
      h("div", { class: "card" }, h("h3", null, "Open vs resolved"), split,
        h("p", { class: "legend small" }, h("span", { class: "dot seg-open" }), ` Open ${t.open} (${share(t.open)}%)   `, h("span", { class: "dot seg-resolved" }), ` Resolved ${t.resolved} (${share(t.resolved)}%)`),
        h("dl", { class: "facts" },
          h("div", null, h("dt", null, "Total cases"), h("dd", null, t.all)),
          h("div", null, h("dt", null, "Average time to resolve"), h("dd", null, formatDuration(a.avgResolutionHours))),
          h("div", null, h("dt", null, "Open for over 7 days"), h("dd", { class: t.overdue ? "text-bad" : null }, t.overdue)))),
      h("div", { class: "card" }, h("h3", null, "Last 14 days"), dailyTrend(a.daily),
        h("p", { class: "legend small" }, h("span", { class: "dot seg-open" }), " Submitted  ", h("span", { class: "dot seg-resolved" }), " Resolved")),
      h("div", { class: "card" }, h("h3", null, "By category"), legend(),
        interactiveBars({ rows: a.byCategory.map((c) => ({ ...c, icon: category(c.key).icon })), overallTotal: t.all, onShow: (row) => applyFilter({ category: row.key }, `Category: ${row.label}`) })),
      h("div", { class: "card" }, h("h3", null, "Busiest wards"), legend(),
        interactiveBars({ rows: a.byWard, overallTotal: t.all, onShow: (row) => applyFilter({ ward: row.key }, `Ward: ${row.label}`) })),
      h("div", { class: "card" }, h("h3", null, "By department"), legend(),
        interactiveBars({ rows: a.byDepartment, overallTotal: t.all, onShow: (row) => applyFilter({ department: row.key }, `Department: ${row.label}`) }))));
}

// ---- Request table --------------------------------------------------------

const STATUS_FILTERS = [["", "All statuses"], ["open", "Open (not resolved)"], ["pending", "Pending"], ["in_progress", "In progress"], ["resolved", "Resolved"]];

function requestsSection() {
  const filters = { q: "", status: "", category: "", ward: "", department: "", priority: "", sort: "newest", page: 1 };
  const chips = h("div", { class: "chips" });
  const chipLabels = {}; // text for filters set from a chart, e.g. ward -> "Ward: Kiru"
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
  const go = (page) => { filters.page = page; renderChips(); load(); };

  /** Chart-driven filters (ward, department) have no dropdown, so they show as removable chips. */
  function renderChips() {
    const active = ["ward", "department"].filter((k) => filters[k]);
    chips.hidden = !active.length;
    chips.replaceChildren(...active.map((k) => h("button", { class: "chip", type: "button", title: "Remove this filter", onclick: () => { filters[k] = ""; go(1); } }, chipLabels[k] || `${k}: ${filters[k]}`, " ✕")));
  }

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
  renderChips();
  const section = h("section", { id: "requests", "aria-labelledby": "requests-h" },
    h("div", { class: "page-head" }, h("h2", { id: "requests-h" }, "Service requests"), exportLink),
    h("div", { class: "filters" }, searchBox, statusSel, categorySel, prioritySel, sortSel),
    chips,
    summary,
    h("div", { class: "table-wrap" }, h("table", { class: "table" },
      h("thead", null, h("tr", null, ["Request", "Category", "Location", "Reported by", "Priority", "Status"].map((t) => h("th", { scope: "col" }, t)))), body)),
    pager);

  /**
   * Called by the stat tiles and the charts. `changes` is a partial filter, e.g. { ward: "Kiru" };
   * `chipLabel` names a chart-driven filter on its chip.
   */
  section.applyFilter = (changes, chipLabel) => {
    Object.assign(filters, changes);
    for (const key of Object.keys(changes)) {
      if (sels[key]) sels[key].value = changes[key];
      if (chipLabel) chipLabels[key] = chipLabel;
    }
    go(1);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
      analyticsSection(analytics, (changes, chipLabel) => table.applyFilter(changes, chipLabel)),
      table,
      session.staff.canInvite ? inviteManager() : null);
  },
});
