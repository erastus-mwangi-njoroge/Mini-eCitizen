const { badRequest, AppError } = require("../domain/errors");

/** Parse a Cookie header into { name: value }. */
function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return cookies;
}

/** Read and parse a JSON request body, refusing anything over maxBytes. */
function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json/i.test(req.headers["content-type"] || "")) {
      return reject(new AppError(415, "Send JSON (Content-Type: application/json)."));
    }
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new AppError(413, "That upload is too large."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        reject(badRequest("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

/** Everything a route handler needs about one request/response pair. */
function createContext(req, res, url, { maxBodyBytes }) {
  return {
    req,
    res,
    query: Object.fromEntries(url.searchParams),
    params: {},
    user: null,
    ip: req.socket.remoteAddress || "unknown",
    cookies: parseCookies(req.headers.cookie),
    json: () => readJson(req, maxBodyBytes),
    /** Extra response headers (e.g. Set-Cookie) that the app adds when it replies. */
    headers: {},
  };
}

module.exports = { createContext };
