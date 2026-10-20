import { h, append } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { session, category } from "../core/session.js";
import { formatDate, formatDuration } from "../core/format.js";
import { statusBadge, priorityBadge } from "../components/badges.js";
import { ringChart, hBars, columns, areaTrend, colorAt, STATUS_COLORS } from "../components/dashCharts.js";
import { inviteManager } from "../components/inviteManager.js";
import { select } from "../components/form.js";

const STATUS_FILTERS = [["", "All statuses"], ["open", "Open (not resolved)"], ["pending", "Pending"], ["in_progress", "In progress"], ["resolved", "Resolved"]];
const STATUS_LABEL = Object.fromEntries(STATUS_FILTERS);
const FILTER_NAMES = { status: "Status", category: "Category", ward: "Ward", department: "Department", priority: "Priority", q: "Search" };

/**
 * The whole dashboard shares ONE set of filters. Clicking anything (a tile, a slice, a bar, a column, a legend entry,
 * a table dropdown) changes that set, then the charts, the numbers and the table are all re-fetched and re-drawn from it.
 */
function dashboard() {
  const filters = { q: "", status: "", category: "", ward: "", department: "", priority: "", sort: "newest", page: 1 };
  const labelFor = (key, value) => (key === "category" ? category(value).label : key === "status" ? STATUS_LABEL[value] : key === "priority" ? (session.meta.priorities.find((p) => p.id === value) || {}).label : value) || value;
  let ticket = 0; // ignore answers that arrive after a newer click

  const bar = h("div", { class: "dash-filterbar" });
  const facts = h("p", { class: "dash-facts small" });
  const kpis = h("div", { class: "stats" });
  const grid = h("div", { class: "dash-grid" });
  const body = h("tbody");
  const pager = h("div", { class: "pager" });
  const summary = h("p", { class: "muted small", role: "status" });

  // ---- table controls (they edit the same filters) ----
  const searchBox = h("input", { type: "search", placeholder: "Search reference, name, place…", "aria-label": "Search requests" });
  const statusSel = select("status", STATUS_FILTERS.map(([value, label]) => ({ value, label })));
  const categorySel = select("category", session.meta.categories.map((c) => ({ value: c.id, label: c.label })), "All categories");
  const prioritySel = select("priority", session.meta.priorities.map((p) => ({ value: p.id, label: p.label })), "Any priority");
  const sortSel = select("sort", [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "priority", label: "Highest priority" }]);
  const sels = { status: statusSel, category: categorySel, priority: prioritySel, sort: sortSel };
  for (const [key, el] of Object.entries(sels)) el.addEventListener("change", () => set({ [key]: el.value }));
  let timer;
  searchBox.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => set({ q: searchBox.value }), 250); });

  const analyticsQuery = () => new URLSearchParams(["status", "category", "ward", "department", "priority", "q"].filter((k) => filters[k]).map((k) => [k, filters[k]])).toString();
  const tableQuery = () => new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "" && v != null)).toString();

  /** Change filters and redraw everything. Choosing the value that is already selected clears it. */
  function set(changes) { Object.assign(filters, { page: 1 }, changes); refresh(); }
  const toggle = (key) => (value) => set({ [key]: filters[key] === value ? "" : value });
  const clearAll = () => set({ q: "", status: "", category: "", ward: "", department: "", priority: "" });

  async function refresh() {
    const mine = ++ticket;
    const [a, list] = await Promise.all([api.get(`/api/admin/analytics?${analyticsQuery()}`), api.get(`/api/admin/requests?${tableQuery()}`)]);
    if (mine !== ticket) return;
    for (const [key, el] of Object.entries(sels)) el.value = filters[key];
    if (document.activeElement !== searchBox) searchBox.value = filters.q;
    drawFilterBar(a);
    drawKpis(a);
    drawCharts(a);
    drawTable(list);
  }

  // ---- filter bar: what you are looking at, and how to undo it ----
  function drawFilterBar(a) {
    const active = Object.keys(FILTER_NAMES).filter((k) => filters[k]);
    bar.replaceChildren();
    append(bar, [
      h("span", { class: "dash-showing" }, active.length ? h("span", null, h("b", null, a.matching), " matching request", a.matching === 1 ? "" : "s", " — every chart below is filtered") : h("span", null, "Showing all ", h("b", null, a.matching), " requests. Click any chart item to filter the whole dashboard.")),
      active.map((k) => h("button", { class: "chip", type: "button", title: "Remove this filter", onclick: () => set({ [k]: "" }) }, `${FILTER_NAMES[k]}: ${k === "q" ? `“${filters[k]}”` : labelFor(k, filters[k])} ✕`)),
      active.length ? h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: clearAll }, "Clear all") : null]);
    // The numbers that used to be separate tiles, as one brief sentence about the matching requests.
    const t = a.totals;
    const avg = a.avgResolutionHours == null ? "no resolved cases to average yet" : `average time to resolve is ${formatDuration(a.avgResolutionHours)}`;
    facts.textContent = `${a.resolutionRate}% resolved, ${avg}, and ${t.overdue} open case${t.overdue === 1 ? " has" : "s have"} waited over 7 days.`;
    facts.classList.toggle("text-bad", t.overdue > 0);
  }

  // ---- number tiles ----
  const tile = ({ label, value, tone, note, on, selected }) =>
    h(on ? "button" : "div", { class: `stat stat-${tone}${selected ? " is-sel" : ""}`, type: on ? "button" : null, "aria-pressed": on ? String(Boolean(selected)) : null, onclick: on },
      h("span", { class: "stat-label" }, label), h("span", { class: "stat-value" }, value), note ? h("span", { class: "stat-note" }, note) : null);

  function drawKpis(a) {
    const t = a.totals, st = filters.status;
    kpis.replaceChildren(
      tile({ label: "Open cases", value: t.open, tone: "open", note: "Pending + in progress", on: () => toggle("status")("open"), selected: st === "open" }),
      tile({ label: "Pending", value: t.pending, tone: "pending", note: "Not yet started", on: () => toggle("status")("pending"), selected: st === "pending" }),
      tile({ label: "In progress", value: t.inProgress, tone: "progress", note: "Being worked on", on: () => toggle("status")("in_progress"), selected: st === "in_progress" }),
      tile({ label: "Resolved", value: t.resolved, tone: "resolved", note: "Completed", on: () => toggle("status")("resolved"), selected: st === "resolved" }));
  }

  // ---- charts ----
  const card = (title, hint, ...content) => h("div", { class: "card dash-card" }, h("h3", null, title), hint ? h("p", { class: "muted small dash-hint" }, hint) : null, ...content);
  const detail = (g) => `${g.open} open, ${g.resolved} resolved`;

  function drawCharts(a) {
    const t = a.totals, st = filters.status;
    const statusItems = [["pending", "Pending", t.pending], ["in_progress", "In progress", t.inProgress], ["resolved", "Resolved", t.resolved]]
      .map(([key, label, value]) => ({ key, label, value, color: STATUS_COLORS[key], selected: st === key || (st === "open" && key !== "resolved") }));
    const pick = (key, rows, extra = {}) => rows.map((g, i) => ({ key: g.key, label: g.label, value: g.total, detail: detail(g), color: colorAt(i), selected: filters[key] === g.key, ...extra(g) }));

    grid.replaceChildren(
      card("Status", "Click a slice to filter by status", ringChart(statusItems, { inner: 46, centre: t.all, centreNote: "cases", name: "Requests by status", onPick: (k) => toggle("status")(k) })),
      card("By department", "Click a slice to see one department", ringChart(pick("department", a.byDepartment, () => ({})).map((d) => ({ ...d, value: d.value })), { inner: 0, name: "Requests by department", onPick: toggle("department") })),
      card("By category", "Click a bar to filter by category", hBars(pick("category", a.byCategory, (g) => ({ icon: category(g.key).icon })), { onPick: toggle("category") })),
      card("By ward", "All wards, busiest first. Click a bar to filter by ward", hBars(pick("ward", a.byWard, () => ({})), { onPick: toggle("ward"), scroll: true })),
      card("Last 14 days", "Follows whatever is selected above", areaTrend(a.daily)));
    grid.classList.toggle("is-filtered", Boolean(analyticsQuery()));
  }

  // ---- table ----
  function drawTable(data) {
    body.replaceChildren(...(data.items.length ? data.items.map(row) : [h("tr", null, h("td", { colSpan: 6, class: "empty" }, "No requests match these filters."))]));
    summary.textContent = `${data.total} request${data.total === 1 ? "" : "s"}`;
    pager.replaceChildren(
      h("button", { class: "btn btn-ghost btn-sm", disabled: data.page <= 1, onclick: () => { filters.page = data.page - 1; refresh(); } }, "← Previous"),
      h("span", { class: "small" }, `Page ${data.page} of ${data.pages}`),
      h("button", { class: "btn btn-ghost btn-sm", disabled: data.page >= data.pages, onclick: () => { filters.page = data.page + 1; refresh(); } }, "Next →"));
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

  const exportLink = h("a", { class: "btn btn-ghost btn-sm", href: "#", onclick: (e) => { e.currentTarget.href = `/api/admin/export.csv?${tableQuery()}`; } }, "⬇ Export CSV");

  refresh();
  return h("div", null,
    h("section", { "aria-labelledby": "analytics-h" }, h("h2", { id: "analytics-h" }, "Overview"), bar, facts, kpis, grid),
    h("section", { id: "requests", "aria-labelledby": "requests-h" },
      h("div", { class: "page-head" }, h("h2", { id: "requests-h" }, "Service requests"), exportLink),
      h("div", { class: "filters" }, searchBox, statusSel, categorySel, prioritySel, sortSel),
      summary,
      h("div", { class: "table-wrap" }, h("table", { class: "table" },
        h("thead", null, h("tr", null, ["Request", "Category", "Location", "Reported by", "Priority", "Status"].map((t) => h("th", { scope: "col" }, t)))), body)),
      pager));
}

route("/staff", {
  title: "Staff dashboard",
  access: "staff",
  async render() {
    return h("div", { class: "wrap" },
      h("div", { class: "page-head" }, h("h1", null, "Staff dashboard")),
      dashboard(),
      session.staff.canInvite ? inviteManager() : null);
  },
});
