import { h } from "../core/dom.js";
import { formatShortDate } from "../core/format.js";

/** The legend that goes with the Open / Resolved bars. */
export const legend = () =>
  h("p", { class: "legend small" }, h("span", { class: "dot seg-open" }), " Open  ", h("span", { class: "dot seg-resolved" }), " Resolved");

/**
 * Columns for the last N days: submitted vs resolved. Each day is a button; selecting one prints its numbers below.
 */
export function dailyTrend(days) {
  const max = Math.max(1, ...days.flatMap((d) => [d.submitted, d.resolved]));
  const label = (day) => formatShortDate(day.date + "T12:00:00+03:00");
  const detail = h("p", { class: "trend-detail small", "aria-live": "polite" }, "Select a day to see its numbers.");
  const buttons = days.map((day, i) =>
    h("button", {
      class: "trend-day", type: "button", "aria-pressed": "false",
      title: `${label(day)}: ${day.submitted} submitted, ${day.resolved} resolved`,
      onclick: () => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === buttons[i])));
        detail.replaceChildren(h("b", null, label(day)), ` — ${day.submitted} submitted, ${day.resolved} resolved`);
      },
    },
      h("span", { class: "trend-bars" },
        h("span", { class: "trend-bar seg-open", style: { height: `${(day.submitted / max) * 100}%` } }),
        h("span", { class: "trend-bar seg-resolved", style: { height: `${(day.resolved / max) * 100}%` } })),
      h("span", { class: "trend-x" }, i % 2 === 0 ? label(day) : "")));
  return h("div", null, h("div", { class: "trend", role: "group", "aria-label": "Requests submitted and resolved per day, last 14 days" }, buttons), detail);
}
