import { h } from "../core/dom.js";
import { api } from "../core/api.js";
import { route, navigate } from "../core/router.js";
import { setUser } from "../core/session.js";
import { field, showErrors, busy } from "../components/form.js";

/** Shared by the sign-in and registration pages. */
function authForm({ title, intro, fields, submitLabel, busyLabel, endpoint, footer }) {
  const note = h("div", { class: "notice notice-bad", hidden: true, role: "alert" });
  const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, submitLabel);
  const form = h("form", { novalidate: true }, note, fields.map((f) => f), submit);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.hidden = true;
    showErrors(form);
    const body = Object.fromEntries(new FormData(form));
    try {
      const { user } = await busy(submit, busyLabel, () => api.post(endpoint, body));
      setUser(user);
      const next = new URLSearchParams(location.hash.split("?")[1] || "").get("next");
      navigate(next || (user.role === "admin" ? "/admin" : "/requests"));
    } catch (err) {
      showErrors(form, err.fields);
      if (!Object.keys(err.fields).length) { note.textContent = err.message; note.hidden = false; }
    }
  });

  return h("div", { class: "wrap narrow" }, h("div", { class: "card" }, h("h1", null, title), h("p", { class: "muted" }, intro), form, h("p", { class: "center small" }, footer)));
}

const input = (name, type = "text", extra = {}) => h("input", { name, type, ...extra });

route("/login", {
  title: "Sign in",
  access: "guest",
  render: ({ query }) => authForm({
    title: query.staff ? "Staff sign-in" : "Sign in",
    intro: query.staff
      ? "County staff: sign in with your admin account to open the dashboard. (Default admin: see the README.)"
      : "Welcome back. Sign in to report a problem or follow your requests. County staff are taken to the admin dashboard automatically.",
    fields: [field("Email", input("email", "email", { autocomplete: "email" })), field("Password", input("password", "password", { autocomplete: "current-password" }))],
    submitLabel: "Sign in", busyLabel: "Signing in…", endpoint: "/api/auth/login",
    footer: ["New here? ", h("a", { href: "#/register" }, "Create an account")],
  }),
});

route("/register", {
  title: "Create account",
  access: "guest",
  render: () => authForm({
    title: "Create your account",
    intro: "It takes a minute. We use your phone number only so staff can reach you about your request.",
    fields: [
      field("Full name", input("name", "text", { autocomplete: "name" })),
      field("Email", input("email", "email", { autocomplete: "email" })),
      field("Mobile number", input("phone", "tel", { autocomplete: "tel", placeholder: "0712 345 678" })),
      field("Password", input("password", "password", { autocomplete: "new-password" }), "At least 8 characters."),
    ],
    submitLabel: "Create account", busyLabel: "Creating…", endpoint: "/api/auth/register",
    footer: ["Already registered? ", h("a", { href: "#/login" }, "Sign in")],
  }),
});
