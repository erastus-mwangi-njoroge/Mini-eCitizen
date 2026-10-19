import { h } from "../core/dom.js";

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/** One tile of the breakdown: a label, the count and its share of the group. */
const tile = (label, tone, n, total) =>
  h("div", { class: `breakdown-tile tone-${tone}` },
    h("span", { class: "breakdown-label" }, label),
    h("strong", null, n),
    h("span", { class: "breakdown-pct" }, `${pct(n, total)}%`));

/**
 * Horizontal bars, one per group (category, ward, department…). Each bar is a button: clicking it opens a breakdown
 * of that group by status (Open, Pending, In progress, Resolved) with counts and percentages, and a shortcut that
 * filters the requests table to just that group. Counts are always printed, so nothing depends on colour alone.
 *
 * @param {object} options
 * @param {Array<{key,label,icon?,total,open,pending,inProgress,resolved}>} options.rows
 * @param {number} options.overallTotal  all cases, used for "x% of all cases"
 * @param {(row) => void} options.onShow  called by "Show these requests"
 */
export function interactiveBars({ rows, overallTotal, onShow }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const detail = h("div", { class: "breakdown", "aria-live": "polite" }, h("p", { class: "muted small" }, "Select a bar to see its breakdown."));
  let selected = null;

  const buttons = rows.map((row) =>
    h("button", {
      class: "bar-row", type: "button", "aria-pressed": "false",
      title: `${row.label}: ${row.open} open, ${row.resolved} resolved`,
      onclick: () => select(row),
    },
      h("span", { class: "bar-label" }, row.icon ? `${row.icon} ` : "", row.label),
      h("span", { class: "bar-track" },
        h("span", { class: "bar-seg seg-open", style: { width: `${(row.open / max) * 100}%` } }),
        h("span", { class: "bar-seg seg-resolved", style: { width: `${(row.resolved / max) * 100}%` } })),
      h("span", { class: "bar-value" }, h("b", null, row.open), " / ", row.resolved)));

  function select(row) {
    selected = selected === row ? null : row;
    buttons.forEach((b, i) => {
      b.setAttribute("aria-pressed", String(rows[i] === selected));
      b.classList.toggle("is-selected", rows[i] === selected);
    });
    if (!selected) return detail.replaceChildren(h("p", { class: "muted small" }, "Select a bar to see its breakdown."));
    detail.replaceChildren(
      h("div", { class: "breakdown-head" },
        h("h4", null, selected.icon ? `${selected.icon} ` : "", selected.label),
        h("span", { class: "muted small" }, `${selected.total} case${selected.total === 1 ? "" : "s"} · ${pct(selected.total, overallTotal)}% of all cases`)),
      h("div", { class: "breakdown-grid" },
        tile("Open", "open", selected.open, selected.total),
        tile("Pending", "pending", selected.pending, selected.total),
        tile("In progress", "progress", selected.inProgress, selected.total),
        tile("Resolved", "resolved", selected.resolved, selected.total)),
      h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => onShow(selected) }, "Show these requests ↓"));
  }

  return h("div", null, h("div", { class: "bars" }, buttons), detail);
}
