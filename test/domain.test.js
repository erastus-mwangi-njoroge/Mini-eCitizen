const { test } = require("node:test");
const assert = require("node:assert/strict");
const { canTransition, isOpen } = require("../src/domain/statuses");
const { isValidLocation } = require("../src/domain/locations");
const { validateRegistration } = require("../src/domain/validation");
const { decodeImage } = require("../src/domain/image");
const { TokenService } = require("../src/security/tokenService");
const { PasswordHasher } = require("../src/security/passwordHasher");

test("status workflow only allows the next step (and re-opening)", () => {
  assert.ok(canTransition("pending", "in_progress"));
  assert.ok(canTransition("in_progress", "resolved"));
  assert.ok(canTransition("resolved", "in_progress"));
  assert.equal(canTransition("pending", "resolved"), false);
  assert.equal(isOpen("pending") && isOpen("in_progress") && !isOpen("resolved"), true);
});

test("wards must belong to the chosen sub-county", () => {
  assert.ok(isValidLocation("Kiharu", "Township"));
  assert.equal(isValidLocation("Kiharu", "Makuyu"), false);
  assert.equal(isValidLocation("Nowhere", "Township"), false);
});

test("Kenyan phone numbers are normalised to +254 form", () => {
  for (const phone of ["0712345678", "0712 345 678", "+254712345678", "254112345678"]) {
    assert.match(validateRegistration({ name: "Jo Doe", email: "a@b.co", phone, password: "longenough" }).phone, /^\+254[17]\d{8}$/);
  }
});

test("image type is detected from the file contents, not the label", () => {
  const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).toString("base64");
  assert.equal(decodeImage(png, 1000).ext, "png");
  const lie = "data:image/png;base64," + Buffer.from("hello world, not an image").toString("base64");
  assert.throws(() => decodeImage(lie, 1000), /Unsupported/);
});

test("session tokens verify, expire and reject tampering", () => {
  const tokens = new TokenService("secret", 1000);
  const token = tokens.issue({ uid: "u1" });
  assert.equal(tokens.read(token).uid, "u1");
  assert.equal(tokens.read(token + "x"), null);
  assert.equal(new TokenService("other-secret", 1000).read(token), null);
  assert.equal(new TokenService("secret", -1).read(new TokenService("secret", -1).issue({ uid: "u1" })), null);
});

test("passwords are salted and verified", () => {
  const hasher = new PasswordHasher();
  const a = hasher.hash("hunter2hunter2");
  assert.notEqual(a, hasher.hash("hunter2hunter2"));
  assert.ok(hasher.verify("hunter2hunter2", a));
  assert.equal(hasher.verify("wrong", a), false);
});
