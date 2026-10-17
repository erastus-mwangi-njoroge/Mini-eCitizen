import { h, replace } from "../core/dom.js";
import { api } from "../core/api.js";
import { session, setUser, isAdmin } from "../core/session.js";
import { navigate, currentPath } from "../core/router.js";

/** Links shown for the current visitor. */
function linksFor(user) {
  const links = [{ href: "/", label: "Home" }, { href: "/track", label: "Track a request" }];
  if (user?.role === "citizen") links.push({ href: "/requests", label: "My requests" }, { href: "/new", label: "Report a problem" });
  if (user?.role === "admin") return [{ href: "/admin", label: "Dashboard" }, { href: "/track", label: "Track a request" }];
  return links;
}

async function signOut() {
  await api.post("/api/auth/logout");
  setUser(null);
  navigate("/");
}

/** (Re)draw the header; called on sign-in/out and on every page change to highlight the current link. */
export function renderNavbar(el) {
  const { user } = session;
  const path = currentPath();
  const isCurrent = (href) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  const menu = h("nav", { class: "nav", id: "nav-menu", "aria-label": "Main" },
    linksFor(user).map((l) => h("a", { href: "#" + l.href, "aria-current": isCurrent(l.href) ? "page" : null }, l.label)),
    h("span", { class: "nav-spacer" }),
    user
      ? [h("span", { class: "nav-user" }, user.name, isAdmin() ? h("span", { class: "tag" }, "Staff") : null),
         h("button", { class: "btn btn-ghost btn-sm", onclick: signOut }, "Sign out")]
      : [h("a", { href: "#/login?staff=1" }, "Staff login"), h("a", { href: "#/login" }, "Sign in"), h("a", { class: "btn btn-gold btn-sm", href: "#/register" }, "Create account")]);

  const toggle = h("button", {
    class: "nav-toggle", "aria-expanded": "false", "aria-controls": "nav-menu", "aria-label": "Menu",
    onclick: () => toggle.setAttribute("aria-expanded", menu.classList.toggle("open")),
  }, "☰");

  replace(el, h("div", { class: "wrap header-inner" },
    h("a", { class: "brand", href: "#/" }, h("span", { class: "brand-mark", "aria-hidden": "true" }, "M"),
      h("span", null, h("strong", null, "Murang'a County"), h("small", null, "Service Requests"))),
    toggle, menu));
}
