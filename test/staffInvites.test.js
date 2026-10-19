const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, loginAdmin } = require("./helpers");

let srv, owner;
before(async () => {
  // No shared code configured: this is how production behaves, so only administrator-issued codes work.
  srv = await startServer({ staffAccessCode: "" });
  owner = new Client(srv.base);
  await loginAdmin(owner, srv.config);
});
after(() => srv.close());

const signup = (code, extra = {}) => ({ name: "New Officer", email: "officer@muranga.go.ke", department: "Roads & Lighting", password: "OfficerPass123", accessCode: code, ...extra });
const wait = () => new Promise((r) => setTimeout(r, 20));
const newCode = async (body = {}) => (await owner.post("/api/admin/invites", body)).body.invite;

test("the administrator issues an approval code and a new staff member registers with it", async () => {
  const invite = await newCode();
  assert.match(invite.code, /^MRG-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const staff = new Client(srv.base);
  const res = await staff.post("/api/staff/auth/register", signup(invite.code));
  assert.equal(res.status, 200);
  assert.equal(res.body.user.department, "Roads & Lighting");
  assert.equal(res.body.user.canInvite, false, "new staff cannot issue codes");
  assert.equal((await staff.get("/api/admin/analytics")).status, 200);
});

test("a code works only once", async () => {
  const { code } = await newCode();
  assert.equal((await new Client(srv.base).post("/api/staff/auth/register", signup(code, { email: "one@muranga.go.ke" }))).status, 200);
  const second = await new Client(srv.base).post("/api/staff/auth/register", signup(code, { email: "two@muranga.go.ke" }));
  assert.equal(second.status, 400);
  assert.ok(second.body.fields.accessCode);
});

test("codes are accepted regardless of case or spaces, and wrong codes are refused", async () => {
  const { code } = await newCode();
  assert.equal((await new Client(srv.base).post("/api/staff/auth/register", signup("MRG-AAAA-BBBB", { email: "x1@muranga.go.ke" }))).status, 400);
  assert.equal((await new Client(srv.base).post("/api/staff/auth/register", signup(` ${code.toLowerCase()} `, { email: "x2@muranga.go.ke" }))).status, 200);
});

test("a code locked to an email only works for that email, and is emailed to it", async () => {
  const invite = await newCode({ email: "locked@muranga.go.ke" });
  await wait();
  const mail = srv.sent.find((m) => m.to === "locked@muranga.go.ke");
  assert.ok(mail && mail.html.includes(invite.code), "the code is emailed to the invitee");

  const wrong = await new Client(srv.base).post("/api/staff/auth/register", signup(invite.code, { email: "someoneelse@muranga.go.ke" }));
  assert.equal(wrong.status, 400);
  assert.equal((await new Client(srv.base).post("/api/staff/auth/register", signup(invite.code, { email: "locked@muranga.go.ke" }))).status, 200);
});

test("expired and revoked codes are refused", async () => {
  const expired = await newCode();
  srv.app.services.staffInvites.invites.store.data.staffInvites.forEach((i) => { if (i.id === expired.id) i.expiresAt = Date.now() - 1; });
  assert.equal((await new Client(srv.base).post("/api/staff/auth/register", signup(expired.code, { email: "late@muranga.go.ke" }))).status, 400);

  const revoked = await newCode();
  assert.equal((await owner.call("DELETE", `/api/admin/invites/${revoked.id}`)).status, 200);
  assert.equal((await new Client(srv.base).post("/api/staff/auth/register", signup(revoked.code, { email: "gone@muranga.go.ke" }))).status, 400);
});

test("the list of active codes never reveals the codes themselves", async () => {
  const invite = await newCode({ email: "listed@muranga.go.ke" });
  const list = (await owner.get("/api/admin/invites")).body.invites;
  assert.ok(list.some((i) => i.id === invite.id && i.email === "listed@muranga.go.ke"));
  assert.equal(JSON.stringify(list).includes(invite.code), false);
  assert.equal(JSON.stringify(srv.app.services.staffInvites.invites.store.data).includes(invite.code), false, "only a hash is stored");
});

test("only the county administrator can issue, list or revoke codes", async () => {
  const { code } = await newCode();
  const officer = new Client(srv.base);
  await officer.post("/api/staff/auth/register", signup(code, { email: "plain@muranga.go.ke" }));
  assert.equal((await officer.post("/api/admin/invites", {})).status, 403);
  assert.equal((await officer.get("/api/admin/invites")).status, 403);

  const citizen = new Client(srv.base);
  await citizen.post("/api/auth/register", { name: "Cit", email: "cit@example.com", phone: "0712000055", password: "Password123" });
  assert.equal((await citizen.post("/api/admin/invites", {})).status, 403);
  assert.equal((await new Client(srv.base).post("/api/admin/invites", {})).status, 401);
});

test("an invite can only be locked to a @muranga.go.ke address", async () => {
  assert.equal((await owner.post("/api/admin/invites", { email: "someone@gmail.com" })).status, 400);
});

test("staff who register with a code can use forgot-password afterwards", async () => {
  const { code } = await newCode();
  const staff = new Client(srv.base);
  await staff.post("/api/staff/auth/register", signup(code, { email: "forgetful@muranga.go.ke" }));
  await staff.post("/api/staff/auth/forgot-password", { email: "forgetful@muranga.go.ke" });
  await wait();
  const mail = srv.sent.filter((m) => m.to === "forgetful@muranga.go.ke").pop();
  assert.match(mail.html, /#\/staff\/reset-password\?token=/);
});

test("the shared code from the environment still works when one is configured", async () => {
  const shared = await startServer({ staffAccessCode: "SHARED-CODE-1" });
  const res = await new Client(shared.base).post("/api/staff/auth/register", signup("SHARED-CODE-1", { email: "shared@muranga.go.ke" }));
  assert.equal(res.status, 200);
  await shared.close();
});
