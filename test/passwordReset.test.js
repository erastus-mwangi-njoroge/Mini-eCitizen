const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, registerCitizen, loginAdmin } = require("./helpers");
const { BrevoMailer } = require("../src/services/mailer");

let srv;
before(async () => {
  srv = await startServer();
  await registerCitizen(new Client(srv.base), 1); // c1@example.com / Password123
});
after(() => srv.close());

const tokenFrom = (message) => /token=([\w-]+)/.exec(message.html)[1];
const lastEmail = () => srv.sent[srv.sent.length - 1];
const wait = () => new Promise((r) => setTimeout(r, 20)); // the email is sent without being awaited
/** Skip the one-minute cooldown between reset emails for the same account. */
const resetCooldown = () => srv.app.repositories.resetTokens.store.data.resetTokens.forEach((t) => (t.createdAt -= 61_000));

test("a citizen gets a reset link by email and can set a new password with it", async () => {
  const c = new Client(srv.base);
  const res = await c.post("/api/auth/forgot-password", { email: "C1@example.com" });
  assert.equal(res.status, 200);
  await wait();
  const mail = lastEmail();
  assert.equal(mail.to, "c1@example.com");
  assert.match(mail.html, /#\/reset-password\?token=/, "citizen link points at the citizen page");

  const reset = await c.post("/api/auth/reset-password", { token: tokenFrom(mail), password: "BrandNewPass1" });
  assert.equal(reset.status, 200);
  assert.equal((await c.post("/api/auth/login", { email: "c1@example.com", password: "Password123" })).status, 401, "old password stops working");
  assert.equal((await c.post("/api/auth/login", { email: "c1@example.com", password: "BrandNewPass1" })).status, 200);
});

test("the same answer is given for unknown emails and no email is sent", async () => {
  const known = await new Client(srv.base).post("/api/auth/forgot-password", { email: "c1@example.com" });
  const unknown = await new Client(srv.base).post("/api/auth/forgot-password", { email: "nobody@example.com" });
  await wait();
  assert.deepEqual(unknown.body, known.body);
  assert.equal(srv.sent.some((m) => m.to === "nobody@example.com"), false, "nothing is sent to an unregistered address");
});

test("a reset link works only once", async () => {
  resetCooldown();
  const c = new Client(srv.base);
  await c.post("/api/auth/forgot-password", { email: "c1@example.com" });
  await wait();
  const token = tokenFrom(lastEmail());
  assert.equal((await c.post("/api/auth/reset-password", { token, password: "AnotherPass22" })).status, 200);
  assert.equal((await c.post("/api/auth/reset-password", { token, password: "ThirdPass3333" })).status, 400);
});

test("expired, forged and weak-password resets are refused", async () => {
  resetCooldown();
  const c = new Client(srv.base);
  await c.post("/api/auth/forgot-password", { email: "c1@example.com" });
  await wait();
  const token = tokenFrom(lastEmail());
  assert.equal((await c.post("/api/auth/reset-password", { token: "forged-token", password: "ValidPass1234" })).status, 400);
  assert.equal((await c.post("/api/auth/reset-password", { token, password: "short" })).status, 400, "too short");

  srv.app.repositories.resetTokens.store.data.resetTokens.forEach((t) => (t.expiresAt = Date.now() - 1));
  assert.equal((await c.post("/api/auth/reset-password", { token, password: "ValidPass1234" })).status, 400, "expired");
});

test("only a hash of the token is stored", async () => {
  resetCooldown();
  await new Client(srv.base).post("/api/auth/forgot-password", { email: "c1@example.com" });
  await wait();
  const token = tokenFrom(lastEmail());
  assert.equal(JSON.stringify(srv.app.repositories.resetTokens.store.data).includes(token), false);
});

test("asking again within a minute does not send a second email", async () => {
  resetCooldown();
  const c = new Client(srv.base);
  await c.post("/api/auth/forgot-password", { email: "c1@example.com" });
  await wait();
  const count = srv.sent.length;
  await c.post("/api/auth/forgot-password", { email: "c1@example.com" });
  await wait();
  assert.equal(srv.sent.length, count);
});

test("resetting a password signs out sessions that were open before", async () => {
  resetCooldown();
  const open = new Client(srv.base);
  await open.post("/api/auth/login", { email: "c1@example.com", password: "AnotherPass22" });
  const login = await open.get("/api/auth/me");
  assert.ok(login.body.user, "signed in before the reset");
  await new Promise((r) => setTimeout(r, 5));
  await open.post("/api/auth/forgot-password", { email: "c1@example.com" });
  await wait();
  await new Client(srv.base).post("/api/auth/reset-password", { token: tokenFrom(lastEmail()), password: "FreshStart9999" });
  assert.equal((await open.get("/api/auth/me")).body.user, null, "old session is dead");
});

test("citizen and staff resets are kept apart", async () => {
  resetCooldown();
  const before = srv.sent.length;
  // A staff reset asked for a citizen address sends nothing, and vice versa.
  await new Client(srv.base).post("/api/staff/auth/forgot-password", { email: "c1@example.com" });
  await new Client(srv.base).post("/api/auth/forgot-password", { email: "admin@muranga.go.ke" });
  await wait();
  assert.equal(srv.sent.length, before);

  // A citizen token cannot reset a staff password through the staff endpoint.
  await new Client(srv.base).post("/api/auth/forgot-password", { email: "c1@example.com" });
  await wait();
  const citizenToken = tokenFrom(lastEmail());
  assert.equal((await new Client(srv.base).post("/api/staff/auth/reset-password", { token: citizenToken, password: "StaffNewPass12" })).status, 400);
});

test("staff can reset their password; the link goes to the staff page and needs 10+ characters", async () => {
  const staff = new Client(srv.base);
  await staff.post("/api/staff/auth/forgot-password", { email: "admin@muranga.go.ke" });
  await wait();
  const mail = lastEmail();
  assert.match(mail.html, /#\/staff\/reset-password\?token=/);
  const token = tokenFrom(mail);
  assert.equal((await staff.post("/api/staff/auth/reset-password", { token, password: "only9char" })).status, 400);
  assert.equal((await staff.post("/api/staff/auth/reset-password", { token, password: "NewStaffPass2026" })).status, 200);
  assert.equal((await staff.post("/api/staff/auth/login", { email: "admin@muranga.go.ke", password: "ChangeMe123" })).status, 401);
  assert.equal((await staff.post("/api/staff/auth/login", { email: "admin@muranga.go.ke", password: "NewStaffPass2026" })).status, 200);
});

test("the Brevo mailer calls the Brevo API with the right headers and body", async () => {
  let call;
  const fakeFetch = async (url, init) => { call = { url, init }; return { ok: true }; };
  await new BrevoMailer({ apiKey: "KEY123", fromEmail: "noreply@example.com", fromName: "Murang'a" }, fakeFetch)
    .send({ to: "a@b.co", subject: "Hi", html: "<p>Hello</p>" });
  assert.equal(call.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(call.init.headers["api-key"], "KEY123");
  assert.deepEqual(JSON.parse(call.init.body), { sender: { email: "noreply@example.com", name: "Murang'a" }, to: [{ email: "a@b.co" }], subject: "Hi", htmlContent: "<p>Hello</p>" });

  const failing = new BrevoMailer({ apiKey: "k", fromEmail: "x@y.z", fromName: "n" }, async () => ({ ok: false, status: 401, text: async () => "unauthorized" }));
  await assert.rejects(() => failing.send({ to: "a@b.co", subject: "s", html: "h" }), /401/);
});
