import { useState, useEffect, useCallback, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import FunctionDetailPanel from './components/FunctionDetailPanel';
import useGoogleAnalytics, { trackUptimeCheck, trackDatabaseLatency, trackFunctionExecution, trackSystemError } from '../../hooks/useGoogleAnalytics';

const FUNCTION_NAMES = [
  'health-check', 'campaign-actions', 'server-actions', 'analytics-overview',
  'anomaly-remediate', 'verification-worker', 'backup-manager', 'intelligence-crawler',
  'campaign-dispatcher', 'bounce-processor', 'ai-governor', 'send-alert-email',
];

const STATUS_COLORS = {
  operational: 'text-success',
  degraded: 'text-warning',
  down: 'text-error',
};

const STATUS_BG = {
  operational: 'bg-success/10 border-success/30 text-success',
  degraded: 'bg-warning/10 border-warning/30 text-warning',
  down: 'bg-error/10 border-error/30 text-error',
};

const STATUS_DOT = {
  operational: 'bg-success',
  degraded: 'bg-warning',
  down: 'bg-error',
};

function getStatus(errorRate, responseTime) {
  if (errorRate > 10 || responseTime > 5000) return 'down';
  if (errorRate > 5 || responseTime > 2000) return 'degraded';
  return 'operational';
}

function UptimeBar({ pct = 100 }) {
  const color = pct >= 99 ? 'bg-success' : pct >= 95 ? 'bg-warning' : 'bg-error';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-mono text-foreground w-12 text-right">{pct?.toFixed(2)}%</span>
    </div>
  );
}

