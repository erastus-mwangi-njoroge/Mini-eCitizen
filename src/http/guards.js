const { unauthorized, forbidden } = require("../domain/errors");

/** Guards run before a route handler and throw to stop the request. */
const requireUser = (ctx) => {
  if (!ctx.user) throw unauthorized();
};

const requireAdmin = (ctx) => {
  requireUser(ctx);
  if (ctx.user.role !== "admin") throw forbidden("Staff access only.");
};

const requireCitizen = (ctx) => {
  requireUser(ctx);
  if (ctx.user.role !== "citizen") throw forbidden("Only citizens can submit requests.");
};

module.exports = { requireUser, requireAdmin, requireCitizen };
