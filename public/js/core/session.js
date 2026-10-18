import { api } from "./api.js";

/**
 * Who is signed in and the reference data (categories, wards…) the server publishes.
 * The citizen portal and the staff portal have separate sessions: `user` is a citizen, `staff` is a staff member.
 */
export const session = { user: null, staff: null, meta: null };

const listeners = new Set();

export async function loadSession() {
  const [meta, me, staff] = await Promise.all([api.get("/api/meta"), api.get("/api/auth/me"), api.get("/api/staff/auth/me")]);
  session.meta = meta;
  session.user = me.user;
  session.staff = staff.user;
}

export function setUser(user) {
  session.user = user;
  listeners.forEach((fn) => fn());
}

export function setStaff(staff) {
  session.staff = staff;
  listeners.forEach((fn) => fn());
}

export const onUserChange = (fn) => listeners.add(fn);

// Lookups against the published reference data.
export const category = (id) => session.meta.categories.find((c) => c.id === id) || { label: id, icon: "📋" };
export const statusLabel = (id) => session.meta.statuses.find((s) => s.id === id)?.label || id;
export const priorityLabel = (id) => session.meta.priorities.find((p) => p.id === id)?.label || id;
