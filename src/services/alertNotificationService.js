import { supabase } from '../lib/supabase';

const ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

let logsChannel = null;
let anomaliesChannel = null;
let toastCallback = null;
let alertCallback = null;

// Request browser notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

// Show browser push notification
const showBrowserNotification = (title, body, icon = '/favicon.ico') => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon, tag: 'chimera-alert' });
  } catch (e) {
    console.warn('[AlertService] Browser notification failed:', e?.message);
  }
};

// Send email via Supabase edge function using supabase.functions.invoke
const sendAlertEmail = async (alertData) => {
  try {
    const { data: { session } } = await supabase?.auth?.getSession();
    const userEmail = session?.user?.email || import.meta.env?.VITE_ALERT_EMAIL || 'info@leadsconsult.co.za';

    // Check user email notification preference (only if logged in)
    if (session?.user?.id) {
      const { data: profile } = await supabase
        ?.from('user_profiles')
        ?.select('email_notifications_enabled')
        ?.eq('id', session?.user?.id)
        ?.single();

      if (profile?.email_notifications_enabled === false) return;
    }

    const { error } = await supabase?.functions?.invoke('send-alert-email', {
      body: {
        to: userEmail,
        subject: `[CRITICAL] Chimera Alert: ${alertData?.title}`,
        message: alertData?.message,
        severity: alertData?.severity,
        source: alertData?.source,
        timestamp: alertData?.timestamp,
      },
    });

    if (error) throw error;

    // Log notification to system_logs
    await supabase?.from('system_logs')?.insert({
      log_level: 'INFO',
      source: 'AlertNotificationService',
      message: `Email alert sent to ${userEmail}: ${alertData?.title}`,
      log_timestamp: new Date()?.toISOString(),
    });
  } catch (err) {
    console.warn('[AlertService] Email send failed:', err?.message);
  }
};

// Register callbacks
export const setToastCallback = (cb) => { toastCallback = cb; };
export const setAlertCallback = (cb) => { alertCallback = cb; };

// Start subscriptions
export const startAlertSubscriptions = () => {
  // Subscribe to system_logs for CRITICAL/ERROR/WARN
  logsChannel = supabase
    ?.channel('alert_system_logs')
    ?.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'system_logs',
    }, (payload) => {
      const log = payload?.new;
      const level = log?.log_level;
      if (!['CRITICAL', 'ERROR', 'WARN']?.includes(level)) return;

      const alertData = {
        id: log?.id,
        title: `${level}: ${log?.source || 'System'}`,
        message: log?.message,
        severity: level,
        source: log?.source,
        timestamp: log?.log_timestamp || new Date()?.toISOString(),
        type: 'system_log',
      };

      // Notify alert callback (War Room panel update)
      alertCallback?.(alertData);

      if (level === 'CRITICAL') {
        showBrowserNotification(`🚨 CRITICAL: ${log?.source}`, log?.message);
        toastCallback?.('error', log?.message, `CRITICAL: ${log?.source}`);
        sendAlertEmail(alertData);
      } else if (level === 'ERROR') {
        toastCallback?.('error', log?.message, `ERROR: ${log?.source}`, 6000);
      } else if (level === 'WARN') {
        toastCallback?.('warning', log?.message, `Warning: ${log?.source}`);
      }
    })
    ?.subscribe();

  // Subscribe to anomalies for Critical/High
  anomaliesChannel = supabase
    ?.channel('alert_anomalies')
    ?.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'anomalies',
    }, (payload) => {
      const anomaly = payload?.new;
      const severity = anomaly?.severity;
      if (!['Critical', 'High']?.includes(severity)) return;

      const alertData = {
        id: anomaly?.id,
        title: anomaly?.title || `${severity} Anomaly Detected`,
        message: anomaly?.description || `${anomaly?.anomaly_type} anomaly detected`,
        severity,
        source: 'AnomalyDetector',
        timestamp: anomaly?.detected_at || new Date()?.toISOString(),
        type: 'anomaly',
      };

      alertCallback?.(alertData);

      if (severity === 'Critical') {
        showBrowserNotification(`🔴 Critical Anomaly: ${anomaly?.title}`, anomaly?.description || '');
        toastCallback?.('error', anomaly?.description || anomaly?.title, `Critical Anomaly: ${anomaly?.anomaly_type}`);
        sendAlertEmail(alertData);
      } else if (severity === 'High') {
        toastCallback?.('warning', anomaly?.description || anomaly?.title, `High Anomaly: ${anomaly?.anomaly_type}`);
      }
    })
    ?.subscribe();

  return () => stopAlertSubscriptions();
};

export const stopAlertSubscriptions = () => {
  logsChannel?.unsubscribe?.();
  anomaliesChannel?.unsubscribe?.();
  logsChannel = null;
  anomaliesChannel = null;
};

export default {
  requestNotificationPermission,
  startAlertSubscriptions,
  stopAlertSubscriptions,
  setToastCallback,
  setAlertCallback,
};
