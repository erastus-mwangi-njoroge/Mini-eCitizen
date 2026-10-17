const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Serve a file from the public folder. Returns false when there is no such file. */
function serveStatic(publicDir, pathname, res) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.join(publicDir, relative);
  // Refuse anything that resolves outside the public folder (e.g. "/../.env").
  if (!file.startsWith(publicDir + path.sep)) return false;
  let body;
  try {
    body = fs.readFileSync(file);
  } catch {
    return false;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  res.end(body);
  return true;
}

module.exports = { serveStatic };
