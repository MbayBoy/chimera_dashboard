import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import ThresholdAlertService, { DEFAULT_THRESHOLDS, SEVERITY } from '../../services/thresholdAlertService';

const FUNCTION_NAMES = [
  'health-check', 'campaign-actions', 'server-actions', 'analytics-overview',
  'anomaly-remediate', 'verification-worker', 'backup-manager', 'intelligence-crawler',
  'campaign-dispatcher', 'bounce-processor', 'ai-governor', 'send-alert-email',
];

const Sparkline = ({ data = [] }) => {
  if (!data?.length) return <span className="text-xs text-muted-foreground">—</span>;
  const max = Math.max(...data, 1);
  const w = 60, h = 24;
  const pts = data?.map((v, i) => {
    const x = (i / (data?.length - 1 || 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  })?.join(' ');
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
    </svg>
  );
};

const StatusBadge = ({ rate, severity }) => {
  if (rate === null || rate === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = parseFloat(rate);
  let cls;
  if (severity === SEVERITY?.CRITICAL || pct > 10) cls = 'bg-error/10 text-error border-error/30';
  else if (severity === SEVERITY?.WARNING || pct > 5) cls = 'bg-warning/10 text-warning border-warning/30';
  else cls = 'bg-success/10 text-success border-success/30';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${cls}`}>{pct?.toFixed(1)}%</span>;
};

const SeverityBadge = ({ severity }) => {
  if (!severity || severity === SEVERITY?.OK) return null;
  let cls = severity === SEVERITY?.CRITICAL
    ? 'bg-error text-white animate-pulse' :'bg-warning text-white';
  return (
    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold uppercase ${cls}`}>
      {severity}
    </span>
  );
};

