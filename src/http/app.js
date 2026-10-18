const { AppError, tooManyRequests } = require("../domain/errors");
const { createContext } = require("./context");
const { serveStatic } = require("./static");

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

/** One cookie per portal, so being signed in to one never signs you in to the other. */
const REALMS = {
  citizen: { cookie: "session", role: "citizen" },
  staff: { cookie: "staff_session", role: "admin" },
};

/**
 * Builds the Node request listener: security headers, session lookup, API routing, static files, error handling.
 * @param {{config, router, tokens, auth, limiter}} deps
 */
function createApp({ config, router, tokens, auth, limiter }) {
  const maxBodyBytes = Math.ceil(config.maxImageBytes * 1.4) + 64 * 1024; // base64 inflates by ~33%

  const send = (res, status, headers, body) => {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  };
  const sendJson = (res, status, data, headers = {}) =>
    send(res, status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }, JSON.stringify(data));

  const cookieFor = (realm, token, maxAge) =>
    `${REALMS[realm].cookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${config.secureCookies ? "; Secure" : ""}`;

  /** The signed-in user for one portal, or null. The token must have been issued for that same portal. */
  const userFor = (ctx, realm) => {
    const session = tokens.read(ctx.cookies[REALMS[realm].cookie]);
    return session && session.realm === realm ? auth.findPublicUser(session.uid, REALMS[realm].role, session.iat) : null;
  };

  async function handleApi(req, res, url) {
    // Cross-site form posts are blocked by SameSite=Strict; this also rejects a mismatched Origin header.
    if (req.method !== "GET" && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
      throw new AppError(403, "Cross-site request blocked.");
    }
    const match = router.match(req.method, url.pathname);
    if (!match) throw new AppError(404, "Unknown API endpoint.");

    const ctx = createContext(req, res, url, { maxBodyBytes });
    ctx.params = match.params;
    ctx.issueSession = (user, realm) => {
      ctx.headers["Set-Cookie"] = cookieFor(realm, tokens.issue({ uid: user.id, realm }), config.sessionHours * 3600);
    };
    ctx.endSession = (realm) => {
      ctx.headers["Set-Cookie"] = cookieFor(realm, "", 0);
    };
    ctx.rateLimit = (action) => {
      if (limiter.hit(`${ctx.ip}:${action}`)) throw tooManyRequests();
    };

    ctx.citizen = userFor(ctx, "citizen");
    ctx.staff = userFor(ctx, "staff");

    let result;
    for (const handler of match.handlers) result = await handler(ctx);

    // A handler may return { raw: { type, body, filename } } for files; otherwise the result is JSON.
    if (result && result.raw) {
      const { type, body, filename } = result.raw;
      const disposition = filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {};
      return send(res, 200, { "Content-Type": type, "Cache-Control": "private, max-age=3600", ...disposition, ...ctx.headers }, body);
    }
    sendJson(res, 200, result ?? { ok: true }, ctx.headers);
  }

  return async function onRequest(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD") throw new AppError(405, "Method not allowed.");
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
      if (!serveStatic(config.publicDir, url.pathname, res)) throw new AppError(404, "Page not found.");
    } catch (err) {
      if (res.headersSent) return;
      if (err instanceof AppError) return sendJson(res, err.status, { error: err.message, fields: err.fields });
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong on our side. Please try again." });
    }
  };
}

module.exports = { createApp };
