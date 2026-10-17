const { CATEGORIES } = require("../domain/categories");
const { isOpen } = require("../domain/statuses");

const DAY_MS = 86_400_000;
const EAT_OFFSET_MS = 3 * 3_600_000; // Kenya is UTC+3 all year, so "today" is calculated in East Africa Time
const dayKey = (isoOrMs) => new Date(new Date(isoOrMs).getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);

/** Read-only numbers for the admin dashboard, computed from the current requests. */
class AnalyticsService {
  constructor(requests) {
    this.requests = requests;
  }

  summary(now = Date.now()) {
    const all = this.requests.all();
    const count = (status) => all.filter((r) => r.status === status).length;
    const resolved = all.filter((r) => r.resolvedAt);
    const open = all.filter((r) => isOpen(r.status));

    const hours = resolved.map((r) => (Date.parse(r.resolvedAt) - Date.parse(r.createdAt)) / 3_600_000);
    return {
      totals: {
        all: all.length,
        pending: count("pending"),
        inProgress: count("in_progress"),
        resolved: count("resolved"),
        open: open.length,
        overdue: open.filter((r) => now - Date.parse(r.createdAt) > 7 * DAY_MS).length,
      },
      resolutionRate: all.length ? Math.round((count("resolved") / all.length) * 100) : 0,
      avgResolutionHours: hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null,
      byCategory: this.#openVsResolved(all, (r) => r.category, CATEGORIES.map((c) => [c.id, c.label])),
      byWard: this.#openVsResolved(all, (r) => r.ward).slice(0, 8),
      daily: this.#lastDays(all, 14, now),
    };
  }

  /** Groups requests by a key and counts how many are open vs resolved, busiest group first. */
  #openVsResolved(all, keyOf, labels = []) {
    const names = new Map(labels);
    const groups = new Map();
    for (const r of all) {
      const key = keyOf(r);
      const g = groups.get(key) || { key, label: names.get(key) || key, open: 0, resolved: 0 };
      g[isOpen(r.status) ? "open" : "resolved"]++;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.open + b.resolved - (a.open + a.resolved));
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
