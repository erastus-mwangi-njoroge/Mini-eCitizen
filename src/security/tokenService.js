const crypto = require("crypto");

/** Signed, expiring session tokens: base64url(payload) + "." + HMAC-SHA256 signature. */
class TokenService {
  constructor(secret, ttlMs) {
    this.secret = secret;
    this.ttlMs = ttlMs;
  }

  #sign(body) {
    return crypto.createHmac("sha256", this.secret).update(body).digest("base64url");
  }

  issue(payload) {
    const now = Date.now();
    const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + this.ttlMs })).toString("base64url");
    return `${body}.${this.#sign(body)}`;
  }

  /** @returns {object|null} the payload, or null when missing, forged or expired */
  read(token) {
    if (typeof token !== "string") return null;
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = Buffer.from(this.#sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString());
      return payload.exp > Date.now() ? payload : null;
    } catch {
      return null;
    }
  }
}

module.exports = { TokenService };
