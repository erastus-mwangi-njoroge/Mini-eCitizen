/**
 * Persistence for password-reset tokens. Only a SHA-256 hash of each token is stored,
 * so a leaked database file cannot be used to take over accounts.
 */
class ResetTokenRepository {
  constructor(store) {
    this.store = store;
  }

  #all() {
    return this.store.data.resetTokens;
  }

  /** Replaces any earlier token for the same user (only the newest link works). */
  create(userId, tokenHash, expiresAt) {
    const kept = this.#all().filter((t) => t.userId !== userId && t.expiresAt > Date.now());
    this.store.data.resetTokens = [...kept, { userId, tokenHash, expiresAt, createdAt: Date.now() }];
    this.store.save();
  }

  /** The unexpired token record for this hash, or null. */
  find(tokenHash) {
    return this.#all().find((t) => t.tokenHash === tokenHash && t.expiresAt > Date.now()) || null;
  }

  latestCreatedAt(userId) {
    const mine = this.#all().filter((t) => t.userId === userId);
    return mine.length ? Math.max(...mine.map((t) => t.createdAt)) : 0;
  }

  removeForUser(userId) {
    this.store.data.resetTokens = this.#all().filter((t) => t.userId !== userId);
    this.store.save();
  }
}

module.exports = { ResetTokenRepository };
