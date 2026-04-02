import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const ERROR_TYPES = ['Auth Error', 'Timeout', 'DB Error', 'Rate Limit', 'Unknown'];
const ERROR_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#6b7280'];

function SkeletonBlock({ h = 'h-4', w = 'w-full', className = '' }) {
  return <div className={`${h} ${w} bg-muted rounded animate-pulse ${className}`} />;
}

function StatBox({ label, value, color = 'text-foreground' }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-mono font-bold ${color}`}>{value ?? '—'}</p>
    </div>
  );
}

const FunctionDetailPanel = ({ functionName }) => {
  const [loading, setLoading] = useState(true);
  const [hourlyExec, setHourlyExec] = useState([]);
  const [errorBreakdown, setErrorBreakdown] = useState([]);
  const [requestDist, setRequestDist] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recentErrors, setRecentErrors] = useState([]);
  const [perfStats, setPerfStats] = useState({ p50: null, p95: null, p99: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)?.toISOString();
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)?.toISOString();
      const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)?.toISOString();

      const [logs24h, logs30d, errorLogs] = await Promise.all([
        supabase?.from('edge_function_logs')?.select('execution_time_ms, status, error_message, created_at')?.eq('function_name', functionName)?.gte('created_at', since24h)?.order('created_at', { ascending: true })?.limit(2000),
        supabase?.from('edge_function_logs')?.select('execution_time_ms, status, created_at')?.eq('function_name', functionName)?.gte('created_at', since60d)?.order('created_at', { ascending: true })?.limit(5000),
        supabase?.from('edge_function_logs')?.select('created_at, error_message, user_id, status')?.eq('function_name', functionName)?.eq('status', 'error')?.order('created_at', { ascending: false })?.limit(10),
      ]);

      const data24h = logs24h?.data || [];
      const data30d = logs30d?.data || [];

      // Build 24 hourly buckets for execution timeline
      const hourBuckets = {};
      for (let i = 23; i >= 0; i--) {
        const d = new Date();
        d?.setMinutes(0, 0, 0);
        d?.setHours(d?.getHours() - i);
        const key = d?.toISOString()?.slice(0, 13);
        hourBuckets[key] = { hour: d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), total: 0, totalTime: 0, errors: 0 };
      }
      for (const row of data24h) {
        const key = row?.created_at?.slice(0, 13);
        if (hourBuckets?.[key]) {
          hourBuckets[key].total++;
          if (row?.execution_time_ms) hourBuckets[key].totalTime += row?.execution_time_ms;
          if (row?.status === 'error') hourBuckets[key].errors++;
        }
      }
      setHourlyExec(Object.values(hourBuckets)?.map(b => ({
        hour: b?.hour,
        avgTime: b?.total > 0 ? Math.round(b?.totalTime / b?.total) : 0,
        requests: b?.total,
        errors: b?.errors,
      })));

      // Request distribution (same hourly buckets)
      setRequestDist(Object.values(hourBuckets)?.map(b => ({
        hour: b?.hour,
        requests: b?.total,
      })));

      // Error breakdown by type
      const errorCounts = {};
      ERROR_TYPES?.forEach(t => { errorCounts[t] = 0; });
      for (const row of data24h?.filter(r => r?.status === 'error')) {
        const msg = (row?.error_message || '')?.toLowerCase();
        if (msg?.includes('auth') || msg?.includes('unauthorized') || msg?.includes('jwt')) errorCounts['Auth Error']++;
        else if (msg?.includes('timeout') || msg?.includes('timed out')) errorCounts['Timeout']++;
        else if (msg?.includes('database') || msg?.includes('db') || msg?.includes('postgres')) errorCounts['DB Error']++;
        else if (msg?.includes('rate') || msg?.includes('limit') || msg?.includes('429')) errorCounts['Rate Limit']++;
        else errorCounts['Unknown']++;
      }
      setErrorBreakdown(ERROR_TYPES?.map((t, i) => ({ name: t, value: errorCounts?.[t], color: ERROR_COLORS?.[i] }))?.filter(e => e?.value > 0));

      // 30-day trend: this month vs last month
      const now = Date.now();
      const dayBuckets = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        const key = d?.toISOString()?.slice(0, 10);
        dayBuckets[key] = { day: d?.toLocaleDateString([], { month: 'short', day: 'numeric' }), thisMonth: 0, lastMonth: 0, thisCount: 0, lastCount: 0 };
      }
      for (const row of data30d) {
        const rowDate = new Date(row.created_at);
        const rowKey = rowDate?.toISOString()?.slice(0, 10);
        const shiftedDate = new Date(rowDate.getTime() + 30 * 86400000);
        const shiftedKey = shiftedDate?.toISOString()?.slice(0, 10);
        if (dayBuckets?.[rowKey] && row?.execution_time_ms) {
          dayBuckets[rowKey].thisMonth += row?.execution_time_ms;
          dayBuckets[rowKey].thisCount++;
        }
        if (dayBuckets?.[shiftedKey] && row?.execution_time_ms) {
          dayBuckets[shiftedKey].lastMonth += row?.execution_time_ms;
          dayBuckets[shiftedKey].lastCount++;
        }
      }
      setTrendData(Object.values(dayBuckets)?.map(b => ({
        day: b?.day,
        thisMonth: b?.thisCount > 0 ? Math.round(b?.thisMonth / b?.thisCount) : 0,
        lastMonth: b?.lastCount > 0 ? Math.round(b?.lastMonth / b?.lastCount) : 0,
      })));

      // Performance percentiles
      const allTimes = data24h?.filter(r => r?.execution_time_ms)?.map(r => r?.execution_time_ms)?.sort((a, b) => a - b);
      if (allTimes?.length > 0) {
        const p = (pct) => allTimes?.[Math.floor(allTimes?.length * pct / 100)] ?? null;
        setPerfStats({ p50: p(50), p95: p(95), p99: p(99) });
      }

      // Recent errors
      setRecentErrors(errorLogs?.data || []);
    } catch (err) {
      console.warn('[FunctionDetailPanel] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [functionName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tooltipStyle = { background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 };

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3]?.map(i => <SkeletonBlock key={i} h="h-16" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonBlock h="h-40" />
          <SkeletonBlock h="h-40" />
        </div>
        <SkeletonBlock h="h-40" />
      </div>
    );
  }

  return (
    <div className="p-5 bg-muted/20 border-t border-border space-y-5">
      {/* Performance Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="p50 Execution" value={perfStats?.p50 ? `${perfStats?.p50}ms` : '—'} color="text-success" />
        <StatBox label="p95 Execution" value={perfStats?.p95 ? `${perfStats?.p95}ms` : '—'} color="text-warning" />
        <StatBox label="p99 Execution" value={perfStats?.p99 ? `${perfStats?.p99}ms` : '—'} color="text-error" />
      </div>
      {/* Charts Row 1: Execution Timeline + Error Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Execution Timeline (24h by hour)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourlyExec} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} unit="ms" width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}ms`, 'Avg Time']} />
              <Bar dataKey="avgTime" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Error Breakdown (24h)</p>
          {errorBreakdown?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <Icon name="CheckCircle2" size={24} className="text-success mb-2" />
              <p className="text-xs text-muted-foreground">No errors</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={errorBreakdown} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                    {errorBreakdown?.map((entry, i) => (
                      <Cell key={i} fill={entry?.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {errorBreakdown?.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e?.color }} />
                      <span className="text-muted-foreground">{e?.name}</span>
                    </div>
                    <span className="font-mono text-foreground">{e?.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Charts Row 2: Request Distribution + 30-day Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Request Distribution (24h)</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={requestDist} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`reqGrad_${functionName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} width={30} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Requests']} />
              <Area type="monotone" dataKey="requests" stroke="var(--color-success)" fill={`url(#reqGrad_${functionName})`} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">30-Day Trend Comparison</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trendData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} interval={6} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} unit="ms" width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}ms`, '']} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="thisMonth" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="This Month" />
              <Line type="monotone" dataKey="lastMonth" stroke="var(--color-muted-foreground)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Last Month" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Recent Error Logs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Last 10 Error Logs</p>
        </div>
        {recentErrors?.length === 0 ? (
          <div className="p-4 text-center">
            <Icon name="CheckCircle2" size={20} className="text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">No recent errors</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {recentErrors?.map((err, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                <Icon name="AlertCircle" size={12} className="text-error mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground">{new Date(err.created_at)?.toLocaleString()}</span>
                    {err?.user_id && <span className="text-xs text-primary font-mono truncate max-w-[120px]">{err?.user_id}</span>}
                  </div>
                  <p className="text-xs text-foreground truncate">{err?.error_message || 'Unknown error'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FunctionDetailPanel;
