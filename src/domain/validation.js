/**
 * Input validation. Each function cleans one kind of input and either returns the clean value
 * or throws a 400 listing every problem at once (so a form can show all errors in one go).
 */
const { badRequest } = require("./errors");
const { categoryIds } = require("./categories");
const { statusIds, priorityIds } = require("./statuses");
const { isValidLocation } = require("./locations");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^(?:\+?254|0)([17]\d{8})$/; // Kenyan mobile: 07xx / 01xx / +2547xx

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** Collects field errors, then throws once. */
function check(rules) {
  const fields = {};
  for (const [name, message] of rules) if (message) fields[name] = message;
  if (Object.keys(fields).length) throw badRequest("Please fix the highlighted fields.", fields);
}

function validateRegistration(input = {}) {
  const name = text(input.name).replace(/\s+/g, " ");
  const email = text(input.email).toLowerCase();
  const phoneMatch = PHONE.exec(text(input.phone).replace(/[\s-]/g, ""));
  const password = typeof input.password === "string" ? input.password : "";
  check([
    ["name", name.length < 2 || name.length > 80 ? "Enter your full name." : ""],
    ["email", !EMAIL.test(email) ? "Enter a valid email address." : ""],
    ["phone", !phoneMatch ? "Enter a Kenyan mobile number, e.g. 0712 345 678." : ""],
    ["password", password.length < 8 ? "Use at least 8 characters." : password.length > 128 ? "Password is too long." : ""],
  ]);
  return { name, email, phone: "+254" + phoneMatch[1], password };
}

function validateLogin(input = {}) {
  const email = text(input.email).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";
  check([
    ["email", !email ? "Enter your email." : ""],
    ["password", !password ? "Enter your password." : ""],
  ]);
  return { email, password };
}

function validateNewRequest(input = {}) {
  const category = text(input.category);
  const subCounty = text(input.subCounty);
  const ward = text(input.ward);
  const locationDetail = text(input.locationDetail);
  const description = text(input.description);
  check([
    ["category", !categoryIds().includes(category) ? "Choose a category." : ""],
    ["subCounty", !subCounty ? "Choose a sub-county." : ""],
    ["ward", !ward ? "Choose a ward." : subCounty && !isValidLocation(subCounty, ward) ? "That ward is not in the sub-county." : ""],
    ["locationDetail", locationDetail.length < 3 ? "Describe where it is (street, landmark, pole number…)." : locationDetail.length > 200 ? "Keep this under 200 characters." : ""],
    ["description", description.length < 10 ? "Tell us a little more (at least 10 characters)." : description.length > 2000 ? "Keep this under 2000 characters." : ""],
  ]);
  return { category, subCounty, ward, locationDetail, description, image: typeof input.image === "string" ? input.image : "" };
}

/** An admin update may change the status and/or priority, and may carry a note the citizen will see. */
function validateAdminUpdate(input = {}) {
  const status = text(input.status);
  const priority = text(input.priority);
  const note = text(input.note);
  check([
    ["status", status && !statusIds().includes(status) ? "Unknown status." : ""],
    ["priority", priority && !priorityIds().includes(priority) ? "Unknown priority." : ""],
    ["note", note.length > 500 ? "Keep the note under 500 characters." : ""],
    ["_", !status && !priority && !note ? "Choose a new status or priority, or write a note." : ""],
  ]);
  return { status, priority, note };
}

module.exports = { validateRegistration, validateLogin, validateNewRequest, validateAdminUpdate };
