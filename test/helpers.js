const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadConfig } = require("../src/config");
const { buildApp } = require("../src/container");

/** Smallest valid PNG (1x1 pixel), as a data URL. */
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Start the whole app on a random port with a throw-away data folder. */
async function startServer(overrides = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-test-"));
  const config = { ...loadConfig({}), dataDir, rateLimitPerMinute: 1000, ...overrides };
  const app = buildApp(config);
  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, config, app,
    close: () => new Promise((resolve) => server.close(() => { fs.rmSync(dataDir, { recursive: true, force: true }); resolve(); })),
  };
}

/** A tiny HTTP client that remembers the session cookie, like a browser tab. */
class Client {
  constructor(base) { this.base = base; this.cookie = ""; }

  async call(method, url, body, headers = {}) {
    const res = await fetch(this.base + url, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const type = res.headers.get("content-type") || "";
    return { status: res.status, headers: res.headers, body: type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  }
  get(url) { return this.call("GET", url); }
  post(url, body = {}) { return this.call("POST", url, body); }
  patch(url, body) { return this.call("PATCH", url, body); }
}

const validRequest = (extra = {}) => ({
  category: "streetlight", subCounty: "Kiharu", ward: "Township",
  locationDetail: "Pole 14 outside the market", description: "The light has been out for two weeks.", ...extra,
});

async function registerCitizen(client, n = 1) {
  const res = await client.post("/api/auth/register", { name: `Citizen ${n}`, email: `c${n}@example.com`, phone: `07120000${n}0`, password: "Password123" });
  if (res.status !== 200) throw new Error("register failed: " + JSON.stringify(res.body));
  return res.body.user;
}

async function loginAdmin(client, config) {
  const res = await client.post("/api/auth/login", { email: config.adminEmail, password: config.adminPassword });
  if (res.status !== 200) throw new Error("admin login failed");
}

module.exports = { startServer, Client, validRequest, registerCitizen, loginAdmin, PNG_DATA_URL };
