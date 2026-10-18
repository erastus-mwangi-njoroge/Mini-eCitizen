import { session } from "./session.js";
import { replace } from "./dom.js";

/**
 * Hash-based router. A view registers itself with:
 *   route("/requests/:id", { title, access, render(ctx) -> Node | Promise<Node> })
 * access: "public" (anyone) | "guest" (citizen sign-in/register: bounces signed-in citizens)
 *       | "user" (citizens only) | "staffGuest" (staff sign-in/register) | "staff" (staff only).
 * Everything under /staff is the staff portal and is themed differently (see body.staff-portal in the CSS).
 */
const routes = [];

export function route(pattern, view) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => (keys.push(key), "([^/]+)"));
  routes.push({ regex: new RegExp(`^${source}$`), keys, view });
}

export const navigate = (path) => {
  if (location.hash === "#" + path) dispatch(); // same URL: re-render
  else location.hash = path;
};

export const inStaffPortal = (path) => path === "/staff" || path.startsWith("/staff/");

function parseHash() {
  const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(query)) };
}

/** Where a visitor should be sent instead, or null when they may see the view. */
function redirectFor(access) {
  const next = encodeURIComponent(location.hash.slice(1));
  if (access === "guest" && session.user) return "/requests";
  if (access === "user" && !session.user) return `/login?next=${next}`;
  if (access === "staffGuest" && session.staff) return "/staff";
  if (access === "staff" && !session.staff) return `/staff/login?next=${next}`;
  return null;
}

let outlet;
let renderToken = 0; // ignores a slow page that finishes after the user already moved on

async function dispatch() {
  const { path, query } = parseHash();
  const token = ++renderToken;
  const match = routes.map((r) => ({ r, m: r.regex.exec(path) })).find((x) => x.m);
  const view = match ? match.r.view : routes.find((r) => r.view.notFound).view;
  const params = match ? Object.fromEntries(match.r.keys.map((k, i) => [k, decodeURIComponent(match.m[i + 1])])) : {};

  const redirect = redirectFor(view.access);
  if (redirect) return navigate(redirect);
  document.body.classList.toggle("staff-portal", inStaffPortal(path));

  replace(outlet, loadingBlock());
  try {
    const page = await view.render({ params, query });
    if (token !== renderToken) return;
    replace(outlet, page);
  } catch (err) {
    if (token !== renderToken) return;
    if (err.status === 401) return navigate(`${inStaffPortal(path) ? "/staff" : ""}/login?next=${encodeURIComponent(location.hash.slice(1))}`);
    replace(outlet, errorBlock(err.message));
  }
  document.title = `${typeof view.title === "function" ? view.title(params) : view.title} · Murang'a Service Requests`;
  window.scrollTo(0, 0);
  outlet.focus({ preventScroll: true });
  document.dispatchEvent(new CustomEvent("route-changed"));
}

function loadingBlock() {
  const el = document.createElement("div");
  el.className = "wrap loading";
  el.textContent = "Loading…";
  return el;
}

function errorBlock(message) {
  const el = document.createElement("div");
  el.className = "wrap notice notice-bad";
  el.textContent = message || "Something went wrong.";
  return el;
}

export function startRouter(outletEl) {
  outlet = outletEl;
  window.addEventListener("hashchange", dispatch);
  dispatch();
}

export const currentPath = () => parseHash().path;
