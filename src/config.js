/** The only file that reads process.env. Everything else receives this plain object. */
const path = require("path");
const { STAFF_DOMAIN } = require("./domain/staffAccess");

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
    adminEmail: (env.ADMIN_EMAIL || `admin@${STAFF_DOMAIN}`).toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || (production ? "" : "ChangeMe123"),
    // Optional SHARED approval code anyone can use to register as staff (handy for local development).
    // Normal use: the administrator issues single-use codes from the dashboard, so leave this empty in production.
    staffAccessCode: env.STAFF_ACCESS_CODE || (production ? "" : "MURANGA-STAFF"),
    // Password-reset emails (Brevo free plan). Without these, links are printed to the console in development
    // and reset emails are disabled in production.
    brevoApiKey: env.BREVO_API_KEY || "",
    mailFromEmail: env.MAIL_FROM_EMAIL || "", // must be a sender verified in your Brevo account
    mailFromName: env.MAIL_FROM_NAME || "Murang'a County Service Requests",
    // Public address of the site, used to build the link in the email. Render provides RENDER_EXTERNAL_URL itself.
    publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/+$/, ""),
    publicUrlConfigured: Boolean(env.PUBLIC_URL || env.RENDER_EXTERNAL_URL),
    resetMinutes: 30,
    maxImageBytes: (Number(env.MAX_IMAGE_MB) || 5) * 1024 * 1024,
    rateLimitPerMinute: Number(env.RATE_LIMIT) || 20,
  };
}

module.exports = { loadConfig };
