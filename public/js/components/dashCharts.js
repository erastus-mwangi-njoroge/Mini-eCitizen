import { h, append } from "../core/dom.js";
import { formatShortDate } from "../core/format.js";

/**
 * Charts for the staff dashboard. Every chart is built from plain data and calls `onPick(key)` when a slice, bar,
 * column or legend entry is chosen. The dashboard turns that into a filter, which re-draws every chart.
 * Counts are always printed, so nothing depends on colour alone.
 */

export const PALETTE = ["#2f8f5f", "#1d5a8f", "#d99a2b", "#8e5ab5", "#d2573f", "#2aa7a0", "#c2569b", "#6b7f2a", "#4f6bd6", "#a8743a"];
export const STATUS_COLORS = { pending: "#d99a2b", in_progress: "#1d5a8f", resolved: "#2f8f5f" };
export const colorAt = (i) => PALETTE[i % PALETTE.length];

const NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  return append(el, kids);
}

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const press = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
/** Selected items are outlined; when something is selected the rest fade back. */
const state = (selected, anySelected) => (selected ? " is-sel" : anySelected ? " is-dim" : "");

/** Clickable legend: swatch, name, count and share. Shared by the donut and the pie. */
function legendList(items, total, anySelected, onPick) {
  return h("ul", { class: "lg" }, items.map((d) =>
    h("li", null, h("button", { type: "button", class: `lg-item${state(d.selected, anySelected)}`, "aria-pressed": String(Boolean(d.selected)), onclick: () => onPick(d.key) },
      h("span", { class: "lg-dot", style: { backgroundColor: d.color } }),
      h("span", { class: "lg-name" }, d.label),
      h("b", null, d.value), h("span", { class: "muted small" }, ` ${pct(d.value, total)}%`)))));
}

/**
 * Donut (inner > 0) or pie (inner = 0).
 * @param {{key,label,value,color,selected}[]} items
 */
