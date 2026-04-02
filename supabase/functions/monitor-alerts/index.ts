import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { corsHeaders } from '../_shared/middleware.ts';

declare const Deno: any;

const SUPABASE_URL = Deno?.env?.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ALERT_EMAIL = Deno?.env?.get('ALERT_EMAIL') || 'info@leadsconsult.co.za';
const RESEND_API_KEY = Deno?.env?.get('RESEND_API_KEY') || '';

const ERROR_RATE_THRESHOLD = 5.0; // %
const EXECUTION_TIME_THRESHOLD_MS = 2000; // 2 seconds
const COOLDOWN_MINUTES = 30;
const WINDOW_MINUTES = 15;

interface FunctionMetrics {
  function_name: string;
  total: number;
  errors: number;
  avg_ms: number;
  error_rate: number;
}

interface AlertState {
  function_name: string;
  alert_sent_at: string | null;
  alert_type: string | null;
}

async function supabaseQuery(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sendAlertEmail(subject: string, message: string, severity: string, functionName: string) {
  if (!RESEND_API_KEY) {
    console.warn('[monitor-alerts] RESEND_API_KEY not set, skipping email');
    return;
  }
  const severityColor = severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: ${severityColor}; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px; color: white;">🚨 Chimera Alert: ${severity}</h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Edge Function Monitor</p>
      </div>
      <div style="padding: 24px;">
        <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">${message}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 6px 0; color: #64748b;">Function</td><td style="color: #e2e8f0; font-family: monospace;">${functionName}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Severity</td><td style="color: ${severityColor}; font-weight: bold;">${severity}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Timestamp</td><td style="color: #e2e8f0;">${new Date().toLocaleString()}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Cooldown</td><td style="color: #e2e8f0;">Next alert in ${COOLDOWN_MINUTES} minutes</td></tr>
        </table>
      </div>
      <div style="padding: 16px 24px; background: #1e293b; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #475569;">Chimera Email Intelligence Platform — Automated Alert System</p>
      </div>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'alerts@leadsconsult.co.za', to: [ALERT_EMAIL], subject, html: htmlBody }),
  });
}

async function logAlert(message: string, level = 'CRITICAL') {
  try {
    await supabaseQuery('system_logs', {
      method: 'POST',
      body: JSON.stringify({ log_level: level, source: 'MonitorAlerts', message, log_timestamp: new Date().toISOString() }),
    });
  } catch (e) {
    console.error('[monitor-alerts] Failed to log:', e);
  }
}

serve(async (req) => {
  if (req?.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    // Fetch recent edge function logs
    const logs = await supabaseQuery(
      `edge_function_logs?select=function_name,status,execution_time_ms&created_at=gte.${windowStart}`
    );

    // Aggregate metrics per function
    const metricsMap: Record<string, FunctionMetrics> = {};
    for (const log of (logs || [])) {
      const fn = log.function_name;
      if (!metricsMap[fn]) metricsMap[fn] = { function_name: fn, total: 0, errors: 0, avg_ms: 0, error_rate: 0 };
      metricsMap[fn].total++;
      if (log.status === 'error') metricsMap[fn].errors++;
      if (log.execution_time_ms) metricsMap[fn].avg_ms += log.execution_time_ms;
    }
    Object.values(metricsMap).forEach(m => {
      m.error_rate = m.total > 0 ? (m.errors / m.total) * 100 : 0;
      m.avg_ms = m.total > 0 ? m.avg_ms / m.total : 0;
    });

    // Fetch current alert states
    const alertStates: AlertState[] = await supabaseQuery('function_alert_state?select=function_name,alert_sent_at,alert_type');
    const stateMap: Record<string, AlertState> = {};
    for (const s of (alertStates || [])) stateMap[s.function_name] = s;

    const alertsTriggered: string[] = [];
    const now = Date.now();

    for (const metrics of Object.values(metricsMap)) {
      const state = stateMap[metrics.function_name];
      const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
      const inCooldown = state?.alert_sent_at && (now - new Date(state.alert_sent_at).getTime()) < cooldownMs;

      if (inCooldown) continue;

      let shouldAlert = false;
      let alertType = '';
      let alertMessage = '';
      let severity = 'WARNING';

      if (metrics.error_rate > ERROR_RATE_THRESHOLD) {
        shouldAlert = true;
        alertType = 'error_rate';
        severity = metrics.error_rate > 10 ? 'CRITICAL' : 'WARNING';
        alertMessage = `Function "${metrics.function_name}" error rate is ${metrics.error_rate.toFixed(1)}% in the last ${WINDOW_MINUTES} minutes (${metrics.errors}/${metrics.total} requests failed). Threshold: ${ERROR_RATE_THRESHOLD}%.`;
      } else if (metrics.avg_ms > EXECUTION_TIME_THRESHOLD_MS) {
        shouldAlert = true;
        alertType = 'execution_time';
        severity = metrics.avg_ms > 5000 ? 'CRITICAL' : 'WARNING';
        alertMessage = `Function "${metrics.function_name}" average execution time is ${Math.round(metrics.avg_ms)}ms in the last ${WINDOW_MINUTES} minutes. Threshold: ${EXECUTION_TIME_THRESHOLD_MS}ms.`;
      }

      if (shouldAlert) {
        // Send email alert
        await sendAlertEmail(
          `[${severity}] Chimera: ${metrics.function_name} threshold breach`,
          alertMessage,
          severity,
          metrics.function_name
        );

        // Log to system_logs
        await logAlert(alertMessage, severity);

        // Upsert alert state
        await supabaseQuery('function_alert_state', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({
            function_name: metrics.function_name,
            last_error_rate: metrics.error_rate,
            last_avg_execution_ms: metrics.avg_ms,
            alert_sent_at: new Date().toISOString(),
            alert_type: alertType,
            updated_at: new Date().toISOString(),
          }),
        });

        alertsTriggered.push(metrics.function_name);
      } else {
        // Update metrics without alerting
        await supabaseQuery('function_alert_state', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({
            function_name: metrics.function_name,
            last_error_rate: metrics.error_rate,
            last_avg_execution_ms: metrics.avg_ms,
            updated_at: new Date().toISOString(),
          }),
        });
      }
    }

    // Check Supabase health (simple connectivity test)
    try {
      const healthRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: { 'apikey': SERVICE_ROLE_KEY },
        signal: AbortSignal.timeout(5000),
      });
      if (!healthRes.ok) throw new Error(`Health check returned ${healthRes.status}`);
    } catch (healthErr: any) {
      const unreachableMsg = `Supabase API appears unreachable: ${healthErr.message}`;
      await sendAlertEmail('[CRITICAL] Supabase Unreachable', unreachableMsg, 'CRITICAL', 'supabase-api');
      await logAlert(unreachableMsg, 'CRITICAL');
    }

    await logAlert(`Monitor alerts check complete. ${alertsTriggered.length} alerts triggered.`, 'INFO');

    return new Response(JSON.stringify({
      success: true,
      checked: Object.keys(metricsMap).length,
      alertsTriggered,
      timestamp: new Date().toISOString(),
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    console.error('[monitor-alerts] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
