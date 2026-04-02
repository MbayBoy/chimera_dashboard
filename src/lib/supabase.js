import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. Check your .env file.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-app-name': 'chimera' },
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller?.abort(), 30000);
        return fetch(url, { ...options, signal: controller?.signal })?.finally(() => clearTimeout(timeoutId));
      },
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);

// ============================================================
// IN-MEMORY CACHE (60s TTL)
// ============================================================
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

export const cacheGet = (key) => {
  const entry = cache?.get(key);
  if (!entry) return null;
  if (Date.now() - entry?.timestamp > CACHE_TTL) {
    cache?.delete(key);
    return null;
  }
  return entry?.data;
};

export const cacheSet = (key, data) => {
  cache?.set(key, { data, timestamp: Date.now() });
};

export const cacheInvalidate = (key) => {
  if (key) {
    cache?.delete(key);
  } else {
    cache?.clear();
  }
};

export const cacheInvalidatePattern = (pattern) => {
  for (const key of cache?.keys()) {
    if (key?.includes(pattern)) cache?.delete(key);
  }
};

// ============================================================
// DEBOUNCE UTILITY
// ============================================================
export const debounce = (fn, delay = 500) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// ============================================================
// BATCH OPERATIONS (chunks of 100)
// ============================================================
export const batchInsert = async (table, records, chunkSize = 100) => {
  const results = [];
  for (let i = 0; i < records?.length; i += chunkSize) {
    const chunk = records?.slice(i, i + chunkSize);
    const { data, error } = await supabase?.from(table)?.insert(chunk)?.select();
    if (error) throw error;
    results?.push(...(data || []));
  }
  return results;
};

export const batchUpdate = async (table, records, idField = 'id', chunkSize = 100) => {
  const results = [];
  for (let i = 0; i < records?.length; i += chunkSize) {
    const chunk = records?.slice(i, i + chunkSize);
    for (const record of chunk) {
      const { id, ...updates } = record;
      const { data, error } = await supabase?.from(table)?.update(updates)?.eq(idField, record?.[idField])?.select()?.single();
      if (error) throw error;
      results?.push(data);
    }
  }
  return results;
};

export const batchDelete = async (table, ids, idField = 'id', chunkSize = 100) => {
  for (let i = 0; i < ids?.length; i += chunkSize) {
    const chunk = ids?.slice(i, i + chunkSize);
    const { error } = await supabase?.from(table)?.delete()?.in(idField, chunk);
    if (error) throw error;
  }
};
