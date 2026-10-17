/** Sliding one-minute window per key (e.g. client IP + action). In-memory: fine for a single server process. */
class RateLimiter {
  constructor(limitPerMinute) {
    this.limit = limitPerMinute;
    this.hits = new Map();
  }

  /** Records an attempt and returns true when the caller is over the limit. */
  hit(key) {
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((t) => now - t < 60_000);
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.#sweep(now);
    return recent.length > this.limit;
  }

  #sweep(now) {
    for (const [key, times] of this.hits) if (now - times[times.length - 1] > 60_000) this.hits.delete(key);
  }
}

module.exports = { RateLimiter };
