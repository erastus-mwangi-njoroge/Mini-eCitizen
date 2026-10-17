import { h } from "../core/dom.js";
import { formatShortDate } from "../core/format.js";

/**
 * Horizontal stacked bars: one row per group, split into open and resolved.
 * Numbers are printed beside each bar so the chart can be read without relying on colour.
 */
export function stackedBars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.open + r.resolved));
  return h("div", { class: "bars" },
    rows.map((row) =>
      h("div", { class: "bar-row" },
        h("div", { class: "bar-label" }, row.icon ? `${row.icon} ` : "", row.label),
        h("div", { class: "bar-track", role: "img", "aria-label": `${row.label}: ${row.open} open, ${row.resolved} resolved` },
          h("span", { class: "bar-seg seg-open", style: { width: `${(row.open / max) * 100}%` } }),
          h("span", { class: "bar-seg seg-resolved", style: { width: `${(row.resolved / max) * 100}%` } })),
        h("div", { class: "bar-value" }, h("b", null, row.open), " / ", row.resolved))));
}

/** The legend that goes with stackedBars. */
export const legend = () =>
  h("p", { class: "legend small" }, h("span", { class: "dot seg-open" }), " Open  ", h("span", { class: "dot seg-resolved" }), " Resolved");

/** Columns for the last N days: submitted vs resolved. */
export function dailyTrend(days) {
  const max = Math.max(1, ...days.flatMap((d) => [d.submitted, d.resolved]));
  return h("div", { class: "trend", role: "img", "aria-label": "Requests submitted and resolved per day, last 14 days" },
    days.map((day, i) =>
      h("div", { class: "trend-day", title: `${formatShortDate(day.date + "T12:00:00+03:00")}: ${day.submitted} submitted, ${day.resolved} resolved` },
        h("div", { class: "trend-bars" },
          h("span", { class: "trend-bar seg-open", style: { height: `${(day.submitted / max) * 100}%` } }),
          h("span", { class: "trend-bar seg-resolved", style: { height: `${(day.resolved / max) * 100}%` } })),
        h("span", { class: "trend-x" }, i % 2 === 0 ? formatShortDate(day.date + "T12:00:00+03:00") : ""))));
}
