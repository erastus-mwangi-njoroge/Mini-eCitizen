/**
 * Composition root: the one place that decides which concrete classes are used and wires them together.
 * Tests and scripts call buildApp() with their own config (e.g. a temporary data folder).
 */
const path = require("path");
const { JsonStore } = require("./repositories/jsonStore");
const { UserRepository } = require("./repositories/userRepository");
const { RequestRepository } = require("./repositories/requestRepository");
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

function buildApp(config) {
  const store = new JsonStore(path.join(config.dataDir, "db.json"), { users: [], requests: [], counters: { request: 0 } });
  const users = new UserRepository(store);
  const requestRepo = new RequestRepository(store);

  const auth = new AuthService(users, new PasswordHasher());
  const requests = new RequestService(requestRepo, users, new ImageStorage(path.join(config.dataDir, "uploads")), config);
  const analytics = new AnalyticsService(requestRepo);
  auth.ensureAdmin(config);

  const tokens = new TokenService(loadOrCreateSecret(config.sessionSecret, config.dataDir), config.sessionHours * 3_600_000);
  const router = buildRouter({ auth, requests, analytics, config });
  const handler = createApp({ config, router, tokens, auth, limiter: new RateLimiter(config.rateLimitPerMinute) });

  return { handler, services: { auth, requests, analytics }, repositories: { users, requests: requestRepo } };
}

module.exports = { buildApp };
