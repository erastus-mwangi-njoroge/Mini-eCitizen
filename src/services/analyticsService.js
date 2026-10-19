const { CATEGORIES, findCategory } = require("../domain/categories");
const { isOpen } = require("../domain/statuses");

const DAY_MS = 86_400_000;
const EAT_OFFSET_MS = 3 * 3_600_000; // Kenya is UTC+3 all year, so "today" is calculated in East Africa Time
const dayKey = (isoOrMs) => new Date(new Date(isoOrMs).getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
const FILTER_KEYS = ["status", "category", "ward", "department", "priority", "q"];
const DEFAULT_DEPARTMENT = "Public Service & Administration";
const departmentOf = (r) => (findCategory(r.category) || {}).department || DEFAULT_DEPARTMENT;

/**
 * Read-only numbers for the staff dashboard, computed from the requests that match the current filters.
 * The dashboard is "cross-filtered": every chart honours every filter EXCEPT its own dimension, so a chart
 * keeps showing all of its options (with counts that respond to the other selections) and a selection in
 * one chart changes all the others.
 */
class AnalyticsService {
  /**
   * @param {RequestRepository} requests
   * @param {(filters: object) => object[]} [matching]  returns the requests matching a filter set (defaults to all)
   */
  constructor(requests, matching = null) {
    this.requests = requests;
    this.matching = matching || (() => this.requests.all());
  }

  summary(query = {}, now = Date.now()) {
    const filters = {};
    for (const key of FILTER_KEYS) if (query && query[key]) filters[key] = String(query[key]);
    // Rows that match every filter except `omit`.
    const rowsWithout = (omit) => this.matching({ ...filters, ...(omit ? { [omit]: "" } : {}) });

    const matched = rowsWithout(null);
    const byStatusRows = rowsWithout("status");
    const count = (rows, status) => rows.filter((r) => r.status === status).length;
    const resolved = matched.filter((r) => r.resolvedAt);
    const hours = resolved.map((r) => (Date.parse(r.resolvedAt) - Date.parse(r.createdAt)) / 3_600_000);

    return {
      filters,
      matching: matched.length,
      // Tiles and the status chart ignore the status filter so you can switch between statuses.
      totals: {
        all: byStatusRows.length,
        pending: count(byStatusRows, "pending"),
        inProgress: count(byStatusRows, "in_progress"),
        resolved: count(byStatusRows, "resolved"),
        open: byStatusRows.filter((r) => isOpen(r.status)).length,
        overdue: matched.filter((r) => isOpen(r.status) && now - Date.parse(r.createdAt) > 7 * DAY_MS).length,
      },
      resolutionRate: matched.length ? Math.round((count(matched, "resolved") / matched.length) * 100) : 0,
      avgResolutionHours: hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null,
      byCategory: this.#group(rowsWithout("category"), (r) => r.category, CATEGORIES.map((c) => [c.id, c.label]), filters.category),
      byWard: this.#group(rowsWithout("ward"), (r) => r.ward, [], filters.ward, 8),
      byDepartment: this.#group(rowsWithout("department"), departmentOf, [], filters.department),
      daily: this.#lastDays(matched, 14, now),
    };
  }

  /** Groups requests by a key with status counts, busiest first. A selected group always stays in the list, even at zero. */
  #group(rows, keyOf, labels = [], selected = "", limit = Infinity) {
    const names = new Map(labels);
    const groups = new Map();
    const blank = (key) => ({ key, label: names.get(key) || key, total: 0, open: 0, pending: 0, inProgress: 0, resolved: 0 });
    for (const r of rows) {
      const key = keyOf(r);
      const g = groups.get(key) || blank(key);
      g.total++;
      if (r.status === "pending") { g.open++; g.pending++; }
      else if (r.status === "in_progress") { g.open++; g.inProgress++; }
      else g.resolved++;
      groups.set(key, g);
    }
    const sorted = [...groups.values()].sort((a, b) => b.total - a.total);
    const shown = sorted.slice(0, limit);
    if (selected && !shown.some((g) => g.key === selected)) shown.push(groups.get(selected) || blank(selected));
    return shown;
  }

  /** Submitted vs resolved per day for the last n days, oldest first. */
  #lastDays(all, n, now) {
    const days = Array.from({ length: n }, (_, i) => ({ date: dayKey(now - (n - 1 - i) * DAY_MS), submitted: 0, resolved: 0 }));
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const r of all) {
      const created = byDate.get(dayKey(r.createdAt));
      if (created) created.submitted++;
      const done = r.resolvedAt && byDate.get(dayKey(r.resolvedAt));
      if (done) done.resolved++;
    }
    return days;
  }
}

module.exports = { AnalyticsService };