export function ringChart(items, { inner = 0, centre, centreNote, onPick, name }) {
  const total = items.reduce((a, d) => a + d.value, 0);
  const anySelected = items.some((d) => d.selected);
  const C = 80, R = 74;
  const at = (a, r) => [C + r * Math.sin(a), C - r * Math.cos(a)];
  const path = (a0, a1) => {
    const [x0, y0] = at(a0, R), [x1, y1] = at(a1, R), large = a1 - a0 > Math.PI ? 1 : 0;
    if (!inner) return `M${C} ${C}L${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}Z`;
    const [x2, y2] = at(a1, inner), [x3, y3] = at(a0, inner);
    return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${inner} ${inner} 0 ${large} 0 ${x3} ${y3}Z`;
  };
  let angle = 0;
  const slices = total ? items.filter((d) => d.value > 0).map((d) => {
    const sweep = Math.min((d.value / total) * Math.PI * 2, Math.PI * 2 - 0.0001);
    const a0 = angle; angle += sweep;
    const label = `${d.label}: ${d.value} (${pct(d.value, total)}%)`;
    return svg("path", { d: path(a0, a0 + sweep), fill: d.color, class: `slice${state(d.selected, anySelected)}`, role: "button", tabindex: 0, "aria-label": label, "aria-pressed": String(Boolean(d.selected)), onclick: () => onPick(d.key), onkeydown: press(() => onPick(d.key)) }, svg("title", null, label));
  }) : [svg("circle", { cx: C, cy: C, r: R, class: "ring-empty" })];
  const hole = inner ? [svg("text", { x: C, y: C + 2, class: "ring-num", "text-anchor": "middle" }, centre), svg("text", { x: C, y: C + 18, class: "ring-note", "text-anchor": "middle" }, centreNote)] : [];
  return h("div", { class: "ring" },
    svg("svg", { viewBox: "0 0 160 160", class: "ring-svg", role: "group", "aria-label": name }, slices, hole),
    legendList(items, total, anySelected, onPick));
}

/** Horizontal bars: one coloured bar per item, with an icon and the count. */
export function hBars(items, { onPick }) {
  const max = Math.max(1, ...items.map((d) => d.value));
  const anySelected = items.some((d) => d.selected);
  return h("div", { class: "hbars" }, items.map((d) =>
    h("button", { type: "button", class: `hbar${state(d.selected, anySelected)}`, "aria-pressed": String(Boolean(d.selected)), title: `${d.label}: ${d.value} (${d.detail})`, onclick: () => onPick(d.key) },
      h("span", { class: "hbar-label" }, d.icon ? `${d.icon} ` : "", d.label),
      h("span", { class: "hbar-track" }, h("span", { class: "hbar-fill", style: { width: `${(d.value / max) * 100}%`, backgroundColor: d.color } })),
      h("b", { class: "hbar-val" }, d.value))));
}

/** Vertical columns, one per item. */
export function columns(items, { onPick }) {
  const max = Math.max(1, ...items.map((d) => d.value));
  const anySelected = items.some((d) => d.selected);
  return h("div", { class: "cols" }, items.map((d) =>
    h("button", { type: "button", class: `col${state(d.selected, anySelected)}`, "aria-pressed": String(Boolean(d.selected)), title: `${d.label}: ${d.value} (${d.detail})`, onclick: () => onPick(d.key) },
      h("b", { class: "col-val" }, d.value),
      h("span", { class: "col-track" }, h("span", { class: "col-fill", style: { height: `${(d.value / max) * 100}%`, backgroundColor: d.color } })),
      h("span", { class: "col-label" }, d.label))));
}

/** Smooth-ish area + line chart of submitted vs resolved per day. Reflects the filters; hover or focus a dot for numbers. */
export function areaTrend(days) {
  const W = 360, H = 150, L = 24, B = 22, T = 10, R = 8;
  const max = Math.max(2, ...days.flatMap((d) => [d.submitted, d.resolved]));
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, days.length - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const line = (k) => days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join("");
  const area = (k) => `${line(k)}L${x(days.length - 1)} ${H - B}L${x(0)} ${H - B}Z`;
  const label = (d) => formatShortDate(d.date + "T12:00:00+03:00");
  const grid = [0, 0.5, 1].map((f) => svg("g", null,
    svg("line", { x1: L, x2: W - R, y1: y(max * f), y2: y(max * f), class: "grid" }),
    svg("text", { x: L - 4, y: y(max * f) + 3, class: "axis", "text-anchor": "end" }, Math.round(max * f))));
  const dots = days.map((d, i) => svg("g", { class: "dot-hit", tabindex: 0, role: "img", "aria-label": `${label(d)}: ${d.submitted} submitted, ${d.resolved} resolved` },
    svg("title", null, `${label(d)}: ${d.submitted} submitted, ${d.resolved} resolved`),
    svg("circle", { cx: x(i), cy: y(d.submitted), r: 3.2, fill: "#d99a2b" }),
    svg("circle", { cx: x(i), cy: y(d.resolved), r: 3.2, fill: "#2f8f5f" })));
  const ticks = days.map((d, i) => (i % 3 === 0 || i === days.length - 1 ? svg("text", { x: x(i), y: H - 6, class: "axis", "text-anchor": "middle" }, label(d)) : null));
  return h("div", null,
    svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "trend-svg", role: "group", "aria-label": "Requests submitted and resolved per day, last 14 days" },
      grid,
      svg("path", { d: area("submitted"), fill: "#d99a2b", opacity: 0.22 }), svg("path", { d: line("submitted"), class: "tline", stroke: "#d99a2b" }),
      svg("path", { d: area("resolved"), fill: "#2f8f5f", opacity: 0.22 }), svg("path", { d: line("resolved"), class: "tline", stroke: "#2f8f5f" }),
      dots, ticks),
    h("p", { class: "lg-inline small" }, h("span", { class: "lg-dot", style: { backgroundColor: "#d99a2b" } }), " Submitted   ", h("span", { class: "lg-dot", style: { backgroundColor: "#2f8f5f" } }), " Resolved"));
}
