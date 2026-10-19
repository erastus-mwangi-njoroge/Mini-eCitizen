const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, registerCitizen, loginAdmin } = require("./helpers");

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
  c.jar.set("session", c.jar.get("session").slice(0, -3) + "abc");
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

// ---- Staff portal vs citizen portal ----------------------------------------

const staffSignup = (extra = {}) => ({ name: "Njeri Staff", email: "njeri@muranga.go.ke", department: "Water & Sanitation", password: "StaffPass1234", accessCode: "MURANGA-STAFF", ...extra });

test("the default admin signs in to the staff portal", async () => {
  const c = new Client(srv.base);
  const res = await c.post("/api/staff/auth/login", { email: "admin@muranga.go.ke", password: "ChangeMe123" });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, "admin");
  assert.equal((await c.get("/api/admin/analytics")).status, 200);
});

test("CORRECT citizen credentials are INCORRECT in the staff portal", async () => {
  const res = await new Client(srv.base).post("/api/staff/auth/login", { email: "c1@example.com", password: "Password123" });
  assert.equal(res.status, 400); // not a @muranga.go.ke address
  assert.ok(res.body.fields.email);
});

test("CORRECT staff credentials are INCORRECT in the citizen portal", async () => {
  const res = await new Client(srv.base).post("/api/auth/login", { email: "admin@muranga.go.ke", password: "ChangeMe123" });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Incorrect email or password.");
});

test("a citizen session grants nothing in the staff portal, and a staff session nothing in the citizen portal", async () => {
  const citizen = new Client(srv.base);
  await citizen.post("/api/auth/login", { email: "c1@example.com", password: "Password123" });
  assert.equal((await citizen.get("/api/staff/auth/me")).body.user, null);
  assert.equal((await citizen.get("/api/admin/analytics")).status, 403);

  const staff = new Client(srv.base);
  await loginAdmin(staff, srv.config);
  assert.equal((await staff.get("/api/auth/me")).body.user, null);
  assert.equal((await staff.get("/api/requests")).status, 403);
});

test("both portals can be signed in at once without mixing up identities", async () => {
  const both = new Client(srv.base);
  await both.post("/api/auth/login", { email: "c1@example.com", password: "Password123" });
  await loginAdmin(both, srv.config);
  assert.equal((await both.get("/api/auth/me")).body.user.role, "citizen");
  assert.equal((await both.get("/api/staff/auth/me")).body.user.role, "admin");
  await both.post("/api/staff/auth/logout");
  assert.equal((await both.get("/api/staff/auth/me")).body.user, null);
  assert.equal((await both.get("/api/auth/me")).body.user.role, "citizen", "citizen session survives staff sign-out");
});

test("staff sign-up needs a @muranga.go.ke email and the access code", async () => {
  const wrongDomain = await new Client(srv.base).post("/api/staff/auth/register", staffSignup({ email: "njeri@gmail.com" }));
  assert.equal(wrongDomain.status, 400);
  assert.ok(wrongDomain.body.fields.email);

  const lookalike = await new Client(srv.base).post("/api/staff/auth/register", staffSignup({ email: "njeri@muranga.go.ke.evil.com" }));
  assert.equal(lookalike.status, 400);

  const wrongCode = await new Client(srv.base).post("/api/staff/auth/register", staffSignup({ accessCode: "guess" }));
  assert.equal(wrongCode.status, 400);
  assert.ok(wrongCode.body.fields.accessCode);

  const ok = new Client(srv.base);
  const created = await ok.post("/api/staff/auth/register", staffSignup());
  assert.equal(created.status, 200);
  assert.equal(created.body.user.role, "admin");
  assert.equal((await ok.get("/api/admin/analytics")).status, 200);

  assert.equal((await new Client(srv.base).post("/api/staff/auth/register", staffSignup())).status, 409, "duplicate");
});

test("a new staff account cannot sign in through the citizen portal", async () => {
  const res = await new Client(srv.base).post("/api/auth/login", { email: "njeri@muranga.go.ke", password: "StaffPass1234" });
  assert.equal(res.status, 401);
});

test("citizens cannot register with a county staff email", async () => {
  const res = await new Client(srv.base).post("/api/auth/register", { name: "Sneaky", email: "sneaky@muranga.go.ke", phone: "0712000077", password: "Password123" });
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.email);
});

test("staff must choose one of the county departments when signing up", async () => {
  const res = await new Client(srv.base).post("/api/staff/auth/register", staffSignup({ email: "dept@muranga.go.ke", department: "Made-up Department" }));
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.department);
});

test("the chosen department is saved on the staff account", async () => {
  const c = new Client(srv.base);
  const res = await c.post("/api/staff/auth/register", staffSignup({ email: "water@muranga.go.ke", department: "Water & Sanitation" }));
  assert.equal(res.body.user.department, "Water & Sanitation");
  assert.equal((await c.get("/api/staff/auth/me")).body.user.department, "Water & Sanitation");
});
