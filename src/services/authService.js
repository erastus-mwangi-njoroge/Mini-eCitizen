const { validateRegistration, validateLogin } = require("../domain/validation");
const { conflict, AppError } = require("../domain/errors");

/** What the browser is allowed to know about a user (never the password hash). */
const toPublicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

class AuthService {
  /**
   * @param {UserRepository} users
   * @param {PasswordHasher} hasher
   */
  constructor(users, hasher) {
    this.users = users;
    this.hasher = hasher;
    // Checked when the email is unknown so that "no such user" takes as long as "wrong password".
    this.decoyHash = hasher.hash("decoy-password");
  }

  register(input) {
    const { name, email, phone, password } = validateRegistration(input);
    if (this.users.findByEmail(email)) throw conflict("That email is already registered.", { email: "Already registered. Try signing in." });
    const user = this.users.create({ name, email, phone, role: "citizen", passwordHash: this.hasher.hash(password) });
    return toPublicUser(user);
  }

  login(input) {
    const { email, password } = validateLogin(input);
    const user = this.users.findByEmail(email);
    const valid = this.hasher.verify(password, user ? user.passwordHash : this.decoyHash);
    if (!user || !valid) throw new AppError(401, "Incorrect email or password.");
    return toPublicUser(user);
  }

  /** Look up the user behind a session; null if the account no longer exists. */
  findPublicUser(id) {
    const user = this.users.findById(id);
    return user ? toPublicUser(user) : null;
  }

  /** Create the first staff account if no admin exists yet. */
  ensureAdmin({ adminEmail, adminPassword }) {
    if (this.users.hasAdmin()) return;
    if (!adminPassword) throw new Error("ADMIN_PASSWORD must be set to create the first admin account.");
    this.users.create({
      name: "County Administrator",
      email: adminEmail,
      phone: "",
      role: "admin",
      passwordHash: this.hasher.hash(adminPassword),
    });
  }
}

module.exports = { AuthService, toPublicUser };
