import { h } from "../core/dom.js";
import { formatDateTime } from "../core/format.js";
import { statusLabel, priorityLabel } from "../core/session.js";

/** Describe one history entry in plain words. */
function describe(event) {
  if (event.type === "created") return "Request submitted";
  if (event.type === "status") return `Status changed to ${statusLabel(event.status)}`;
  if (event.type === "priority") return `Priority set to ${priorityLabel(event.priority)}`;
  return "Update from the county";
}

/** Vertical timeline of everything that has happened to a request, newest first. */
export function timeline(history, { showNotes = true } = {}) {
  return h("ol", { class: "timeline" },
    [...history].reverse().map((event) =>
      h("li", { class: `timeline-item timeline-${event.type === "status" || event.type === "created" ? event.status : "other"}` },
        h("div", { class: "timeline-title" }, describe(event)),
        h("div", { class: "muted small" }, formatDateTime(event.at), event.by ? ` · ${event.by}` : ""),
        showNotes && event.note ? h("p", { class: "timeline-note" }, event.note) : null)));
}
