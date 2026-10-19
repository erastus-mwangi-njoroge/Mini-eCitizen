const crypto = require("crypto");
const { validateInvite } = require("../domain/validation");
const { forbidden, notFound } = require("../domain/errors");
const { staffInviteEmail } = require("./emailTemplates");

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: codes are read out and typed by hand
const hash = (code) => crypto.createHash("sha256").update(code).digest("hex");
const normalise = (code) => String(code || "").trim().toUpperCase();
const sameSecret = (a, b) => crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());

/** A code like MRG-7KQ2-XD4P. */
function generateCode() {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
  return `MRG-${part()}-${part()}`;
}

/**
 * Approval codes: the way a new staff member is allowed to create an account.
 * The county administrator generates a single-use code (optionally locked to one email address) and hands it over.
 * An optional shared code from the environment also works, for bootstrapping.
 */
class StaffInviteService {
  /**
   * @param {StaffInviteRepository} invites
   * @param {{ send(message): Promise<void> }} mailer
   * @param {{ publicUrl?: string, staffAccessCode?: string, inviteDays?: number }} options
   */
  constructor(invites, mailer, { publicUrl = "", staffAccessCode = "", inviteDays = 7 } = {}) {
    this.invites = invites;
    this.mailer = mailer;
    this.publicUrl = publicUrl;
    this.sharedCode = staffAccessCode;
    this.inviteDays = inviteDays;
  }

  /** Only staff with the invite permission (the county administrator) may issue codes. */
  #requireInviter(admin) {
    if (!admin.canInvite) throw forbidden("Only the county administrator can issue approval codes.");
  }

  /** @returns {{ id, code, email, expiresAt }}  The code is shown to the admin once and never stored in readable form. */
  create(admin, input) {
    this.#requireInviter(admin);
    const { email } = validateInvite(input);
    const code = generateCode();
    const invite = this.invites.create({ codeHash: hash(code), email: email || null, createdBy: admin.name, expiresAt: Date.now() + this.inviteDays * 86_400_000 });
    if (email) {
      const message = staffInviteEmail({ code, link: `${this.publicUrl}/#/staff/register`, days: this.inviteDays, invitedBy: admin.name });
      this.mailer.send({ to: email, ...message }).catch((err) => console.error("Staff invitation email failed:", err.message));
    }
    return { id: invite.id, code, email: invite.email, expiresAt: invite.expiresAt };
  }

  list(admin) {
    this.#requireInviter(admin);
    return this.invites.listActive().map(({ id, email, createdBy, createdAt, expiresAt }) => ({ id, email, createdBy, createdAt, expiresAt }));
  }

  revoke(admin, id) {
    this.#requireInviter(admin);
    if (!this.invites.remove(id)) throw notFound("That code no longer exists.");
  }

  /** Is this code acceptable for this email? Returns a grant to pass to consume(), or null. Does not use the code up. */
  find(code, email) {
    const given = normalise(code);
    if (!given) return null;
    const invite = this.invites.findByHash(hash(given));
    if (invite && (!invite.email || invite.email === email)) return { type: "invite", id: invite.id };
    if (this.sharedCode && sameSecret(String(code).trim(), this.sharedCode)) return { type: "shared" };
    return null;
  }

  /** Use up a single-use code once the account has been created. */
  consume(grant) {
    if (grant.type === "invite") this.invites.remove(grant.id);
  }
}

module.exports = { StaffInviteService };
