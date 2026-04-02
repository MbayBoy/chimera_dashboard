/**
 * ThresholdAlertService
 * Monitors edge_function_logs in real-time via Supabase subscription.
 * Emits threshold breach events for UI components to react to.
 */

import { supabase } from '../lib/supabase';

// Default threshold rules
export const DEFAULT_THRESHOLDS = {
  error_rate: { warning: 5, critical: 10 },      // %
  execution_time_ms: { warning: 2000, critical: 5000 }, // ms
};

export const SEVERITY = {
  OK: 'ok',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

// In-memory metrics store per function (rolling 15-minute window)
const functionMetrics = {};
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Event listeners
const listeners = new Set();

let channel = null;
let isRunning = false;
let userThresholds = {}; // { functionName: { error_rate: { warning, critical }, execution_time_ms: { warning, critical } } }

/**
 * Compute severity level for a metric value
 */
export function getSeverity(metricName, value, functionName = null) {
  const rules = (functionName && userThresholds?.[functionName]?.[metricName])
    || DEFAULT_THRESHOLDS?.[metricName];
  if (!rules) return SEVERITY?.OK;
  if (value >= rules?.critical) return SEVERITY?.CRITICAL;
  if (value >= rules?.warning) return SEVERITY?.WARNING;
  return SEVERITY?.OK;
}

/**
 * Get current metrics snapshot for all functions
 */
export function getMetricsSnapshot() {
  const now = Date.now();
  const snapshot = {};

  for (const [fn, entries] of Object.entries(functionMetrics)) {
    const recent = entries?.filter(e => now - e?.ts < WINDOW_MS);
    functionMetrics[fn] = recent; // prune old entries

    const total = recent?.length;
    const errors = recent?.filter(e => e?.status === 'error')?.length;
    const times = recent?.filter(e => e?.exec_ms)?.map(e => e?.exec_ms);
    const avgTime = times?.length > 0 ? times?.reduce((a, b) => a + b, 0) / times?.length : 0;
    const errorRate = total > 0 ? (errors / total) * 100 : 0;

    const errorRateSeverity = getSeverity('error_rate', errorRate, fn);
    const execTimeSeverity = getSeverity('execution_time_ms', avgTime, fn);

    const overallSeverity =
      errorRateSeverity === SEVERITY?.CRITICAL || execTimeSeverity === SEVERITY?.CRITICAL
        ? SEVERITY?.CRITICAL
        : errorRateSeverity === SEVERITY?.WARNING || execTimeSeverity === SEVERITY?.WARNING
        ? SEVERITY?.WARNING
        : SEVERITY?.OK;

    snapshot[fn] = {
      total,
      errors,
      errorRate: parseFloat(errorRate?.toFixed(1)),
      avgTime: Math.round(avgTime),
      errorRateSeverity,
      execTimeSeverity,
      overallSeverity,
    };
  }

  return snapshot;
}

/**
 * Count total active warnings/criticals
 */
export function getAlertCounts() {
  const snapshot = getMetricsSnapshot();
  let warnings = 0;
  let criticals = 0;
  for (const m of Object.values(snapshot)) {
    if (m?.overallSeverity === SEVERITY?.CRITICAL) criticals++;
    else if (m?.overallSeverity === SEVERITY?.WARNING) warnings++;
  }
  return { warnings, criticals, total: warnings + criticals };
}

/**
 * Process a new log entry
 */
function processLogEntry(log) {
  const fn = log?.function_name;
  if (!fn) return;

  if (!functionMetrics?.[fn]) functionMetrics[fn] = [];
  functionMetrics?.[fn]?.push({
    ts: new Date(log.created_at || Date.now())?.getTime(),
    status: log?.status,
    exec_ms: log?.execution_time_ms,
  });

  // Prune old entries
  const now = Date.now();
  functionMetrics[fn] = functionMetrics?.[fn]?.filter(e => now - e?.ts < WINDOW_MS);

  // Emit update to listeners
  const snapshot = getMetricsSnapshot();
  const counts = getAlertCounts();
  emit({ type: 'metrics_update', snapshot, counts, triggeredBy: fn });
}

/**
 * Emit event to all listeners
 */
function emit(event) {
  for (const listener of listeners) {
    try { listener(event); } catch (e) { /* ignore */ }
  }
}

/**
 * Subscribe to threshold events
 * @param {Function} callback - Called with { type, snapshot, counts, triggeredBy }
 * @returns {Function} unsubscribe function
 */
export function subscribe(callback) {
  listeners?.add(callback);
  return () => listeners?.delete(callback);
}

/**
 * Load user threshold rules from Supabase
 */
export async function loadUserThresholds(userId) {
  if (!userId) return;
  try {
    const { data } = await supabase?.from('user_threshold_rules')?.select('*')?.eq('user_id', userId)?.eq('enabled', true);

    userThresholds = {};
    for (const rule of (data || [])) {
      if (!userThresholds?.[rule?.function_name]) userThresholds[rule.function_name] = {};
      userThresholds[rule.function_name][rule.metric] = {
        warning: rule?.warning_threshold,
        critical: rule?.critical_threshold,
      };
    }
  } catch (e) {
    console.warn('[ThresholdAlertService] Failed to load user thresholds:', e);
  }
}

/**
 * Save a threshold rule
 */
export async function saveThresholdRule(userId, functionName, metric, warningThreshold, criticalThreshold) {
  const { data, error } = await supabase?.from('user_threshold_rules')?.upsert({
      user_id: userId,
      function_name: functionName,
      metric,
      warning_threshold: warningThreshold,
      critical_threshold: criticalThreshold,
      enabled: true,
      updated_at: new Date()?.toISOString(),
    }, { onConflict: 'user_id,function_name,metric' })?.select()?.single();

  if (error) throw error;

  // Update local cache
  if (!userThresholds?.[functionName]) userThresholds[functionName] = {};
  userThresholds[functionName][metric] = { warning: warningThreshold, critical: criticalThreshold };

  return data;
}

/**
 * Seed initial metrics from recent logs (last 15 minutes)
 */
async function seedInitialMetrics() {
  try {
    const since = new Date(Date.now() - WINDOW_MS)?.toISOString();
    const { data } = await supabase?.from('edge_function_logs')?.select('function_name, status, execution_time_ms, created_at')?.gte('created_at', since)?.order('created_at', { ascending: true })?.limit(500);

    for (const log of (data || [])) {
      const fn = log?.function_name;
      if (!fn) continue;
      if (!functionMetrics?.[fn]) functionMetrics[fn] = [];
      functionMetrics?.[fn]?.push({
        ts: new Date(log.created_at)?.getTime(),
        status: log?.status,
        exec_ms: log?.execution_time_ms,
      });
    }

    const snapshot = getMetricsSnapshot();
    const counts = getAlertCounts();
    emit({ type: 'initial_load', snapshot, counts, triggeredBy: null });
  } catch (e) {
    console.warn('[ThresholdAlertService] Failed to seed metrics:', e);
  }
}

/**
 * Start the real-time monitoring service
 */
export async function start(userId = null) {
  if (isRunning) return;
  isRunning = true;

  if (userId) await loadUserThresholds(userId);
  await seedInitialMetrics();

  channel = supabase?.channel('threshold_monitor_logs')?.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'edge_function_logs',
    }, (payload) => {
      processLogEntry(payload?.new);
    })?.subscribe();
}

/**
 * Stop the monitoring service
 */
export function stop() {
  if (channel) {
    channel?.unsubscribe();
    channel = null;
  }
  isRunning = false;
  listeners?.clear();
}

export default { start, stop, subscribe, getMetricsSnapshot, getAlertCounts, saveThresholdRule, loadUserThresholds, DEFAULT_THRESHOLDS, SEVERITY };
