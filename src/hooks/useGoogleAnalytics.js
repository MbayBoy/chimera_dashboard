import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_ID = import.meta.env?.VITE_GA_MEASUREMENT_ID;

function initGA() {
  if (!GA_ID || GA_ID === 'your-google-analytics-id-here') return;
  if (window.__gaInitialized) return;
  window.__gaInitialized = true;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  script.async = true;
  document.head?.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer?.push(...arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: false });
}

export function trackEvent(eventName, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

export function trackFunctionExecution(functionName, executionTimeMs, status) {
  trackEvent('function_execution', {
    function_name: functionName,
    execution_time_ms: executionTimeMs,
    status,
  });
}

export function trackSystemError(functionName, errorType, errorRate) {
  trackEvent('system_error', {
    function_name: functionName,
    error_type: errorType,
    error_rate: errorRate,
  });
}

export function trackDatabaseLatency(responseTimeMs) {
  trackEvent('database_latency', { response_time_ms: responseTimeMs });
}

export function trackUptimeCheck(component, status, responseTime) {
  trackEvent('uptime_check', {
    component,
    status,
    response_time: responseTime,
  });
}

export function trackIncident(incidentId, severity, action) {
  trackEvent('incident_event', {
    incident_id: incidentId,
    severity,
    action,
  });
}

export function useGoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location?.pathname + location?.search,
    });
  }, [location]);
}

export default useGoogleAnalytics;
