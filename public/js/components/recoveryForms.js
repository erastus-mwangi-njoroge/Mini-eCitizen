import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { navigate } from "../core/router.js";
import { toast } from "../core/toast.js";
import { field, showErrors, busy } from "./form.js";

/**
 * The two halves of "forgot password", shared by the citizen and staff portals.
 * Each takes the API endpoint for its portal and returns plain elements the page can wrap however it likes.
 */

/** Ask for a reset email. Shows the same confirmation whether or not the address is registered. */
export function forgotPasswordForm({ endpoint, emailLabel, placeholder, backHref }) {
  const note = h("div", { class: "notice notice-bad", hidden: true, role: "alert" });
  const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Email me a reset link");
  const form = h("form", { novalidate: true }, note,
    field(emailLabel, h("input", { name: "email", type: "email", autocomplete: "email", placeholder })), submit);
  const box = h("div", null, form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.hidden = true;
    showErrors(form);
    const email = new FormData(form).get("email");
    try {
      await busy(submit, "Sending…", () => api.post(endpoint, { email }));
      box.replaceChildren(
        h("div", { class: "notice notice-ok", role: "status" }, `If an account exists for ${email}, we have sent a link to reset the password. It works once and expires in 30 minutes.`),
        h("p", { class: "small muted" }, "Nothing arrived? Check your spam folder, or wait a minute and try again."),
        h("a", { class: "btn btn-ghost btn-block", href: backHref }, "Back to sign in"));
    } catch (err) {
      showErrors(form, err.fields);
      if (!Object.keys(err.fields).length) { note.textContent = err.message; note.hidden = false; }
    }
  });
  return box;
}

/** Choose a new password using the token from the emailed link. */
export function resetPasswordForm({ endpoint, token, loginHref, requestHref, minLength }) {
  if (!token) {
    return h("div", null, h("div", { class: "notice notice-bad", role: "alert" }, "This reset link is incomplete."),
      h("a", { class: "btn btn-primary btn-block", href: requestHref }, "Request a new link"));
  }
  const note = h("div", { class: "notice notice-bad", hidden: true, role: "alert" });
  const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Save new password");
  const form = h("form", { novalidate: true }, note,
    field("New password", h("input", { name: "password", type: "password", autocomplete: "new-password" }), `At least ${minLength} characters.`),
    field("Confirm new password", h("input", { name: "confirm", type: "password", autocomplete: "new-password" })),
    submit);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.hidden = true;
    showErrors(form);
    const { password, confirm } = Object.fromEntries(new FormData(form));
    if (password !== confirm) return showErrors(form, { confirm: "The two passwords do not match." });
    try {
      await busy(submit, "Saving…", () => api.post(endpoint, { token, password }));
      toast("Password changed. Please sign in with your new password.");
      navigate(loginHref);
    } catch (err) {
      showErrors(form, err.fields);
      if (!Object.keys(err.fields).length) {
        note.replaceChildren(err.message, " ", h("a", { href: requestHref }, "Request a new link"));
        note.hidden = false;
      }
    }
  });
  return form;
}
