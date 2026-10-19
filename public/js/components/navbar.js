import { h, replace } from "../core/dom.js";
import { api } from "../core/api.js";
import { session, setUser, setStaff } from "../core/session.js";
import { navigate, currentPath, inStaffPortal } from "../core/router.js";
import { brandMark } from "./brandMark.js";

const isCurrent = (path, href) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

/** A hamburger toggle + the menu it controls (phones). */
function menuWithToggle(menu) {
  const toggle = h("button", {
    class: "nav-toggle", "aria-expanded": "false", "aria-controls": "nav-menu", "aria-label": "Menu",
    onclick: () => toggle.setAttribute("aria-expanded", menu.classList.toggle("open")),
  }, "☰");
  return [toggle, menu];
}

// ---- Citizen portal header --------------------------------------------------

async function citizenSignOut() {
  await api.post("/api/auth/logout");
  setUser(null);
  navigate("/");
}

function citizenHeader(path) {
  const { user } = session;
  const links = [{ href: "/", label: "Home" }, { href: "/track", label: "Track a request" }];
  if (user) links.push({ href: "/requests", label: "My requests" }, { href: "/new", label: "Report a problem" });

  const menu = h("nav", { class: "nav", id: "nav-menu", "aria-label": "Main" },
    links.map((l) => h("a", { href: "#" + l.href, "aria-current": isCurrent(path, l.href) ? "page" : null }, l.label)),
    h("span", { class: "nav-spacer" }),
    user
      ? [h("span", { class: "nav-user" }, user.name), h("button", { class: "btn btn-ghost btn-sm", onclick: citizenSignOut }, "Sign out")]
      : [h("a", { href: "#/login" }, "Sign in"), h("a", { class: "btn btn-gold btn-sm", href: "#/register" }, "Create account")],
    // Always visible on the citizen site: the way into the separate staff portal.
    session.staff ? null : h("a", { class: "btn btn-staff btn-sm", href: "#/staff/login" }, "Admin login"),
    session.staff ? h("a", { class: "btn btn-staff btn-sm", href: "#/staff" }, "Admin dashboard") : null);

  return [
    h("a", { class: "brand", href: "#/" }, brandMark("M"),
      h("span", null, h("strong", null, "Murang'a County"), h("small", null, "Service Requests"))),
    ...menuWithToggle(menu),
  ];
}

// ---- Staff portal header (different brand, colours and links) -------------------

async function staffSignOut() {
  await api.post("/api/staff/auth/logout");
  setStaff(null);
  navigate("/staff/login");
}

function staffHeader(path) {
  const { staff } = session;
  const menu = h("nav", { class: "nav", id: "nav-menu", "aria-label": "Staff" },
    staff ? h("a", { href: "#/staff", "aria-current": isCurrent(path, "/staff") && !path.includes("login") ? "page" : null }, "Dashboard") : null,
    h("span", { class: "nav-spacer" }),
    h("a", { href: "#/" }, "Citizen site ↗"),
    staff
      ? [h("span", { class: "nav-user" }, staff.name, h("span", { class: "tag", title: staff.department || "Staff" }, staff.department || "Staff")), h("button", { class: "btn btn-ghost btn-sm", onclick: staffSignOut }, "Sign out")]
      : null);

  return [
    h("a", { class: "brand", href: "#/staff" }, brandMark("⛨"),
      h("span", null, h("strong", null, "Staff Portal"), h("small", null, "Murang'a County Government"))),
    ...menuWithToggle(menu),
  ];
}

/** (Re)draw the header; called on sign-in/out and on every page change. */
export function renderNavbar(el) {
  const path = currentPath();
  replace(el, h("div", { class: "wrap header-inner" }, ...(inStaffPortal(path) ? staffHeader(path) : citizenHeader(path))));
}
