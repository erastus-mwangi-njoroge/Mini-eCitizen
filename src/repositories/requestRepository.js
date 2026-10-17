const crypto = require("crypto");

/** Persistence for service requests. Filtering and sorting live in the service, not here. */
class RequestRepository {
  constructor(store) {
    this.store = store;
  }

  all() {
    return this.store.data.requests;
  }

  findById(id) {
    return this.all().find((r) => r.id === id) || null;
  }

  findByRef(ref) {
    return this.all().find((r) => r.ref === ref) || null;
  }

  /** Adds a request and gives it the next reference number, e.g. SR-2026-00042. */
  create(fields) {
    const sequence = ++this.store.data.counters.request;
    const now = new Date().toISOString();
    const request = {
      id: crypto.randomUUID(),
      ref: `SR-${new Date().getFullYear()}-${String(sequence).padStart(5, "0")}`,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      ...fields,
    };
    this.all().push(request);
    this.store.save();
    return request;
  }

  /** Persist changes made to a request object obtained from this repository. */
  save() {
    this.store.save();
  }
}

module.exports = { RequestRepository };
