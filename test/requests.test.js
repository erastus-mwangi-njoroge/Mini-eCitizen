const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, Client, validRequest, registerCitizen, loginAdmin, PNG_DATA_URL } = require("./helpers");

let srv, alice, bob, admin;
before(async () => {
  srv = await startServer();
  alice = new Client(srv.base); await registerCitizen(alice, 1);
  bob = new Client(srv.base); await registerCitizen(bob, 2);
  admin = new Client(srv.base); await loginAdmin(admin, srv.config);
});
after(() => srv.close());

test("a citizen submits a request and it starts as Pending with a reference number", async () => {
  const res = await alice.post("/api/requests", validRequest());
  assert.equal(res.status, 200);
  assert.match(res.body.request.ref, /^SR-\d{4}-\d{5}$/);
  assert.equal(res.body.request.status, "pending");
  assert.equal(res.body.request.history[0].type, "created");
});

test("submitting requires sign-in and validates the form", async () => {
  assert.equal((await new Client(srv.base).post("/api/requests", validRequest())).status, 401);
  const bad = await alice.post("/api/requests", { category: "nonsense", subCounty: "Kiharu", ward: "Makuyu", locationDetail: "x", description: "short" });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body.fields).sort(), ["category", "description", "locationDetail", "ward"]);
});

test("an optional photo is stored and served only to its owner and staff", async () => {
  const { request } = (await alice.post("/api/requests", validRequest({ image: PNG_DATA_URL }))).body;
  assert.equal(request.hasImage, true);
  const own = await alice.get(`/api/requests/${request.id}/image`);
  assert.equal(own.status, 200);
  assert.equal(own.headers.get("content-type"), "image/png");
  assert.deepEqual(own.body, Buffer.from(PNG_DATA_URL.split(",")[1], "base64"), "served bytes match the upload");
  assert.equal((await admin.get(`/api/admin/requests/${request.id}/image`)).status, 200);
  assert.equal((await admin.get(`/api/requests/${request.id}/image`)).status, 403, "staff use the staff endpoint, not the citizen one");
  assert.equal((await bob.get(`/api/requests/${request.id}/image`)).status, 403);
});

test("files that are not real images are rejected, whatever they claim to be", async () => {
  const fake = "data:image/png;base64," + Buffer.from("<script>alert(1)</script>").toString("base64");
  const res = await alice.post("/api/requests", validRequest({ image: fake }));
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.image);
});

test("oversized photos are rejected", async () => {
  const small = await startServer({ maxImageBytes: 100 });
  const c = new Client(small.base); await registerCitizen(c);
  const big = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500)]).toString("base64");
  assert.equal((await c.post("/api/requests", validRequest({ image: big }))).status, 400);
  await small.close();
});

test("citizens only see and open their own requests", async () => {
  const mine = await alice.get("/api/requests");
  const theirs = await bob.get("/api/requests");
  assert.ok(mine.body.requests.length >= 2);
  assert.equal(theirs.body.requests.length, 0);
  assert.equal((await bob.get(`/api/requests/${mine.body.requests[0].id}`)).status, 403);
});

test("citizens cannot use admin endpoints", async () => {
  assert.equal((await alice.get("/api/admin/requests")).status, 403);
  assert.equal((await alice.get("/api/admin/analytics")).status, 403);
  assert.equal((await new Client(srv.base).get("/api/admin/requests")).status, 401);
  const id = (await alice.get("/api/requests")).body.requests[0].id;
  assert.equal((await alice.patch(`/api/admin/requests/${id}`, { status: "resolved" })).status, 403);
});

test("staff can open any request through the staff endpoint; citizens cannot", async () => {
  const id = (await alice.get("/api/requests")).body.requests[0].id;
  const view = (await admin.get(`/api/admin/requests/${id}`)).body.request;
  assert.ok(view.citizen.name, "staff see who reported it");
  assert.equal((await alice.get(`/api/admin/requests/${id}`)).status, 403);
});

test("admins cannot submit citizen requests", async () => {
  assert.equal((await admin.post("/api/requests", validRequest())).status, 403);
});

test("status moves Pending -> In Progress -> Resolved, with notes visible to the citizen", async () => {
  const { request } = (await alice.post("/api/requests", validRequest())).body;
  const patch = (body) => admin.patch(`/api/admin/requests/${request.id}`, body);

  const skip = await patch({ status: "resolved" });
  assert.equal(skip.status, 400, "cannot jump straight to Resolved");

  const started = await patch({ status: "in_progress", note: "Crew assigned." });
  assert.equal(started.body.request.status, "in_progress");
  const done = await patch({ status: "resolved", note: "Bulb replaced." });
  assert.equal(done.body.request.status, "resolved");
  assert.ok(done.body.request.resolvedAt);

  const seenByCitizen = (await alice.get(`/api/requests/${request.id}`)).body.request;
  assert.deepEqual(seenByCitizen.history.map((e) => e.status), ["pending", "in_progress", "resolved"]);
  assert.equal(seenByCitizen.history[1].note, "Crew assigned.");

  assert.equal((await patch({ status: "resolved" })).status, 400, "already resolved");
  const reopened = await patch({ status: "in_progress", note: "Light failed again." });
  assert.equal(reopened.body.request.resolvedAt, null);
});

