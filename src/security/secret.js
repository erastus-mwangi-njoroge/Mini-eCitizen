const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Returns the signing secret: the configured one, or a random one generated once and kept in the data folder
 * so that sessions survive a restart without anyone having to configure anything.
 */
function loadOrCreateSecret(configured, dataDir) {
  if (configured) return configured;
  const file = path.join(dataDir, ".session-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

module.exports = { loadOrCreateSecret };
