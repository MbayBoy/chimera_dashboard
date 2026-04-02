/**
 * Simple in-memory cache with TTL (Time To Live)
 * Useful for caching RBL results, DNS lookups, etc.
 */
class Cache {
  constructor(defaultTTL = 60000) { // Default 60 seconds
    this.store = new Map();
    this.defaultTTL = defaultTTL;

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set(key, value, ttl = this.defaultTTL) {
    this.store?.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  get(key) {
    const entry = this.store?.get(key);
    if (!entry) return null;

    if (Date.now() > entry?.expiresAt) {
      this.store?.delete(key);
      return null;
    }

    return entry?.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.store?.delete(key);
  }

  clear() {
    this.store?.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store?.entries()) {
      if (now > entry?.expiresAt) {
        this.store?.delete(key);
      }
    }
  }

  get size() {
    return this.store?.size;
  }
}

// Export singleton instances for different use cases
module.exports = {
  rblCache: new Cache(5 * 60 * 1000),    // 5 min TTL for RBL results
  dnsCache: new Cache(10 * 60 * 1000),   // 10 min TTL for DNS results
  generalCache: new Cache(60 * 1000),    // 1 min TTL general
  Cache
};