test("priority can be changed on its own, and unknown values are rejected", async () => {
  const id = (await alice.get("/api/requests")).body.requests[0].id;
  assert.equal((await admin.patch(`/api/admin/requests/${id}`, { priority: "urgent" })).body.request.priority, "urgent");
  assert.equal((await admin.patch(`/api/admin/requests/${id}`, { priority: "asap" })).status, 400);
  assert.equal((await admin.patch(`/api/admin/requests/${id}`, {})).status, 400);
});

test("public tracking shows progress but no personal or location detail", async () => {
  const { request } = (await alice.post("/api/requests", validRequest({ locationDetail: "Behind Mama Njeri's kiosk" }))).body;
  await admin.patch(`/api/admin/requests/${request.id}`, { status: "in_progress", note: "Private staff note" });
  const res = await new Client(srv.base).get(`/api/track/${request.ref.toLowerCase()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "in_progress");
  const text = JSON.stringify(res.body);
  for (const secret of ["Njeri", "Private staff note", "Citizen 1", "c1@example.com", "userId"]) assert.equal(text.includes(secret), false, secret);
  assert.equal((await new Client(srv.base).get("/api/track/SR-0000-00000")).status, 404);
});

test("admin list supports search, filters, sorting and pagination", async () => {
  await alice.post("/api/requests", validRequest({ category: "water", subCounty: "Gatanga", ward: "Kariara", description: "No water for four days now." }));
  const all = (await admin.get("/api/admin/requests?pageSize=2")).body;
  assert.equal(all.items.length, 2);
  assert.ok(all.pages >= 2);
  assert.ok(all.items[0].citizen.name, "admin sees who reported it");

  const water = (await admin.get("/api/admin/requests?category=water")).body;
  assert.ok(water.total >= 1 && water.items.every((r) => r.category === "water"));
  assert.equal((await admin.get("/api/admin/requests?q=kariara")).body.total, 1);
  const dept = (await admin.get("/api/admin/requests?department=Roads%20%26%20Lighting&pageSize=100")).body;
  assert.ok(dept.total >= 1 && dept.items.every((r) => ["streetlight", "roads"].includes(r.category)));
  assert.ok((await admin.get("/api/admin/requests?status=open")).body.items.every((r) => r.status !== "resolved"));
  const urgentFirst = (await admin.get("/api/admin/requests?sort=priority")).body.items;
  assert.equal(urgentFirst[0].priority, "urgent");
});

test("analytics count open vs resolved correctly", async () => {
  const list = (await admin.get("/api/admin/requests?pageSize=100")).body.items;
  const a = (await admin.get("/api/admin/analytics")).body;
  assert.equal(a.totals.all, list.length);
  assert.equal(a.totals.resolved, list.filter((r) => r.status === "resolved").length);
  assert.equal(a.totals.open, list.filter((r) => r.status !== "resolved").length);
  assert.equal(a.totals.open, a.totals.pending + a.totals.inProgress);
  assert.equal(a.totals.all, a.byCategory.reduce((n, c) => n + c.open + c.resolved, 0));
  assert.equal(a.daily.length, 14);
  for (const group of [...a.byCategory, ...a.byWard, ...a.byDepartment]) {
    assert.equal(group.total, group.open + group.resolved);
    assert.equal(group.open, group.pending + group.inProgress);
  }
  assert.equal(a.byDepartment.reduce((n, d) => n + d.total, 0), list.length);
  const water = a.byDepartment.find((d) => d.key === "Water & Sanitation");
  assert.equal(water.total, list.filter((r) => ["water", "drainage"].includes(r.category)).length);
  assert.equal(a.daily.reduce((n, d) => n + d.submitted, 0), list.length);
});

test("CSV export neutralises spreadsheet formulas", async () => {
  await alice.post("/api/requests", validRequest({ description: "=HYPERLINK(\"http://evil\") is not a real problem" }));
  const res = await admin.get("/api/admin/export.csv");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  const csv = res.body.toString();
  assert.match(csv, /^"Reference"/);
  assert.ok(csv.includes(`"'=HYPERLINK`));
});
