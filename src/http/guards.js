const { unauthorized, forbidden } = require("../domain/errors");

/**
 * Guards run before a route handler and throw to stop the request.
 * The citizen portal and staff portal have separate sessions (ctx.citizen / ctx.staff); one never grants the other.
 */
const requireCitizen = (ctx) => {
  if (ctx.citizen) return;
  throw ctx.staff ? forbidden("Citizen accounts only. You are signed in to the staff portal.") : unauthorized();
};

const requireAdmin = (ctx) => {
  if (ctx.staff) return;
  throw ctx.citizen ? forbidden("Staff access only.") : unauthorized("Please sign in to the staff portal.");
};

module.exports = { requireCitizen, requireAdmin };