function StatusCard({ title, icon, status, metrics, loading }) {
  return (
    <div className={`bg-card border rounded-xl p-5 ${status === 'down' ? 'border-error/40' : status === 'degraded' ? 'border-warning/40' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === 'down' ? 'bg-error/10' : status === 'degraded' ? 'bg-warning/10' : 'bg-success/10'}`}>
            <Icon name={icon} size={16} className={STATUS_COLORS[status] || 'text-success'} />
          </div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status] || 'bg-success'} ${status === 'operational' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BG[status] || STATUS_BG.operational}`}>
            {loading ? '...' : status}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {metrics?.map(m => (
          <div key={m.label}>
            <p className="text-xs text-muted-foreground mb-0.5">{m.label}</p>
            <p className={`text-sm font-mono font-semibold ${m.color || 'text-foreground'}`}>
              {loading ? '—' : m.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const UptimeDashboard = () => {
  useGoogleAnalytics();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [functionStats, setFunctionStats] = useState({});
  const [hourlyData, setHourlyData] = useState([]);
  const [incidentLogs, setIncidentLogs] = useState([]);
  const [apiHealth, setApiHealth] = useState({ status: 'operational', responseTime: null, lastChecked: null });
  const [dbHealth, setDbHealth] = useState({ status: 'operational', queryTime: null, connections: null });
  const [realtimeHealth, setRealtimeHealth] = useState({ status: 'operational', channels: 0, reconnections: 0 });
  const [uptimePeriods, setUptimePeriods] = useState({ h24: 100, d7: 100, d30: 100 });
  const [expandedFunction, setExpandedFunction] = useState(null);
  const channelRef = useRef(null);
  const batchIntervalRef = useRef(null);
  const toast = useToast();

  const checkApiHealth = useCallback(async () => {
    const start = Date.now();
    try {
      const { error } = await supabase.from('edge_function_logs').select('id').limit(1);
      const responseTime = Date.now() - start;
      const status = error ? 'down' : responseTime > 2000 ? 'degraded' : 'operational';
      setApiHealth({ status, responseTime, lastChecked: new Date() });
      trackUptimeCheck('Supabase API', status, responseTime);
    } catch {
      setApiHealth({ status: 'down', responseTime: null, lastChecked: new Date() });
      trackUptimeCheck('Supabase API', 'down', null);
    }
  }, []);

  const checkDbHealth = useCallback(async () => {
    const start = Date.now();
    try {
      const { data, error } = await supabase.rpc('version').single();
      const queryTime = Date.now() - start;
      const status = error ? 'degraded' : queryTime > 1000 ? 'degraded' : 'operational';
      setDbHealth({ status, queryTime, connections: null });
      trackDatabaseLatency(queryTime);
      trackUptimeCheck('Database', status, queryTime);
    } catch {
      // Fallback: simple table query
      const start2 = Date.now();
      try {
        await supabase.from('system_logs').select('id').limit(1);
        const qt = Date.now() - start2;
        setDbHealth({ status: qt > 1000 ? 'degraded' : 'operational', queryTime: qt, connections: null });
        trackDatabaseLatency(qt);
      } catch {
        setDbHealth({ status: 'down', queryTime: null, connections: null });
        trackUptimeCheck('Database', 'down', null);
      }
    }
  }, []);

  const loadFunctionStats = useCallback(async () => {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('edge_function_logs')
        .select('function_name, status, execution_time_ms, created_at')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      const stats = {};
      FUNCTION_NAMES.forEach(fn => {
        stats[fn] = { total: 0, errors: 0, times: [], lastInvoked: null, lastStatus: null };
      });

      for (const row of (data || [])) {
        const fn = row.function_name;
        if (!stats[fn]) stats[fn] = { total: 0, errors: 0, times: [], lastInvoked: null, lastStatus: null };
        stats[fn].total++;
        if (row.status === 'error') stats[fn].errors++;
        if (row.execution_time_ms) stats[fn].times.push(row.execution_time_ms);
        if (!stats[fn].lastInvoked) {
          stats[fn].lastInvoked = row.created_at;
          stats[fn].lastStatus = row.status;
        }
      }

      const computed = {};
      for (const [fn, s] of Object.entries(stats)) {
        const errorRate = s.total > 0 ? (s.errors / s.total) * 100 : 0;
        const avgTime = s.times.length > 0 ? s.times.reduce((a, b) => a + b, 0) / s.times.length : 0;
        const availability = s.total > 0 ? ((s.total - s.errors) / s.total) * 100 : 100;
        computed[fn] = {
          total: s.total,
          errors: s.errors,
          errorRate: parseFloat(errorRate.toFixed(1)),
          avgTime: Math.round(avgTime),
          availability: parseFloat(availability.toFixed(2)),
          lastInvoked: s.lastInvoked,
          lastStatus: s.lastStatus,
          status: getStatus(errorRate, avgTime),
        };
        // Track to GA if there are errors
        if (s.errors > 0) {
          trackSystemError(fn, 'general', parseFloat(errorRate.toFixed(1)));
        }
        if (avgTime > 0) {
          trackFunctionExecution(fn, Math.round(avgTime), computed[fn].status);
        }
      }
      setFunctionStats(computed);

      // Overall uptime
      const allStats = Object.values(computed);
      const totalReqs = allStats.reduce((s, m) => s + m.total, 0);
      const totalErrs = allStats.reduce((s, m) => s + m.errors, 0);
      const uptime24h = totalReqs > 0 ? ((totalReqs - totalErrs) / totalReqs) * 100 : 100;
      setUptimePeriods(prev => ({ ...prev, h24: parseFloat(uptime24h.toFixed(3)) }));
    } catch (err) {
      toast?.error(err?.message || 'Failed to load function stats', 'Stats Error');
    }
  }, []);

  const loadHourlyData = useCallback(async () => {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('edge_function_logs')
        .select('execution_time_ms, status, created_at')
        .gte('created_at', since24h)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Build 24 hourly buckets
      const buckets = {};
      for (let i = 23; i >= 0; i--) {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() - i);
        const key = d.toISOString().slice(0, 13);
        buckets[key] = { hour: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), total: 0, errors: 0, totalTime: 0 };
      }

      for (const row of (data || [])) {
        const key = row.created_at?.slice(0, 13);
        if (buckets[key]) {
          buckets[key].total++;
          if (row.status === 'error') buckets[key].errors++;
          if (row.execution_time_ms) buckets[key].totalTime += row.execution_time_ms;
        }
      }

      const chartData = Object.values(buckets).map(b => ({
        hour: b.hour,
        responseTime: b.total > 0 ? Math.round(b.totalTime / b.total) : 0,
        availability: b.total > 0 ? parseFloat(((b.total - b.errors) / b.total * 100).toFixed(1)) : 100,
        requests: b.total,
      }));

      setHourlyData(chartData);
    } catch (err) {
      toast?.error(err?.message || 'Failed to load hourly data', 'Chart Error');
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('id, log_level, source, message, log_timestamp')
        .in('log_level', ['CRITICAL', 'ERROR'])
        .order('log_timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      setIncidentLogs(data || []);
    } catch (err) {
      toast?.error(err?.message || 'Failed to load incidents', 'Incidents Error');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      checkApiHealth(),
      checkDbHealth(),
      loadFunctionStats(),
      loadHourlyData(),
      loadIncidents(),
    ]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [checkApiHealth, checkDbHealth, loadFunctionStats, loadHourlyData, loadIncidents]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 60000);

    // Real-time subscription
    channelRef.current = supabase
      .channel('uptime_dashboard_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'edge_function_logs' }, () => {
        loadFunctionStats();
        loadHourlyData();
      })
      .subscribe();

    // Track realtime channel status
    setRealtimeHealth(prev => ({ ...prev, channels: 1 }));

    // Batch GA metrics every 60 seconds
    batchIntervalRef.current = setInterval(() => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'batch_metrics_report', {
          timestamp: new Date().toISOString(),
          source: 'uptime_dashboard',
        });
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(batchIntervalRef.current);
      channelRef.current?.unsubscribe();
    };
  }, [refreshAll]);

  const overallStatus = (() => {
    const statuses = [apiHealth.status, dbHealth.status, realtimeHealth.status];
    if (statuses.includes('down')) return 'down';
    if (statuses.includes('degraded')) return 'degraded';
    return 'operational';
  })();

  const functionList = FUNCTION_NAMES.map(fn => ({ name: fn, ...functionStats[fn] }));
  const downCount = functionList.filter(f => f.status === 'down').length;
  const degradedCount = functionList.filter(f => f.status === 'degraded').length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-6">
            <Breadcrumbs />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-heading font-semibold text-foreground">Uptime Dashboard</h1>
                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${STATUS_BG[overallStatus]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[overallStatus]} ${overallStatus === 'operational' ? 'animate-pulse' : ''}`} />
                    {overallStatus === 'operational' ? 'All Systems Operational' : overallStatus === 'degraded' ? 'Degraded Performance' : 'System Outage'}
                  </span>
                </div>
                <p className="text-muted-foreground">Supabase API health, database status, real-time subscriptions, and function availability</p>
              </div>
              <div className="flex items-center gap-3">
                {lastRefresh && (
                  <span className="text-xs text-muted-foreground">
                    Auto-refresh in 60s · Last: {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={refreshAll}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm text-foreground transition-colors disabled:opacity-50"
                >
                  <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Overall Uptime Periods */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Last 24 Hours', value: uptimePeriods.h24, icon: 'Clock' },
              { label: 'Last 7 Days', value: uptimePeriods.d7, icon: 'Calendar' },
              { label: 'Last 30 Days', value: uptimePeriods.d30, icon: 'CalendarDays' },
            ].map(p => (
              <div key={p.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={p.icon} size={14} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{p.label}</span>
                </div>
                <div className={`text-2xl font-bold font-mono mb-2 ${p.value >= 99 ? 'text-success' : p.value >= 95 ? 'text-warning' : 'text-error'}`}>
                  {loading ? '—' : `${p.value}%`}
                </div>
                <UptimeBar pct={p.value} />
              </div>
            ))}
          </div>

          {/* Service Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatusCard
              title="Supabase API"
              icon="Globe"
              status={apiHealth.status}
              loading={loading}
              metrics={[
                { label: 'Response Time', value: apiHealth.responseTime ? `${apiHealth.responseTime}ms` : '—', color: apiHealth.responseTime > 1000 ? 'text-warning' : 'text-success' },
                { label: 'Last Checked', value: apiHealth.lastChecked ? apiHealth.lastChecked.toLocaleTimeString() : '—' },
                { label: 'Status', value: apiHealth.status, color: STATUS_COLORS[apiHealth.status] },
                { label: 'Endpoint', value: 'REST API', color: 'text-muted-foreground' },
              ]}
            />
            <StatusCard
              title="Database"
              icon="Database"
              status={dbHealth.status}
              loading={loading}
              metrics={[
                { label: 'Query Time', value: dbHealth.queryTime ? `${dbHealth.queryTime}ms` : '—', color: dbHealth.queryTime > 500 ? 'text-warning' : 'text-success' },
                { label: 'Active Connections', value: dbHealth.connections ?? 'N/A' },
                { label: 'Status', value: dbHealth.status, color: STATUS_COLORS[dbHealth.status] },
                { label: 'Engine', value: 'PostgreSQL', color: 'text-muted-foreground' },
              ]}
            />
            <StatusCard
              title="Real-time Subscriptions"
              icon="Radio"
              status={realtimeHealth.status}
              loading={loading}
              metrics={[
                { label: 'Active Channels', value: realtimeHealth.channels },
                { label: 'Reconnections', value: realtimeHealth.reconnections },
                { label: 'Status', value: realtimeHealth.status, color: STATUS_COLORS[realtimeHealth.status] },
                { label: 'Protocol', value: 'WebSocket', color: 'text-muted-foreground' },
              ]}
            />
          </div>

          {/* 24h Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Response Time (24h)</h2>
                <span className="text-xs text-muted-foreground">Average across all functions</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="rtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} unit="ms" width={45} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}ms`, 'Avg Response']}
                  />
                  <Area type="monotone" dataKey="responseTime" stroke="var(--color-primary)" fill="url(#rtGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Availability % (24h)</h2>
                <span className="text-xs text-muted-foreground">Success rate per hour</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="avGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} domain={[90, 100]} unit="%" width={40} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'Availability']}
                  />
                  <Area type="monotone" dataKey="availability" stroke="var(--color-success)" fill="url(#avGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Edge Function Availability Cards */}
          <div className="bg-card border border-border rounded-xl mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">Edge Function Availability</h2>
                {downCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-error/10 text-error border border-error/30">
                    {downCount} down
                  </span>
                )}
                {degradedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/30">
                    {degradedCount} degraded
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">Last 24 hours · Click row to expand details</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-8"></th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Function</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Availability</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Avg Time</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Requests</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Last Invoked</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Last Status</th>
                  </tr>
                </thead>
                <tbody>
                  {functionList.map(fn => {
                    const rowBg = fn.status === 'down' ? 'bg-error/5' : fn.status === 'degraded' ? 'bg-warning/5' : '';
                    const isExpanded = expandedFunction === fn.name;
                    return (
                      <>
                        <tr
                          key={fn.name}
                          className={`border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer ${rowBg} ${isExpanded ? 'bg-primary/5' : ''}`}
                          onClick={() => setExpandedFunction(isExpanded ? null : fn.name)}
                        >
                          <td className="px-4 py-3 text-center">
                            <Icon
                              name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
                              size={14}
                              className={`transition-transform ${isExpanded ? 'text-primary' : 'text-muted-foreground'}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-foreground bg-muted px-2 py-0.5 rounded">{fn.name}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`flex items-center justify-center gap-1.5 text-xs font-medium`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[fn.status || 'operational']}`} />
                              <span className={STATUS_COLORS[fn.status || 'operational']}>{fn.status || 'operational'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {loading ? '—' : <UptimeBar pct={fn.availability ?? 100} />}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                            {loading ? '—' : fn.avgTime ? `${fn.avgTime}ms` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
                            {loading ? '—' : (fn.total || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                            {loading ? '—' : fn.lastInvoked ? new Date(fn.lastInvoked).toLocaleTimeString() : 'Never'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {loading ? '—' : (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${fn.lastStatus === 'error' ? 'bg-error/10 text-error border-error/30' : 'bg-success/10 text-success border-success/30'}`}>
                                {fn.lastStatus || 'ok'}
                              </span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${fn.name}-detail`} className="border-b border-border/50">
                            <td colSpan={8} className="p-0">
                              <FunctionDetailPanel functionName={fn.name} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Incident History */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="AlertOctagon" size={16} className="text-error" />
                <h2 className="text-base font-semibold text-foreground">Incident History</h2>
              </div>
              <span className="text-xs text-muted-foreground">{incidentLogs.length} incidents</span>
            </div>
            {incidentLogs.length === 0 && !loading ? (
              <div className="px-6 py-10 text-center">
                <Icon name="CheckCircle2" size={32} className="text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No incidents recorded. All systems healthy.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {incidentLogs.map(log => (
                  <div key={log.id} className="px-6 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${log.log_level === 'CRITICAL' ? 'bg-error' : 'bg-warning'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${log.log_level === 'CRITICAL' ? 'bg-error/10 text-error border-error/30' : 'bg-warning/10 text-warning border-warning/30'}`}>
                          {log.log_level}
                        </span>
                        <span className="text-xs text-primary font-medium">{log.source}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {log.log_timestamp ? new Date(log.log_timestamp).toLocaleString() : '—'}
                        </span>
                      </div>
                      <p className="text-xs text-foreground truncate">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UptimeDashboard;
