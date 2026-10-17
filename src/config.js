/** The only file that reads process.env. Everything else receives this plain object. */
const path = require("path");

function loadConfig(env = process.env) {
  const root = path.join(__dirname, "..");
  const production = env.NODE_ENV === "production";
  return {
    production,
    port: Number(env.PORT) || 3000,
    dataDir: env.DATA_DIR || path.join(root, "data"),
    publicDir: path.join(root, "public"),
    // Empty = a random secret is generated once and kept in the data folder (see security/secret.js).
    sessionSecret: env.SESSION_SECRET || "",
    sessionHours: Number(env.SESSION_HOURS) || 8,
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === "1" : production,
    // Staff account created on first run when no admin exists.
    adminEmail: (env.ADMIN_EMAIL || "admin@muranga.go.ke").toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || (production ? "" : "ChangeMe123"),
    maxImageBytes: (Number(env.MAX_IMAGE_MB) || 5) * 1024 * 1024,
    rateLimitPerMinute: Number(env.RATE_LIMIT) || 20,
  };
}

module.exports = { loadConfig };
