const { Router } = require("../http/router");
const { requireUser, requireAdmin, requireCitizen } = require("../http/guards");
const { CATEGORIES } = require("../domain/categories");
const { STATUSES, PRIORITIES, nextStatuses } = require("../domain/statuses");
const { SUBCOUNTY_WARDS } = require("../domain/locations");

/** Declares every API endpoint in one place so the whole surface of the app can be read at a glance. */
function buildRouter({ auth, requests, analytics, config }) {
  const router = new Router();

  // ---- Public ------------------------------------------------------------
  router.get("/api/meta", () => ({
    categories: CATEGORIES,
    statuses: STATUSES,
    priorities: PRIORITIES,
    transitions: Object.fromEntries(STATUSES.map((s) => [s.id, nextStatuses(s.id)])),
    locations: SUBCOUNTY_WARDS,
    maxImageMb: config.maxImageBytes / 1048576,
  }));

  router.get("/api/track/:ref", (ctx) => {
    ctx.rateLimit("track");
    return requests.track(ctx.params.ref);
  });

  // ---- Accounts ----------------------------------------------------------
  router.post("/api/auth/register", async (ctx) => {
    ctx.rateLimit("auth");
    const user = auth.register(await ctx.json());
    ctx.issueSession(user);
    return { user };
  });

  router.post("/api/auth/login", async (ctx) => {
    ctx.rateLimit("auth");
    const user = auth.login(await ctx.json());
    ctx.issueSession(user);
    return { user };
  });

  router.post("/api/auth/logout", (ctx) => ctx.endSession());
  router.get("/api/auth/me", (ctx) => ({ user: ctx.user }));

  // ---- Citizen: own requests ---------------------------------------------
  router.post("/api/requests", requireCitizen, async (ctx) => ({ request: requests.submit(ctx.user, await ctx.json()) }));
  router.get("/api/requests", requireUser, (ctx) => ({ requests: requests.listMine(ctx.user) }));
  router.get("/api/requests/:id", requireUser, (ctx) => ({ request: requests.get(ctx.user, ctx.params.id) }));
  router.get("/api/requests/:id/image", requireUser, (ctx) => ({ raw: requests.image(ctx.user, ctx.params.id) }));

  // ---- Admin -------------------------------------------------------------
  router.get("/api/admin/requests", requireAdmin, (ctx) => requests.list(ctx.query));
  router.get("/api/admin/export.csv", requireAdmin, (ctx) => ({
    raw: { type: "text/csv; charset=utf-8", body: requests.exportCsv(ctx.query), filename: "service-requests.csv" },
  }));
  router.get("/api/admin/analytics", requireAdmin, () => analytics.summary());
  router.patch("/api/admin/requests/:id", requireAdmin, async (ctx) => ({ request: requests.update(ctx.user, ctx.params.id, await ctx.json()) }));

  return router;
}

module.exports = { buildRouter };
