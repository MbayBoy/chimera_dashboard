import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from 'components/ui/Sidebar';
import Header from 'components/ui/Header';
import APIResponseChart from './components/APIResponseChart';
import QueryPerformancePanel from './components/QueryPerformancePanel';
import CacheHitRateGauge from './components/CacheHitRateGauge';
import ConnectionPoolGraph from './components/ConnectionPoolGraph';
import WorkflowExecutionTable from './components/WorkflowExecutionTable';
import PerformanceAlertsPanel from './components/PerformanceAlertsPanel';
import SystemResourceMetrics from './components/SystemResourceMetrics';
import PerformanceTrends from './components/PerformanceTrends';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { subscribeToNetworkStatus, withOfflineFallback, isOnline } from '../../utils/offlineDetection';

const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || '';

const PerformanceMonitoringDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [perfData, setPerfData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [range, setRange] = useState('1h');
  const [isOffline, setIsOffline] = useState(!isOnline());
  const toast = useToast();

  const fetchPerformanceData = useCallback(async () => {
    const { data: logs, fromCache, error: fetchError } = await withOfflineFallback(
      async () => {
        const { data, error } = await supabase
          ?.from('system_logs')
          ?.select('log_level, log_timestamp, source')
          ?.order('log_timestamp', { ascending: false })
          ?.limit(100);
        if (error) throw error;
        return data || [];
      },
      `perf_logs_${range}`,
      (msg) => toast?.warning(msg, 'Performance Data')
    );

    if (fetchError && !fromCache) {
      setSupabaseConnected(false);
      setLoading(false);
      return;
    }

    const logList = logs || [];
    const errorCount = logList?.filter(
      (l) => l?.log_level === 'ERROR' || l?.log_level === 'CRITICAL'
    )?.length;
    const errorRate = logList?.length ? ((errorCount / logList?.length) * 100)?.toFixed(1) : '0.0';

    setPerfData({
      errorRate: parseFloat(errorRate),
      avgResponseTime: 45,
      cacheHitRate: 87,
      activeConnections: 12,
      queryCount: logList?.length || 0,
      range,
    });
    setSupabaseConnected(true);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    fetchPerformanceData();
    const interval = setInterval(fetchPerformanceData, 30000);

    // Real-time: listen for new system_logs to update error rate live
    const logsChannel = supabase
      ?.channel('perf_system_logs')
      ?.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
        const log = payload?.new;
        if (log?.log_level === 'CRITICAL') {
          toast?.error(`Critical: ${log?.message}`, `Source: ${log?.source}`);
        } else if (log?.log_level === 'ERROR') {
          toast?.error(`Error: ${log?.message}`, `Source: ${log?.source}`, 6000);
        }
        // Refresh data on new critical/error logs
        if (log?.log_level === 'CRITICAL' || log?.log_level === 'ERROR') {
          fetchPerformanceData();
        }
      })
      ?.subscribe();

    // Real-time: listen for workflow_jobs changes
    const workflowChannel = supabase
      ?.channel('perf_workflow_jobs')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_jobs' }, () => {
        fetchPerformanceData();
      })
      ?.subscribe();

    // Offline detection
    const unsubscribeNetwork = subscribeToNetworkStatus(
      () => {
        setIsOffline(false);
        toast?.success('Connection restored', 'Back Online');
        fetchPerformanceData();
      },
      () => {
        setIsOffline(true);
        toast?.warning('You are offline. Showing cached data.', 'Connection Lost');
      }
    );

    return () => {
      clearInterval(interval);
      logsChannel?.unsubscribe?.();
      workflowChannel?.unsubscribe?.();
      unsubscribeNetwork?.();
    };
  }, [fetchPerformanceData]);

  const handleRefresh = () => {
    setLastRefresh(new Date());
    setLoading(true);
    fetchPerformanceData();
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title="Performance Monitoring"
          subtitle="Real-time system performance analytics & alerting"
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {isOffline && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-900/30 border border-yellow-500/40">
                  <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" />
                  </svg>
                  <span className="text-xs text-yellow-400">Offline</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                <span className={`text-xs font-medium ${supabaseConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                  {supabaseConnected ? 'Supabase Connected' : 'Connecting...'}
                </span>
              </div>
              <span className="text-gray-500 text-xs">Last refresh: {lastRefresh?.toLocaleTimeString()}</span>
              {perfData && (
                <span className="text-gray-500 text-xs">Error rate: <span className={perfData?.errorRate > 5 ? 'text-red-400' : 'text-green-400'}>{perfData?.errorRate}%</span></span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {['1h', '6h', '24h', '7d']?.map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      range === r ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Queue Stats Banner (when backend connected) */}
          {supabaseConnected && perfData?.queue && (
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Queue Sent', value: perfData?.queue?.sent?.toLocaleString(), color: 'text-green-400' },
                { label: 'Pending', value: perfData?.queue?.pending?.toLocaleString(), color: 'text-blue-400' },
                { label: 'Failed', value: perfData?.queue?.failed?.toLocaleString(), color: 'text-red-400' },
                { label: 'Total Logs', value: perfData?.totalLogs?.toLocaleString(), color: 'text-gray-300' },
              ]?.map(stat => (
                <div key={stat?.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">{stat?.label}</div>
                  <div className={`text-xl font-bold font-mono ${stat?.color}`}>{stat?.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Main grid with alerts sidebar */}
          <div className="flex gap-5">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Row 1: API Response + Cache Hit Rate */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2">
                  <APIResponseChart
                    latencyData={perfData?.apiLatency}
                    externalRange={range}
                    onRangeChange={setRange}
                  />
                </div>
                <div>
                  <CacheHitRateGauge cacheStats={perfData?.cacheStats} />
                </div>
              </div>

              {/* Row 2: Connection Pool + Query Performance */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <ConnectionPoolGraph />
                <QueryPerformancePanel />
              </div>

              {/* Row 3: System Resources */}
              <SystemResourceMetrics />

              {/* Row 4: Workflow Execution */}
              <WorkflowExecutionTable workflows={perfData?.workflows} />

              {/* Row 5: 7-day Trends */}
              <PerformanceTrends />
            </div>

            {/* Alerts Sidebar */}
            <div className="w-80 flex-shrink-0 hidden xl:block">
              <div className="sticky top-0">
                <PerformanceAlertsPanel />
              </div>
            </div>
          </div>

          {/* Mobile alerts (below main content) */}
          <div className="xl:hidden mt-5">
            <PerformanceAlertsPanel />
          </div>
        </main>
      </div>
    </div>
  );
};

export default PerformanceMonitoringDashboard;
