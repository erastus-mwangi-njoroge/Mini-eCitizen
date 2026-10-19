const crypto = require("crypto");

/** Persistence for staff approval codes. Only a hash of each code is stored, so the file cannot be used to register. */
class StaffInviteRepository {
  constructor(store) {
    this.store = store;
  }

  #all() {
    return this.store.data.staffInvites;
  }

  create({ codeHash, email, createdBy, expiresAt }) {
    const invite = { id: crypto.randomUUID(), codeHash, email, createdBy, createdAt: Date.now(), expiresAt };
    this.#all().push(invite);
    this.store.save();
    return invite;
  }

  findByHash(codeHash) {
    return this.#all().find((i) => i.codeHash === codeHash && i.expiresAt > Date.now()) || null;
  }

  /** Unexpired codes, newest first. */
  listActive() {
    return this.#all().filter((i) => i.expiresAt > Date.now()).sort((a, b) => b.createdAt - a.createdAt);
  }

  remove(id) {
    const before = this.#all().length;
    this.store.data.staffInvites = this.#all().filter((i) => i.id !== id);
    this.store.save();
    return this.#all().length < before;
  }
}

module.exports = { StaffInviteRepository };
