/**
 * Request lifecycle: Pending -> In Progress -> Resolved.
 * A resolved request can be re-opened (back to In Progress) if the fix did not hold.
 */
const STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
];

const TRANSITIONS = {
  pending: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["in_progress"],
};

const PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

const statusIds = () => STATUSES.map((s) => s.id);
const priorityIds = () => PRIORITIES.map((p) => p.id);
const isOpen = (status) => status !== "resolved";
const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);
const nextStatuses = (from) => TRANSITIONS[from] || [];

module.exports = { STATUSES, PRIORITIES, statusIds, priorityIds, isOpen, canTransition, nextStatuses };
