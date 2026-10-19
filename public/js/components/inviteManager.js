import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { toast } from "../core/toast.js";
import { field, showErrors, busy } from "./form.js";
import { formatDateTime } from "../core/format.js";
import { session } from "../core/session.js";

/**
 * Staff approval codes, shown to the county administrator only.
 * A new staff member cannot create an account without one of these codes.
 */
export function inviteManager() {
  const result = h("div", { hidden: true, class: "invite-result", role: "status" });
  const listBox = h("div");
  const email = h("input", { name: "email", type: "email", placeholder: `optional: name@${session.meta.staffDomain}` });
  const submit = h("button", { class: "btn btn-primary", type: "submit" }, "Generate approval code");
  const form = h("form", { novalidate: true, class: "invite-form" },
    field("Lock it to a staff email (optional)", email, "If you enter an email, only that person can use the code and it is emailed to them. Leave empty to hand the code over yourself."), submit);

  async function refresh() {
    const { invites } = await api.get("/api/admin/invites");
    listBox.replaceChildren(invites.length
      ? h("div", { class: "table-wrap" }, h("table", { class: "table" },
          h("thead", null, h("tr", null, ["For", "Issued by", "Expires", ""].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", null, invites.map((i) => h("tr", null,
            h("td", { "data-label": "For" }, i.email || "Anyone with the code"),
            h("td", { "data-label": "Issued by" }, i.createdBy),
            h("td", { "data-label": "Expires" }, formatDateTime(i.expiresAt)),
            h("td", null, h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => revoke(i.id) }, "Revoke")))))))
      : h("p", { class: "muted small" }, "No active codes."));
  }

  async function revoke(id) {
    await api.delete(`/api/admin/invites/${id}`);
    toast("Code revoked.");
    refresh();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showErrors(form);
    try {
      const { invite } = await busy(submit, "Generating…", () => api.post("/api/admin/invites", { email: email.value }));
      const copy = h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(invite.code); toast("Code copied."); } catch { toast("Select the code and copy it manually.", "bad"); } } }, "Copy");
      result.replaceChildren(
        h("p", null, invite.email ? `Emailed to ${invite.email}. ` : "", "Give this code to the new staff member. ", h("b", null, "It is shown only now"), " and works once, for 7 days."),
        h("div", { class: "invite-code" }, h("code", null, invite.code), copy));
      result.hidden = false;
      email.value = "";
      refresh();
    } catch (err) {
      showErrors(form, err.fields);
      if (!Object.keys(err.fields).length) toast(err.message, "bad");
    }
  });

  refresh();
  return h("section", { "aria-labelledby": "invites-h", class: "card invite-card" },
    h("h2", { id: "invites-h" }, "Staff approval codes"),
    h("p", { class: "muted" }, "New staff must enter a code from you when they create an account. Each code works once."),
    form, result, h("h3", null, "Active codes"), listBox);
}
