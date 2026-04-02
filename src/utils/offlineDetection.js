// ============================================================
// OFFLINE DETECTION & CACHED DATA UTILITY
// ============================================================

const OFFLINE_CACHE_PREFIX = 'chimera_offline_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Save data to localStorage for offline fallback
 */
export const saveOfflineCache = (key, data) => {
  try {
    localStorage.setItem(OFFLINE_CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // localStorage might be full or unavailable
    console.warn('[OfflineCache] Failed to save cache:', e?.message);
  }
};

/**
 * Load cached data from localStorage (returns null if expired or missing)
 */
export const loadOfflineCache = (key, maxAgeMs = CACHE_TTL_MS) => {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > maxAgeMs) return null;
    return data;
  } catch (e) {
    return null;
  }
};

/**
 * Check if browser is online
 */
export const isOnline = () => navigator?.onLine !== false;

/**
 * Subscribe to online/offline events
 * Returns an unsubscribe function
 */
export const subscribeToNetworkStatus = (onOnline, onOffline) => {
  const handleOnline = () => onOnline?.();
  const handleOffline = () => onOffline?.();
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * Wrap a Supabase async call with try-catch, offline detection, and cache fallback.
 * @param {Function} fn - async function that returns data
 * @param {string} cacheKey - key for offline cache
 * @param {Function} onError - callback(errorMessage) for toast display
 * @param {number} maxAgeMs - max cache age in ms
 */
export const withOfflineFallback = async (fn, cacheKey, onError, maxAgeMs = CACHE_TTL_MS) => {
  if (!isOnline()) {
    const cached = loadOfflineCache(cacheKey, maxAgeMs);
    if (cached) {
      onError?.('You are offline. Showing cached data.');
      return { data: cached, fromCache: true };
    }
    onError?.('You are offline and no cached data is available.');
    return { data: null, fromCache: true, error: 'offline' };
  }

  try {
    const data = await fn();
    if (data !== null && data !== undefined) {
      saveOfflineCache(cacheKey, data);
    }
    return { data, fromCache: false };
  } catch (err) {
    const cached = loadOfflineCache(cacheKey, maxAgeMs * 6); // allow stale cache on error
    if (cached) {
      onError?.(`Connection error. Showing cached data. (${err?.message})`);
      return { data: cached, fromCache: true, error: err?.message };
    }
    onError?.(err?.message || 'Failed to load data');
    return { data: null, fromCache: false, error: err?.message };
  }
};

export default { saveOfflineCache, loadOfflineCache, isOnline, subscribeToNetworkStatus, withOfflineFallback };
