/**
 * Give an existing account staff (admin) access:   npm run make-admin -- someone@example.com
 * The person must already have registered (or be the seeded admin).
 */
try { process.loadEnvFile(); } catch { /* optional */ }
const { loadConfig } = require("../src/config");
const { buildApp } = require("../src/container");

const email = (process.argv[2] || "").toLowerCase();
const { repositories } = buildApp(loadConfig());
const user = repositories.users.findByEmail(email);

if (!user) {
  console.error(email ? `No account with email ${email}. Register it on the site first.` : "Usage: npm run make-admin -- someone@example.com");
  process.exit(1);
}
user.role = "admin";
repositories.users.store.save();
console.log(`${user.email} is now an admin. They will see the dashboard next time they sign in.`);
