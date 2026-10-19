/**
 * Composition root: the one place that decides which concrete classes are used and wires them together.
 * Tests and scripts call buildApp() with their own config (e.g. a temporary data folder).
 */
const path = require("path");
const { JsonStore } = require("./repositories/jsonStore");
const { UserRepository } = require("./repositories/userRepository");
const { RequestRepository } = require("./repositories/requestRepository");
const { ResetTokenRepository } = require("./repositories/resetTokenRepository");
const { createMailer } = require("./services/mailer");
const { StaffInviteRepository } = require("./repositories/staffInviteRepository");
const { StaffInviteService } = require("./services/staffInviteService");
const { PasswordHasher } = require("./security/passwordHasher");
const { TokenService } = require("./security/tokenService");
const { RateLimiter } = require("./security/rateLimiter");
const { loadOrCreateSecret } = require("./security/secret");
const { ImageStorage } = require("./services/imageStorage");
const { AuthService } = require("./services/authService");
const { RequestService } = require("./services/requestService");
const { AnalyticsService } = require("./services/analyticsService");
const { buildRouter } = require("./routes");
const { createApp } = require("./http/app");

/** @param {object} config  @param {{ mailer?: object }} [overrides]  e.g. tests pass a fake mailer */
function buildApp(config, overrides = {}) {
  const store = new JsonStore(path.join(config.dataDir, "db.json"), { users: [], requests: [], resetTokens: [], staffInvites: [], counters: { request: 0 } });
  const users = new UserRepository(store);
  const requestRepo = new RequestRepository(store);
  const resetTokens = new ResetTokenRepository(store);
  const mailer = overrides.mailer || createMailer(config);

  const staffInvites = new StaffInviteService(new StaffInviteRepository(store), mailer, config);
  const auth = new AuthService(users, new PasswordHasher(), resetTokens, mailer, staffInvites, config);
  const requests = new RequestService(requestRepo, users, new ImageStorage(path.join(config.dataDir, "uploads")), config);
  const analytics = new AnalyticsService(requestRepo);
  auth.ensureAdmin(config);

  const tokens = new TokenService(loadOrCreateSecret(config.sessionSecret, config.dataDir), config.sessionHours * 3_600_000);
  const router = buildRouter({ auth, requests, analytics, staffInvites, config });
  const handler = createApp({ config, router, tokens, auth, limiter: new RateLimiter(config.rateLimitPerMinute) });

  return { handler, services: { auth, requests, analytics, staffInvites }, repositories: { users, requests: requestRepo, resetTokens } };
}

module.exports = { buildApp };
