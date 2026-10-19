const { Router } = require("../http/router");
const { requireAdmin, requireCitizen } = require("../http/guards");
const { CATEGORIES } = require("../domain/categories");
const { STATUSES, PRIORITIES, nextStatuses } = require("../domain/statuses");
const { SUBCOUNTY_WARDS } = require("../domain/locations");
const { STAFF_DOMAIN } = require("../domain/staffAccess");
const { DEPARTMENTS } = require("../domain/departments");

/**
 * Declares every API endpoint in one place so the whole surface of the app can be read at a glance.
 * Citizen portal: /api/auth/*, /api/requests/*.   Staff portal: /api/staff/auth/*, /api/admin/*.
 */
function buildRouter({ auth, requests, analytics, staffInvites, config }) {
  const router = new Router();

  // ---- Public ------------------------------------------------------------
  router.get("/api/meta", () => ({
    categories: CATEGORIES,
    statuses: STATUSES,
    priorities: PRIORITIES,
    transitions: Object.fromEntries(STATUSES.map((s) => [s.id, nextStatuses(s.id)])),
    locations: SUBCOUNTY_WARDS,
    maxImageMb: config.maxImageBytes / 1048576,
    staffDomain: STAFF_DOMAIN,
    departments: DEPARTMENTS,
  }));

  router.get("/api/track/:ref", (ctx) => {
    ctx.rateLimit("track");
    return requests.track(ctx.params.ref);
  });

  // ---- Citizen portal: accounts -------------------------------------------
  router.post("/api/auth/register", async (ctx) => {
    ctx.rateLimit("auth");
    const user = auth.registerCitizen(await ctx.json());
    ctx.issueSession(user, "citizen");
    return { user };
  });

  router.post("/api/auth/login", async (ctx) => {
    ctx.rateLimit("auth");
    const user = auth.loginCitizen(await ctx.json());
    ctx.issueSession(user, "citizen");
    return { user };
  });

  router.post("/api/auth/forgot-password", async (ctx) => {
    ctx.rateLimit("forgot");
    auth.requestPasswordReset(await ctx.json(), "citizen");
    return { ok: true }; // identical answer whether or not the email is registered
  });

  router.post("/api/auth/reset-password", async (ctx) => {
    ctx.rateLimit("reset");
    auth.resetPassword(await ctx.json(), "citizen");
    return { ok: true };
  });

  router.post("/api/auth/logout", (ctx) => ctx.endSession("citizen"));
  router.get("/api/auth/me", (ctx) => ({ user: ctx.citizen }));

  // ---- Citizen portal: own requests ----------------------------------------
  router.post("/api/requests", requireCitizen, async (ctx) => ({ request: requests.submit(ctx.citizen, await ctx.json()) }));
  router.get("/api/requests", requireCitizen, (ctx) => ({ requests: requests.listMine(ctx.citizen) }));
  router.get("/api/requests/:id", requireCitizen, (ctx) => ({ request: requests.get(ctx.citizen, ctx.params.id) }));
  router.get("/api/requests/:id/image", requireCitizen, (ctx) => ({ raw: requests.image(ctx.citizen, ctx.params.id) }));

  // ---- Staff portal: accounts ------------------------------------------------
  router.post("/api/staff/auth/register", async (ctx) => {
    ctx.rateLimit("staff-auth");
    const user = auth.registerStaff(await ctx.json());
    ctx.issueSession(user, "staff");
    return { user };
  });

  router.post("/api/staff/auth/login", async (ctx) => {
    ctx.rateLimit("staff-auth");
    const user = auth.loginStaff(await ctx.json());
    ctx.issueSession(user, "staff");
    return { user };
  });

  router.post("/api/staff/auth/forgot-password", async (ctx) => {
    ctx.rateLimit("staff-forgot");
    auth.requestPasswordReset(await ctx.json(), "admin");
    return { ok: true };
  });

  router.post("/api/staff/auth/reset-password", async (ctx) => {
    ctx.rateLimit("staff-reset");
    auth.resetPassword(await ctx.json(), "admin");
    return { ok: true };
  });

  router.post("/api/staff/auth/logout", (ctx) => ctx.endSession("staff"));
  router.get("/api/staff/auth/me", (ctx) => ({ user: ctx.staff }));

  // ---- Staff portal: dashboard -----------------------------------------------
  router.get("/api/admin/requests", requireAdmin, (ctx) => requests.list(ctx.query));
  router.get("/api/admin/requests/:id", requireAdmin, (ctx) => ({ request: requests.get(ctx.staff, ctx.params.id) }));
  router.get("/api/admin/requests/:id/image", requireAdmin, (ctx) => ({ raw: requests.image(ctx.staff, ctx.params.id) }));
  router.get("/api/admin/export.csv", requireAdmin, (ctx) => ({
    raw: { type: "text/csv; charset=utf-8", body: requests.exportCsv(ctx.query), filename: "service-requests.csv" },
  }));
  router.get("/api/admin/analytics", requireAdmin, () => analytics.summary());
  router.patch("/api/admin/requests/:id", requireAdmin, async (ctx) => ({ request: requests.update(ctx.staff, ctx.params.id, await ctx.json()) }));

  // ---- Staff portal: approval codes (county administrator only) -----------------
  router.get("/api/admin/invites", requireAdmin, (ctx) => ({ invites: staffInvites.list(ctx.staff) }));
  router.post("/api/admin/invites", requireAdmin, async (ctx) => ({ invite: staffInvites.create(ctx.staff, await ctx.json()) }));
  router.delete("/api/admin/invites/:id", requireAdmin, (ctx) => staffInvites.revoke(ctx.staff, ctx.params.id));

  return router;
}

module.exports = { buildRouter };
