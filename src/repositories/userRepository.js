const crypto = require("crypto");

/** Persistence for user accounts (citizens and admins). Knows nothing about passwords or rules. */
class UserRepository {
  constructor(store) {
    this.store = store;
  }

  findById(id) {
    return this.store.data.users.find((u) => u.id === id) || null;
  }

  findByEmail(email) {
    return this.store.data.users.find((u) => u.email === email) || null;
  }

  hasAdmin() {
    return this.store.data.users.some((u) => u.role === "admin");
  }

  /** Persist changes made to a user object obtained from this repository. */
  save() {
    this.store.save();
  }

  hasOwner() {
    return this.store.data.users.some((u) => u.isOwner);
  }

  create(fields) {
    const user = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...fields };
    this.store.data.users.push(user);
    this.store.save();
    return user;
  }
}

module.exports = { UserRepository };
