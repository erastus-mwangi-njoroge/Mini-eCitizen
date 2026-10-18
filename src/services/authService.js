const crypto = require("crypto");
const { validateRegistration, validateLogin, validateStaffRegistration, validateStaffLogin, validateForgotPassword, validatePasswordReset } = require("../domain/validation");
const { passwordResetEmail } = require("./emailTemplates");
const { isStaffEmail, STAFF_DOMAIN } = require("../domain/staffAccess");
const { conflict, forbidden, badRequest, AppError } = require("../domain/errors");

const CITIZEN = "citizen";
const STAFF = "admin"; // every staff account has the "admin" role

/** What the browser is allowed to know about a user (never the password hash). */
const toPublicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

const MIN_PASSWORD = { citizen: 8, admin: 10 };
const RESET_COOLDOWN_MS = 60_000; // at most one reset email per account per minute (stops email-bombing)
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const sameSecret = (a, b) => {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

/**
 * Accounts for the two separate portals. A citizen account only ever works in the citizen portal and a staff
 * account only in the staff portal: every method takes the role it serves and treats the other as "no such user".
 */
class AuthService {
  /**
   * @param {UserRepository} users
   * @param {PasswordHasher} hasher
   * @param {ResetTokenRepository} resetTokens
   * @param {{ send(message): Promise<void> }} mailer
   * @param {{ staffAccessCode?: string, publicUrl?: string, resetMinutes?: number }} options
   */
  constructor(users, hasher, resetTokens, mailer, { staffAccessCode = "", publicUrl = "", resetMinutes = 30 } = {}) {
    this.users = users;
    this.hasher = hasher;
    this.resetTokens = resetTokens;
    this.mailer = mailer;
    this.staffAccessCode = staffAccessCode;
    this.publicUrl = publicUrl;
    this.resetMinutes = resetMinutes;
    // Checked when the email is unknown so that "no such user" takes as long as "wrong password".
    this.decoyHash = hasher.hash("decoy-password");
  }

  // ---- Citizen portal ----------------------------------------------------

  registerCitizen(input) {
    const { name, email, phone, password } = validateRegistration(input);
    if (this.users.findByEmail(email)) throw conflict("That email is already registered.", { email: "Already registered. Try signing in." });
    return toPublicUser(this.users.create({ name, email, phone, role: CITIZEN, passwordHash: this.hasher.hash(password) }));
  }

  loginCitizen(input) {
    const { email, password } = validateLogin(input);
    return this.#authenticate(email, password, CITIZEN);
  }

  // ---- Staff portal ------------------------------------------------------

  registerStaff(input) {
    if (!this.staffAccessCode) throw forbidden("Staff sign-up is closed. Ask the system administrator to create your account.");
    const { name, email, password, accessCode } = validateStaffRegistration(input);
    if (!sameSecret(accessCode, this.staffAccessCode)) throw badRequest("Please fix the highlighted fields.", { accessCode: "That access code is not correct." });
    if (this.users.findByEmail(email)) throw conflict("That email is already registered.", { email: "Already registered. Try signing in." });
    return toPublicUser(this.users.create({ name, email, phone: "", role: STAFF, passwordHash: this.hasher.hash(password) }));
  }

  loginStaff(input) {
    const { email, password } = validateStaffLogin(input);
    return this.#authenticate(email, password, STAFF);
  }

  // ---- Forgotten passwords (both portals) --------------------------------------

  /**
   * Email a one-time reset link. Always returns normally, whether or not the account exists,
   * so the answer cannot be used to discover who is registered. A citizen link only works for a
   * citizen account and a staff link only for a staff account.
   */
  requestPasswordReset(input, role) {
    const { email } = validateForgotPassword(input);
    const user = this.users.findByEmail(email);
    if (!user || user.role !== role) return;
    if (Date.now() - this.resetTokens.latestCreatedAt(user.id) < RESET_COOLDOWN_MS) return;

    const token = crypto.randomBytes(32).toString("base64url");
    this.resetTokens.create(user.id, hashToken(token), Date.now() + this.resetMinutes * 60_000);
    const path = role === STAFF ? "#/staff/reset-password" : "#/reset-password";
    const message = passwordResetEmail({ name: user.name, link: `${this.publicUrl}/${path}?token=${token}`, minutes: this.resetMinutes, portal: role === STAFF ? "staff" : "citizen" });
    // Not awaited: the response must take the same time whether or not an email is actually sent.
    this.mailer.send({ to: user.email, ...message }).catch((err) => console.error("Password-reset email failed:", err.message));
  }

  /** Set a new password using an emailed token. The token is single-use and every older sign-in is ended. */
  resetPassword(input, role) {
    const { token, password } = validatePasswordReset(input, { minLength: MIN_PASSWORD[role === STAFF ? "admin" : "citizen"] });
    const record = this.resetTokens.find(hashToken(token));
    const user = record && this.users.findById(record.userId);
    if (!user || user.role !== role) throw badRequest("This reset link is invalid or has expired. Please request a new one.");

    user.passwordHash = this.hasher.hash(password);
    user.passwordChangedAt = new Date().toISOString();
    this.users.save();
    this.resetTokens.removeForUser(user.id);
  }

  // ---- Shared ------------------------------------------------------------

  /**
   * Look up the user behind a session cookie, but only if they belong to the portal asking
   * and have not changed their password since the session was issued.
   */
  findPublicUser(id, role, issuedAt = 0) {
    const user = this.users.findById(id);
    if (!user || user.role !== role) return null;
    if (user.passwordChangedAt && issuedAt < Date.parse(user.passwordChangedAt)) return null;
    return toPublicUser(user);
  }

  /** Create the first staff account if no admin exists yet. */
  ensureAdmin({ adminEmail, adminPassword }) {
    if (this.users.hasAdmin()) return;
    if (!isStaffEmail(adminEmail)) throw new Error(`ADMIN_EMAIL must be a @${STAFF_DOMAIN} address.`);
    if (!adminPassword) throw new Error("ADMIN_PASSWORD must be set to create the first admin account.");
    this.users.create({ name: "County Administrator", email: adminEmail, phone: "", role: STAFF, passwordHash: this.hasher.hash(adminPassword) });
  }

  /** Same generic failure for unknown email, wrong password, and an account that belongs to the other portal. */
  #authenticate(email, password, role) {
    const found = this.users.findByEmail(email);
    const user = found && found.role === role ? found : null;
    const valid = this.hasher.verify(password, user ? user.passwordHash : this.decoyHash);
    if (!user || !valid) throw new AppError(401, "Incorrect email or password.");
    return toPublicUser(user);
  }
}

module.exports = { AuthService, toPublicUser };
