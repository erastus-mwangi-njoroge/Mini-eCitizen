import { api } from "./api.js";

/** Who is signed in and the reference data (categories, wards…) the server publishes. */
export const session = { user: null, meta: null };

const listeners = new Set();

export async function loadSession() {
  const [meta, me] = await Promise.all([api.get("/api/meta"), api.get("/api/auth/me")]);
  session.meta = meta;
  session.user = me.user;
}

export function setUser(user) {
  session.user = user;
  listeners.forEach((fn) => fn(user));
}

export const onUserChange = (fn) => listeners.add(fn);
export const isAdmin = () => session.user?.role === "admin";

// Lookups against the published reference data.
export const category = (id) => session.meta.categories.find((c) => c.id === id) || { label: id, icon: "📋" };
export const statusLabel = (id) => session.meta.statuses.find((s) => s.id === id)?.label || id;
export const priorityLabel = (id) => session.meta.priorities.find((p) => p.id === id)?.label || id;
