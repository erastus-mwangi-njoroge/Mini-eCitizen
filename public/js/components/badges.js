import { h } from "../core/dom.js";
import { statusLabel, priorityLabel } from "../core/session.js";

/** Status pill. The label is always text, so meaning never depends on colour alone. */
export const statusBadge = (status) => h("span", { class: `badge badge-${status}` }, statusLabel(status));

/** Priority is only worth a badge when it is not the default. */
export const priorityBadge = (priority) => (priority === "normal" ? null : h("span", { class: `badge badge-prio-${priority}` }, priorityLabel(priority)));