const ThresholdSettingsPanel = ({ onClose, userId }) => {
  const toast = useToast();
  const [rules, setRules] = useState(
    FUNCTION_NAMES?.map(fn => ({
      function_name: fn,
      error_rate_warning: DEFAULT_THRESHOLDS?.error_rate?.warning,
      error_rate_critical: DEFAULT_THRESHOLDS?.error_rate?.critical,
      exec_time_warning: DEFAULT_THRESHOLDS?.execution_time_ms?.warning,
      exec_time_critical: DEFAULT_THRESHOLDS?.execution_time_ms?.critical,
    }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase?.from('user_threshold_rules')?.select('*')?.eq('user_id', userId)?.then(({ data }) => {
      if (!data?.length) return;
      setRules(prev => prev?.map(r => {
        const errRule = data?.find(d => d?.function_name === r?.function_name && d?.metric === 'error_rate');
        const execRule = data?.find(d => d?.function_name === r?.function_name && d?.metric === 'execution_time_ms');
        return {
          ...r,
          error_rate_warning: errRule?.warning_threshold ?? r?.error_rate_warning,
          error_rate_critical: errRule?.critical_threshold ?? r?.error_rate_critical,
          exec_time_warning: execRule?.warning_threshold ?? r?.exec_time_warning,
          exec_time_critical: execRule?.critical_threshold ?? r?.exec_time_critical,
        };
      }));
    });
  }, [userId]);

  const handleSave = async () => {
    if (!userId) { toast?.error('Must be logged in to save rules'); return; }
    setSaving(true);
    try {
      for (const r of rules) {
        await ThresholdAlertService?.saveThresholdRule(userId, r?.function_name, 'error_rate', r?.error_rate_warning, r?.error_rate_critical);
        await ThresholdAlertService?.saveThresholdRule(userId, r?.function_name, 'execution_time_ms', r?.exec_time_warning, r?.exec_time_critical);
      }
      toast?.success('Threshold rules saved successfully');
      onClose();
    } catch (err) {
      toast?.error(err?.message || 'Failed to save rules');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (fn, field, value) => {
    setRules(prev => prev?.map(r => r?.function_name === fn ? { ...r, [field]: parseFloat(value) || 0 } : r));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Alert Threshold Rules</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Customize warning/critical thresholds per function</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-5 gap-2 px-2 py-1 text-xs font-medium text-muted-foreground mb-2">
            <span>Function</span>
            <span className="text-center">Err Rate Warn (%)</span>
            <span className="text-center">Err Rate Crit (%)</span>
            <span className="text-center">Exec Warn (ms)</span>
            <span className="text-center">Exec Crit (ms)</span>
          </div>
          <div className="space-y-1">
            {rules?.map(r => (
              <div key={r?.function_name} className="grid grid-cols-5 gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-muted/30">
                <span className="font-mono text-xs text-foreground truncate">{r?.function_name}</span>
                {[
                  { field: 'error_rate_warning', val: r?.error_rate_warning },
                  { field: 'error_rate_critical', val: r?.error_rate_critical },
                  { field: 'exec_time_warning', val: r?.exec_time_warning },
                  { field: 'exec_time_critical', val: r?.exec_time_critical },
                ]?.map(({ field, val }) => (
                  <input
                    key={field}
                    type="number"
                    value={val}
                    onChange={e => updateRule(r?.function_name, field, e?.target?.value)}
                    className="w-full text-center text-xs bg-muted border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary"
                    min="0"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="Info" size={12} />
            <span>Default: Error Rate Warn=5%, Crit=10% · Exec Warn=2000ms, Crit=5000ms</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemHealth = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [metrics, setMetrics] = useState({});
  const [thresholdMetrics, setThresholdMetrics] = useState({});
  const [alertCounts, setAlertCounts] = useState({ warnings: 0, criticals: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showThresholdPanel, setShowThresholdPanel] = useState(false);
  const channelRef = useRef(null);
  const toast = useToast();
  const { user } = useAuth();

  const loadMetrics = useCallback(async () => {
    try {
      const today = new Date();
      today?.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        ?.from('edge_function_logs')
        ?.select('function_name, execution_time_ms, status, error_message, created_at')
        ?.gte('created_at', today?.toISOString())
        ?.order('created_at', { ascending: false })
        ?.limit(2000);

      if (error) throw error;

      const byFn = {};
      FUNCTION_NAMES?.forEach(fn => {
        byFn[fn] = { invocations: 0, errors: 0, totalTime: 0, times: [], recentCounts: Array(10)?.fill(0) };
      });

      (data || [])?.forEach(row => {
        const fn = row?.function_name;
        if (!byFn?.[fn]) byFn[fn] = { invocations: 0, errors: 0, totalTime: 0, times: [], recentCounts: Array(10)?.fill(0) };
        byFn[fn].invocations++;
        if (row?.status === 'error') byFn[fn].errors++;
        if (row?.execution_time_ms) {
          byFn[fn].totalTime += row?.execution_time_ms;
          byFn?.[fn]?.times?.push(row?.execution_time_ms);
        }
      });

      const nowMs = Date.now();
      const startMs = today?.getTime();
      const bucketSize = (nowMs - startMs) / 10;
      (data || [])?.forEach(row => {
        const fn = row?.function_name;
        if (!byFn?.[fn]) return;
        const idx = Math.min(9, Math.floor((new Date(row.created_at)?.getTime() - startMs) / bucketSize));
        if (idx >= 0) byFn[fn].recentCounts[idx]++;
      });

      const computed = {};
      Object.entries(byFn)?.forEach(([fn, d]) => {
        computed[fn] = {
          invocations: d?.invocations,
          errors: d?.errors,
          errorRate: d?.invocations > 0 ? ((d?.errors / d?.invocations) * 100)?.toFixed(1) : '0.0',
          avgTime: d?.times?.length > 0 ? Math.round(d?.totalTime / d?.times?.length) : null,
          maxTime: d?.times?.length > 0 ? Math.max(...d?.times) : null,
          sparkline: d?.recentCounts,
        };
      });

      setMetrics(computed);
      setLastRefresh(new Date());
    } catch (err) {
      toast?.error(err?.message || 'Failed to load metrics', 'Metrics Error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        ?.from('edge_function_logs')
        ?.select('id, function_name, status, execution_time_ms, error_message, user_id, created_at')
        ?.order('created_at', { ascending: false })
        ?.limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      toast?.error(err?.message || 'Failed to load logs', 'Logs Error');
    }
  }, []);

  // Handle threshold service events
  const handleThresholdEvent = useCallback((event) => {
    if (event?.snapshot) setThresholdMetrics(event?.snapshot);
    if (event?.counts) setAlertCounts(event?.counts);
  }, []);

  useEffect(() => {
    loadMetrics();
    loadLogs();

    // Start threshold alert service
    ThresholdAlertService?.start(user?.id);
    const unsubscribe = ThresholdAlertService?.subscribe(handleThresholdEvent);

    const interval = setInterval(() => {
      loadMetrics();
      loadLogs();
    }, 30000);

    channelRef.current = supabase
      ?.channel('edge_function_logs_rt')
      ?.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'edge_function_logs' }, (payload) => {
        setLogs(prev => [payload?.new, ...prev?.slice(0, 99)]);
        loadMetrics();
      })
      ?.subscribe();

    return () => {
      clearInterval(interval);
      if (channelRef?.current) channelRef?.current?.unsubscribe();
      unsubscribe();
      ThresholdAlertService?.stop();
    };
  }, [loadMetrics, loadLogs, handleThresholdEvent, user?.id]);

  // Summary stats
  const allMetrics = Object.values(metrics);
  const totalInvocations = allMetrics?.reduce((s, m) => s + (m?.invocations || 0), 0);
  const totalErrors = allMetrics?.reduce((s, m) => s + (m?.errors || 0), 0);
  const overallErrorRate = totalInvocations > 0 ? ((totalErrors / totalInvocations) * 100)?.toFixed(1) : '0.0';
  const avgTimes = allMetrics?.filter(m => m?.avgTime)?.map(m => m?.avgTime);
  const overallAvgTime = avgTimes?.length > 0 ? Math.round(avgTimes?.reduce((s, t) => s + t, 0) / avgTimes?.length) : null;
  const slowestFn = Object.entries(metrics)?.sort((a, b) => (b?.[1]?.avgTime || 0) - (a?.[1]?.avgTime || 0))?.[0];

  const summaryCards = [
    { label: 'Total Invocations Today', value: totalInvocations?.toLocaleString(), icon: 'Activity', color: 'text-primary' },
    { label: 'Avg Execution Time', value: overallAvgTime ? `${overallAvgTime}ms` : '—', icon: 'Timer', color: 'text-info' },
    { label: 'Overall Error Rate', value: `${overallErrorRate}%`, icon: 'AlertTriangle', color: parseFloat(overallErrorRate) > 5 ? 'text-error' : 'text-success' },
    { label: 'Slowest Function', value: slowestFn ? slowestFn?.[0] : '—', icon: 'TrendingDown', color: 'text-warning', small: true },
  ];

  const getRowHighlight = (fn) => {
    const tm = thresholdMetrics?.[fn];
    if (!tm) return '';
    if (tm?.overallSeverity === SEVERITY?.CRITICAL) return 'bg-error/8 border-l-2 border-l-error';
    if (tm?.overallSeverity === SEVERITY?.WARNING) return 'bg-warning/8 border-l-2 border-l-warning';
    return '';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header alertCounts={alertCounts} />
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} alertCounts={alertCounts} />
      <main className={`pt-20 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <Breadcrumbs />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-heading font-semibold text-foreground">System Health</h1>
                  {alertCounts?.total > 0 && (
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border animate-pulse ${alertCounts?.criticals > 0 ? 'bg-error/10 text-error border-error/30' : 'bg-warning/10 text-warning border-warning/30'}`}>
                      <Icon name="AlertTriangle" size={12} />
                      {alertCounts?.criticals > 0 ? `${alertCounts?.criticals} CRITICAL` : `${alertCounts?.warnings} WARNING`}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">Edge function metrics, error rates, and real-time execution logs</p>
              </div>
              <div className="flex items-center gap-3">
                {lastRefresh && (
                  <span className="text-xs text-muted-foreground">
                    Last updated: {lastRefresh?.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => setShowThresholdPanel(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm text-foreground transition-colors"
                >
                  <Icon name="Settings2" size={14} />
                  Thresholds
                </button>
                <button
                  onClick={() => { loadMetrics(); loadLogs(); }}
                  className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm text-foreground transition-colors"
                >
                  <Icon name="RefreshCw" size={14} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {summaryCards?.map(card => (
              <div key={card?.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={card?.icon} size={14} className={card?.color} />
                  <span className="text-xs text-muted-foreground">{card?.label}</span>
                </div>
                <div className={`font-bold font-mono text-foreground ${card?.small ? 'text-sm truncate' : 'text-2xl'}`}>
                  {loading ? '—' : card?.value}
                </div>
              </div>
            ))}
          </div>

          {/* Alert Summary Row */}
          {alertCounts?.total > 0 && (
            <div className={`mb-6 p-4 rounded-xl border flex items-center gap-4 ${alertCounts?.criticals > 0 ? 'bg-error/5 border-error/30' : 'bg-warning/5 border-warning/30'}`}>
              <Icon name="AlertOctagon" size={20} className={alertCounts?.criticals > 0 ? 'text-error' : 'text-warning'} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${alertCounts?.criticals > 0 ? 'text-error' : 'text-warning'}`}>
                  {alertCounts?.criticals > 0 ? `${alertCounts?.criticals} function(s) in CRITICAL state` : `${alertCounts?.warnings} function(s) in WARNING state`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Threshold breaches detected in the last 15 minutes. Highlighted rows below.
                </p>
              </div>
              <div className="flex gap-3 text-xs">
                {alertCounts?.criticals > 0 && <span className="px-2 py-1 bg-error/10 text-error border border-error/30 rounded-full font-medium">{alertCounts?.criticals} Critical</span>}
                {alertCounts?.warnings > 0 && <span className="px-2 py-1 bg-warning/10 text-warning border border-warning/30 rounded-full font-medium">{alertCounts?.warnings} Warning</span>}
              </div>
            </div>
          )}

          {/* Function Metrics Table */}
          <div className="bg-card border border-border rounded-xl mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">Edge Function Metrics</h2>
                {alertCounts?.total > 0 && (
                  <span className="text-xs text-muted-foreground">Highlighted rows have active threshold breaches</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">Today's data</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Function</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Invocations</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Errors</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Error Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Avg Time</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Max Time</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Alert</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNCTION_NAMES?.map(fn => {
                    const m = metrics?.[fn] || {};
                    const tm = thresholdMetrics?.[fn];
                    const rowHighlight = getRowHighlight(fn);
                    return (
                      <tr key={fn} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${rowHighlight}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-foreground bg-muted px-2 py-0.5 rounded">{fn}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {loading ? '—' : (m?.invocations || 0)?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-error">
                          {loading ? '—' : (m?.errors || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {loading ? '—' : <StatusBadge rate={m?.errorRate} severity={tm?.errorRateSeverity} />}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">
                          {loading ? '—' : m?.avgTime ? (
                            <span className={tm?.execTimeSeverity === SEVERITY?.CRITICAL ? 'text-error font-bold' : tm?.execTimeSeverity === SEVERITY?.WARNING ? 'text-warning' : ''}>
                              {m?.avgTime}ms
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">
                          {loading ? '—' : m?.maxTime ? `${m?.maxTime}ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tm?.overallSeverity && tm?.overallSeverity !== SEVERITY?.OK ? (
                            <SeverityBadge severity={tm?.overallSeverity} />
                          ) : (
                            <span className="text-xs text-success">✓</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {loading ? '—' : <Sparkline data={m?.sparkline} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time Log Feed */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Real-time Execution Logs</h2>
                <span className="flex items-center gap-1 text-xs text-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
                  Live
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{logs?.length} entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Function</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Exec Time</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs?.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No logs yet. Logs will appear here as edge functions are invoked.
                      </td>
                    </tr>
                  )}
                  {logs?.map((log, i) => (
                    <tr key={log?.id || i} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {log?.created_at ? new Date(log.created_at)?.toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{log?.function_name || '—'}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-medium border ${
                          log?.status === 'error' ? 'bg-error/10 text-error border-error/30' : 'bg-success/10 text-success border-success/30'
                        }`}>
                          {log?.status || 'ok'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                        {log?.execution_time_ms ? `${log?.execution_time_ms}ms` : '—'}
                      </td>
                      <td className="px-4 py-2 text-error max-w-xs truncate">
                        {log?.error_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      {showThresholdPanel && (
        <ThresholdSettingsPanel onClose={() => setShowThresholdPanel(false)} userId={user?.id} />
      )}
    </div>
  );
};

export default SystemHealth;
