import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { session, setStaff } from "../core/session.js";
import { field, showErrors, busy } from "../components/form.js";
import { forgotPasswordForm, resetPasswordForm } from "../components/recoveryForms.js";

/**
 * Staff portal sign-in and sign-up. Deliberately a different page layout from the citizen screens
 * (split panel, dark navy, no "create account" call-to-action on the public site).
 */
function staffAuthPage({ title, intro, fields, submitLabel, busyLabel, endpoint, footer }) {
  const note = h("div", { class: "notice notice-bad", hidden: true, role: "alert" });
  const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, submitLabel);
  const form = h("form", { novalidate: true }, note, fields, submit);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.hidden = true;
    showErrors(form);
    try {
      const { user } = await busy(submit, busyLabel, () => api.post(endpoint, Object.fromEntries(new FormData(form))));
      setStaff(user);
      const next = new URLSearchParams(location.hash.split("?")[1] || "").get("next");
      navigate(next || "/staff");
    } catch (err) {
      showErrors(form, err.fields);
      if (!Object.keys(err.fields).length) { note.textContent = err.message; note.hidden = false; }
    }
  });

  return staffShell(title, intro, form, footer);
}

/** The split-screen staff layout around any content. */
function staffShell(title, intro, body, footer) {
  return h("div", { class: "staff-auth" },
    h("aside", { class: "staff-auth-side" },
      h("span", { class: "staff-badge", "aria-hidden": "true" }, "⛨"),
      h("h1", null, "County staff portal"),
      h("p", null, "Review service requests, assign work, update progress and watch the numbers."),
      h("ul", null, ["Triage by priority and ward", "Keep citizens informed with notes", "Live open vs resolved analytics"].map((t) => h("li", null, t))),
      h("p", { class: "small" }, "Authorised Murang'a County staff only. Activity is attributed to your account.")),
    h("section", { class: "staff-auth-main" }, h("div", { class: "staff-card" }, h("h2", null, title), h("p", { class: "muted" }, intro), body, h("p", { class: "small center" }, footer))));
}

const input = (name, type = "text", extra = {}) => h("input", { name, type, ...extra });

route("/staff/login", {
  title: "Staff sign-in",
  access: "staffGuest",
  render: () => staffAuthPage({
    title: "Staff sign-in",
    intro: `Use your @${session.meta.staffDomain} email address.`,
    fields: [
      field("Work email", input("email", "email", { autocomplete: "username", placeholder: `name@${session.meta.staffDomain}` })),
      field("Password", input("password", "password", { autocomplete: "current-password" })),
    ],
    submitLabel: "Sign in to staff portal", busyLabel: "Signing in…", endpoint: "/api/staff/auth/login",
    footer: session.meta.staffSignupOpen ? [h("a", { href: "#/staff/forgot-password" }, "Forgot your password?"), h("br"), "New staff member? ", h("a", { href: "#/staff/register" }, "Create a staff account")] : h("a", { href: "#/staff/forgot-password" }, "Forgot your password?"),
  }),
});

route("/staff/register", {
  title: "Create staff account",
  access: "staffGuest",
  render: () => staffAuthPage({
    title: "Create a staff account",
    intro: `Only @${session.meta.staffDomain} email addresses are accepted.`,
    fields: session.meta.staffSignupOpen
      ? [
          field("Full name", input("name", "text", { autocomplete: "name" })),
          field("Work email", input("email", "email", { autocomplete: "username", placeholder: `name@${session.meta.staffDomain}` })),
          field("Staff access code", input("accessCode", "password", { autocomplete: "off" }), "Given to you by the county ICT office."),
          field("Password", input("password", "password", { autocomplete: "new-password" }), "At least 10 characters."),
        ]
      : [h("div", { class: "notice notice-bad" }, "Staff sign-up is closed. Ask the system administrator to create your account.")],
    submitLabel: "Create staff account", busyLabel: "Creating…", endpoint: "/api/staff/auth/register",
    footer: ["Already have an account? ", h("a", { href: "#/staff/login" }, "Staff sign-in")],
  }),
});

route("/staff/forgot-password", {
  title: "Forgot password",
  access: "staffGuest",
  render: () => staffShell("Forgot your password?", `Enter your @${session.meta.staffDomain} email and we will send you a reset link.`,
    forgotPasswordForm({ endpoint: "/api/staff/auth/forgot-password", emailLabel: "Work email", placeholder: `name@${session.meta.staffDomain}`, backHref: "#/staff/login" }),
    h("a", { href: "#/staff/login" }, "← Back to staff sign-in")),
});

route("/staff/reset-password", {
  title: "Choose a new password",
  access: "staffGuest",
  render: ({ query }) => staffShell("Choose a new password", "Pick a strong password you have not used before.",
    resetPasswordForm({ endpoint: "/api/staff/auth/reset-password", token: query.token, loginHref: "/staff/login", requestHref: "#/staff/forgot-password", minLength: 10 }),
    h("a", { href: "#/staff/login" }, "← Back to staff sign-in")),
});
