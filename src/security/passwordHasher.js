const crypto = require("crypto");

/** Salted scrypt hashing. Stored form is "salt:hash" (both hex). */
class PasswordHasher {
  hash(password, salt = crypto.randomBytes(16).toString("hex")) {
    return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
  }

  verify(password, stored) {
    const [salt, expected] = stored.split(":");
    const actual = this.hash(password, salt).split(":")[1];
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  }
}

module.exports = { PasswordHasher };
