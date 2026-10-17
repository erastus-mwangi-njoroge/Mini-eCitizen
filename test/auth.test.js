const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, registerCitizen } = require("./helpers");

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());

test("registering signs the citizen in and normalises their phone number", async () => {
  const c = new Client(srv.base);
  const user = await registerCitizen(c);
  assert.equal(user.role, "citizen");
  assert.match(user.phone, /^\+2547\d{8}$/);
  assert.equal((await c.get("/api/auth/me")).body.user.email, "c1@example.com");
});

test("the password hash never reaches the browser", async () => {
  const c = new Client(srv.base);
  const res = await c.post("/api/auth/login", { email: "c1@example.com", password: "Password123" });
  assert.equal(res.status, 200);
  assert.equal(JSON.stringify(res.body).includes("passwordHash"), false);
});

test("registration reports every invalid field at once", async () => {
  const res = await new Client(srv.base).post("/api/auth/register", { name: "", email: "nope", phone: "123", password: "short" });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.body.fields).sort(), ["email", "name", "password", "phone"]);
});

test("a second registration with the same email is rejected", async () => {
  const res = await new Client(srv.base).post("/api/auth/register", { name: "Other", email: "C1@example.com", phone: "0712000099", password: "Password123" });
  assert.equal(res.status, 409);
});

test("wrong password and unknown email give the same message", async () => {
  const c = new Client(srv.base);
  const a = await c.post("/api/auth/login", { email: "c1@example.com", password: "wrong-password" });
  const b = await c.post("/api/auth/login", { email: "ghost@example.com", password: "wrong-password" });
  assert.equal(a.status, 401);
  assert.equal(a.body.error, b.body.error);
});

test("logout ends the session", async () => {
  const c = new Client(srv.base);
  await c.post("/api/auth/login", { email: "c1@example.com", password: "Password123" });
  await c.post("/api/auth/logout");
  assert.equal((await c.get("/api/auth/me")).body.user, null);
});

test("a tampered session cookie is ignored", async () => {
  const c = new Client(srv.base);
  await c.post("/api/auth/login", { email: "c1@example.com", password: "Password123" });
  c.cookie = c.cookie.slice(0, -3) + "abc";
  assert.equal((await c.get("/api/requests")).status, 401);
});

test("sign-in attempts are rate limited", async () => {
  const limited = await startServer({ rateLimitPerMinute: 3 });
  const c = new Client(limited.base);
  let last;
  for (let i = 0; i < 5; i++) last = await c.post("/api/auth/login", { email: "x@example.com", password: "whatever1" });
  assert.equal(last.status, 429);
  await limited.close();
});

test("cross-site requests are blocked", async () => {
  const res = await new Client(srv.base).call("POST", "/api/auth/login", { email: "c1@example.com", password: "Password123" }, { Origin: "https://evil.example" });
  assert.equal(res.status, 403);
});
