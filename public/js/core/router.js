import { session } from "./session.js";
import { replace } from "./dom.js";

/**
 * Hash-based router. A view registers itself with:
 *   route("/requests/:id", { title, access: "public" | "guest" | "user" | "admin", render(ctx) -> Node | Promise<Node> })
 * `guest` pages (sign in / register) bounce signed-in users away.
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

const homeFor = (user) => (user?.role === "admin" ? "/admin" : "/");

function parseHash() {
  const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(query)) };
}

/** Where a visitor should be sent instead, or null when they may see the view. */
function redirectFor(access) {
  const { user } = session;
  if (access === "guest" && user) return homeFor(user);
  if ((access === "user" || access === "admin") && !user) return `/login?next=${encodeURIComponent(location.hash.slice(1))}`;
  if (access === "admin" && user.role !== "admin") return "/?staffonly=1";
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

  replace(outlet, loadingBlock());
  try {
    const page = await view.render({ params, query });
    if (token !== renderToken) return;
    replace(outlet, page);
  } catch (err) {
    if (token !== renderToken) return;
    if (err.status === 401) return navigate(`/login?next=${encodeURIComponent(location.hash.slice(1))}`);
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
