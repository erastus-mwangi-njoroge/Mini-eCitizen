import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { session, category, statusLabel, priorityLabel } from "../core/session.js";
import { formatDateTime } from "../core/format.js";
import { toast } from "../core/toast.js";
import { statusBadge, priorityBadge } from "../components/badges.js";
import { timeline } from "../components/timeline.js";
import { field, select, showErrors, busy } from "../components/form.js";

/** Admin-only form: move the request forward, set its priority, and leave a note the citizen will see. */
function adminPanel(request) {
  const next = session.meta.transitions[request.status];
  const status = select("status", [{ value: "", label: "Keep as " + statusLabel(request.status) }, ...next.map((s) => ({ value: s, label: statusLabel(s) }))]);
  const priority = select("priority", session.meta.priorities.map((p) => ({ value: p.id, label: p.label })));
  priority.value = request.priority;
  const note = h("textarea", { name: "note", rows: 3, maxLength: 500, placeholder: "e.g. A technician will visit on Tuesday." });
  const save = h("button", { class: "btn btn-primary", type: "submit" }, "Save update");
  const alert = h("div", { class: "notice notice-bad", hidden: true, role: "alert" });

  const form = h("form", { class: "card admin-panel", novalidate: true },
    h("h2", null, "Update this request"), alert,
    h("div", { class: "grid-2" }, field("Move to", status), field("Priority", priority)),
    field("Note for the citizen (optional)", note), save);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alert.hidden = true;
    showErrors(form);
    const body = Object.fromEntries(new FormData(form));
    if (body.priority === request.priority) delete body.priority; // unchanged
    try {
      await busy(save, "Saving…", () => api.patch(`/api/admin/requests/${request.id}`, body));
      toast("Request updated.");
      navigate(`/staff/requests/${request.id}`);
    } catch (err) {
      showErrors(form, err.fields);
      const general = err.fields._ || (Object.keys(err.fields).length ? "" : err.message);
      alert.textContent = general;
      alert.hidden = !general;
    }
  });
  return form;
}

const detail = (label, value) => h("div", { class: "detail" }, h("dt", null, label), h("dd", null, value));

/** Shared page body. Staff get the admin panel, the reporter's contact details and the staff-only endpoints. */
function detailPage(request, { staff }) {
  const c = category(request.category);
  const imageUrl = staff ? `/api/admin/requests/${request.id}/image` : `/api/requests/${request.id}/image`;

  return h("div", { class: "wrap" },
    h("a", { class: "back", href: staff ? "#/staff" : "#/requests" }, "← ", staff ? "Dashboard" : "My requests"),
    h("div", { class: "page-head" },
      h("div", null, h("h1", null, c.icon, " ", c.label), h("p", { class: "muted" }, `Reference ${request.ref}`)),
      h("div", { class: "badges" }, priorityBadge(request.priority), statusBadge(request.status))),
    h("div", { class: "split" },
      h("div", null,
        h("div", { class: "card" },
          h("h2", null, "Details"),
          h("dl", { class: "details" },
            detail("Where", `${request.locationDetail} — ${request.ward}, ${request.subCounty}`),
            detail("Reported", formatDateTime(request.createdAt)),
            detail("Department", c.department),
            request.citizen ? detail("Reported by", `${request.citizen.name} · ${request.citizen.phone} · ${request.citizen.email}`) : null,
            detail("Description", h("span", { class: "pre" }, request.description))),
          request.hasImage ? h("a", { href: imageUrl, target: "_blank", rel: "noopener" }, h("img", { class: "photo", src: imageUrl, alt: "Photo submitted with the request" })) : null),
        staff ? adminPanel(request) : null),
      h("div", { class: "card" }, h("h2", null, "Progress"), timeline(request.history))));
}

route("/requests/:id", {
  title: "Request details",
  access: "user",
  async render({ params }) {
    const { request } = await api.get(`/api/requests/${params.id}`);
    return detailPage(request, { staff: false });
  },
});

route("/staff/requests/:id", {
  title: "Request details",
  access: "staff",
  async render({ params }) {
    const { request } = await api.get(`/api/admin/requests/${params.id}`);
    return detailPage(request, { staff: true });
  },
});
