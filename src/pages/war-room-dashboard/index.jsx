import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import FleetStatusPanel from './components/FleetStatusPanel';
import ThreatWatchPanel from './components/ThreatWatchPanel';
import GoldenListHealthPanel from './components/GoldenListHealthPanel';
import ThreatAssessmentMatrix from './components/ThreatAssessmentMatrix';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { serversService, systemLogsService, contactListsService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';
import { exportWarRoomPDF, exportWarRoomCSV } from '../../services/exportService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { subscribeToNetworkStatus, withOfflineFallback, isOnline } from '../../utils/offlineDetection';

const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || '';

const WarRoomDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [emergencyPauseActive, setEmergencyPauseActive] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fleetData, setFleetData] = useState([]);
  const [threatEvents, setThreatEvents] = useState([]);
  const [goldenListData, setGoldenListData] = useState(null);
  const [systemRiskLevel, setSystemRiskLevel] = useState({ overall: 35, production: 15, canary: 55, quarantine: 85, sanitizer: 45 });
  const [fleetStats, setFleetStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const { user } = useAuth();
  const toast = useToast();

  const buildRiskLevels = (servers) => {
    const prodServers = servers?.filter(s => s?.purpose === 'Production');
    const canaryServers = servers?.filter(s => s?.purpose === 'Canary');
    const sanitizerServers = servers?.filter(s => s?.purpose === 'Sanitizer');
    const quarantinedServers = servers?.filter(s => s?.status === 'Quarantined');
    const avgProdRep = prodServers?.length ? prodServers?.reduce((sum, s) => sum + (s?.reputationScore || s?.reputation || 0), 0) / prodServers?.length : 100;
    return {
      overall: Math.round(100 - avgProdRep),
      production: Math.round(100 - avgProdRep),
      canary: canaryServers?.length ? Math.round(100 - canaryServers?.reduce((sum, s) => sum + (s?.reputationScore || s?.reputation || 0), 0) / canaryServers?.length) : 50,
      quarantine: quarantinedServers?.length > 0 ? 85 : 20,
      sanitizer: sanitizerServers?.length ? Math.round(100 - sanitizerServers?.reduce((sum, s) => sum + (s?.reputationScore || s?.reputation || 0), 0) / sanitizerServers?.length) : 50,
    };
  };

  const buildGoldenList = (lists) => {
    const totalContacts = lists?.reduce((sum, l) => sum + (l?.totalContacts || 0), 0);
    if (!totalContacts) return null;
    const platinum = lists?.reduce((sum, l) => sum + (l?.platinumCount || 0), 0);
    const gold = lists?.reduce((sum, l) => sum + (l?.goldCount || 0), 0);
    const silver = lists?.reduce((sum, l) => sum + (l?.silverCount || 0), 0);
    const bronze = lists?.reduce((sum, l) => sum + (l?.bronzeCount || 0), 0);
    const lead = lists?.reduce((sum, l) => sum + (l?.leadCount || 0), 0);
    return {
      totalContacts,
      tiers: {
        platinum: { count: platinum, percentage: +((platinum / totalContacts) * 100)?.toFixed(1), engagementScore: 95 },
        gold: { count: gold, percentage: +((gold / totalContacts) * 100)?.toFixed(1), engagementScore: 88 },
        silver: { count: silver, percentage: +((silver / totalContacts) * 100)?.toFixed(1), engagementScore: 72 },
        bronze: { count: bronze, percentage: +((bronze / totalContacts) * 100)?.toFixed(1), engagementScore: 58 },
        lead: { count: lead, percentage: +((lead / totalContacts) * 100)?.toFixed(1), engagementScore: 35 },
      },
      avgEngagement: lists?.reduce((sum, l) => sum + (l?.avgEngagement || 0), 0) / (lists?.length || 1),
      listQuality: 92,
    };
  };

  const loadFromBackend = useCallback(async () => {
    // Backend URL no longer used - all data comes from Supabase
    return false;
  }, []);

  const loadFromSupabase = useCallback(async () => {
    const { data: result, fromCache } = await withOfflineFallback(
      async () => {
        const [servers, logs, lists] = await Promise.all([
          serversService?.getAll(),
          systemLogsService?.getRecent(50),
          contactListsService?.getAll(),
        ]);
        return { servers, logs, lists };
      },
      'war_room_data',
      (msg) => toast?.warning(msg, 'Data Warning')
    );

    if (!result) return;

    const { servers = [], logs = [], lists = [] } = result;

    const mappedServers = servers?.map(s => ({
      id: s?.id,
      name: s?.name,
      purpose: s?.purpose,
      status: s?.status === 'Active' ? 'Online' : s?.status,
      reputation: s?.reputation,
      reputationScore: s?.reputation,
      ip: s?.ip,
      sentToday: s?.dailySent,
      dailyLimit: s?.dailyLimit,
      blacklistCount: s?.blacklistCount || 0,
      hasCriticalBlacklist: false,
    })) || [];

    setFleetData(mappedServers);

    setThreatEvents(logs?.filter(l => l?.level === 'CRITICAL' || l?.level === 'WARN' || l?.level === 'ERROR')?.map(l => ({
      id: l?.id,
      timestamp: new Date(l.timestamp),
      severity: l?.level === 'CRITICAL' ? 'Critical' : l?.level === 'ERROR' ? 'Error' : 'Warning',
      type: l?.source,
      message: l?.message,
      serverId: l?.serverId,
      action: 'See system logs for details',
    })) || []);

    const statusCounts = { Active: 0, Quarantined: 0, Warming: 0, Burnt: 0 };
    servers?.forEach(s => { if (statusCounts?.[s?.status] !== undefined) statusCounts[s?.status]++; });
    const activeServers = servers?.filter(s => s?.status !== 'Burnt' && s?.status !== 'Provisioning');
    const avgRep = activeServers?.length ? Math.round(activeServers?.reduce((sum, s) => sum + (s?.reputation || 0), 0) / activeServers?.length) : 0;
    setFleetStats({ totalServers: servers?.length || 0, statusCounts, avgReputation: avgRep, totalCampaignsSentToday: 0, avgDeliverability: 0 });
    setSystemRiskLevel(buildRiskLevels(mappedServers));

    const gl = buildGoldenList(lists);
    if (gl) setGoldenListData(gl);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const backendOk = await loadFromBackend();
      if (!backendOk) {
        await loadFromSupabase();
        setBackendConnected(true);
      } else {
        // Load golden list from Supabase even when backend is available
        try {
          const lists = await contactListsService?.getAll();
          const gl = buildGoldenList(lists);
          if (gl) setGoldenListData(gl);
        } catch (listErr) {
          toast?.warning('Could not load contact list data', 'Partial Load');
        }
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error('War Room load error:', err);
      setError(err?.message);
      toast?.error(err?.message || 'Failed to load War Room data', 'Load Error');
    } finally {
      setLoading(false);
    }
  }, [loadFromBackend, loadFromSupabase]);

  useEffect(() => {
    loadData();
    // Real-time Supabase subscription for new logs
    const logsChannel = systemLogsService?.subscribeToNewLogs((payload) => {
      const log = payload?.new;
      if (log?.log_level === 'CRITICAL' || log?.log_level === 'WARN' || log?.log_level === 'ERROR') {
        setThreatEvents(prev => [{
          id: log?.id,
          timestamp: new Date(log?.log_timestamp),
          severity: log?.log_level === 'CRITICAL' ? 'Critical' : log?.log_level === 'ERROR' ? 'Error' : 'Warning',
          type: log?.source,
          message: log?.message,
          serverId: log?.server_id,
          action: 'Auto-detected',
        }, ...prev]?.slice(0, 50));
      }
    });
    // Real-time server changes
    const serversChannel = serversService?.subscribeToChanges(() => loadData());

    // Real-time anomalies subscription
    const anomaliesChannel = supabase
      ?.channel('war_room_anomalies')
      ?.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anomalies' }, (payload) => {
        const anomaly = payload?.new;
        if (anomaly?.severity === 'Critical' || anomaly?.severity === 'High') {
          setThreatEvents(prev => [{
            id: anomaly?.id,
            timestamp: new Date(anomaly?.detected_at || Date.now()),
            severity: anomaly?.severity === 'Critical' ? 'Critical' : 'Warning',
            type: anomaly?.anomaly_type || 'Anomaly',
            message: anomaly?.description || anomaly?.title || 'Anomaly detected',
            serverId: anomaly?.server_id,
            action: 'Auto-detected',
          }, ...prev]?.slice(0, 50));
          toast?.warning(anomaly?.description || anomaly?.title, `${anomaly?.severity} Anomaly`);
        }
      })
      ?.subscribe();

    // Offline detection
    const unsubscribeNetwork = subscribeToNetworkStatus(
      () => {
        setIsOffline(false);
        toast?.success('Connection restored', 'Back Online');
        loadData();
      },
      () => {
        setIsOffline(true);
        toast?.warning('You are offline. Showing cached data.', 'Connection Lost');
      }
    );

    return () => {
      serversChannel?.unsubscribe?.();
      logsChannel?.unsubscribe?.();
      anomaliesChannel?.unsubscribe?.();
      unsubscribeNetwork?.();
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const defaultGoldenList = {
    totalContacts: 0,
    tiers: {
      platinum: { count: 0, percentage: 0, engagementScore: 0 },
      gold: { count: 0, percentage: 0, engagementScore: 0 },
      silver: { count: 0, percentage: 0, engagementScore: 0 },
      bronze: { count: 0, percentage: 0, engagementScore: 0 },
      lead: { count: 0, percentage: 0, engagementScore: 0 },
    },
    avgEngagement: 0,
    listQuality: 0,
  };

  const handleExportPDF = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      exportWarRoomPDF({
        fleetData,
        fleetStats,
        threatEvents,
        goldenListData,
        generatedBy: user?.email || 'System',
        dateRange: `As of ${new Date()?.toLocaleString()}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    setShowExportMenu(false);
    exportWarRoomCSV({ fleetData, threatEvents, goldenListData });
  };

  return (
    <div className="min-h-screen bg-slate-950 dark">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6 md:mb-8">
            <Breadcrumbs />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-heading font-semibold text-white mb-2">War Room Dashboard</h1>
                <p className="text-base md:text-lg text-slate-400">Mission-critical fleet monitoring and threat response</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Offline indicator */}
                {isOffline && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-900/30 border border-yellow-500/50">
                    <Icon name="WifiOff" size={12} className="text-yellow-400" />
                    <span className="text-xs text-yellow-400">Offline — Cached Data</span>
                  </div>
                )}
                {/* Connection status indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                  <span className={`w-2 h-2 rounded-full ${
                    backendConnected === null ? 'bg-slate-500 animate-pulse' : backendConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                  }`} />
                  <span className="text-xs text-slate-400">
                    {backendConnected === null ? 'Connecting...' : 'Supabase Connected'}
                  </span>
                </div>
                {lastUpdated && (
                  <span className="text-xs text-slate-500 hidden md:inline">
                    Updated {lastUpdated?.toLocaleTimeString()}
                  </span>
                )}
                {/* Export Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={exporting}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <Icon name={exporting ? 'Loader2' : 'Download'} size={14} className={exporting ? 'animate-spin' : ''} />
                    Export Report
                    <Icon name="ChevronDown" size={12} />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Icon name="FileText" size={14} className="text-red-400" />
                        Export as PDF
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Icon name="Table" size={14} className="text-green-400" />
                        Export as CSV
                      </button>
                    </div>
                  )}
                </div>
                <Button
                  variant={autoRefresh ? 'default' : 'outline'}
                  size="sm"
                  iconName={autoRefresh ? 'Pause' : 'Play'}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? 'Auto-Refresh' : 'Paused'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconName="RefreshCw"
                  onClick={loadData}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant={emergencyPauseActive ? 'danger' : 'warning'}
                  size="sm"
                  iconName="AlertTriangle"
                  onClick={() => setEmergencyPauseActive(!emergencyPauseActive)}
                >
                  {emergencyPauseActive ? 'Resume Fleet' : 'Emergency Pause'}
                </Button>
              </div>
            </div>
          </div>

          {/* Fleet Stats Bar */}
          {fleetStats && (
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Fleet Reputation</div>
                <div className={`text-2xl font-bold ${
                  fleetStats?.avgReputation >= 80 ? 'text-green-400' :
                  fleetStats?.avgReputation >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {fleetStats?.avgReputation}
                  <span className="text-sm text-slate-500">/100</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Avg across {fleetStats?.totalServers} servers</div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Active Servers</div>
                <div className="text-2xl font-bold text-green-400">{fleetStats?.statusCounts?.Active || 0}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {fleetStats?.statusCounts?.Quarantined || 0} quarantined &middot; {fleetStats?.statusCounts?.Warming || 0} warming
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Sent Today</div>
                <div className="text-2xl font-bold text-blue-400">{(fleetStats?.totalCampaignsSentToday || 0)?.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Campaign emails dispatched</div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Deliverability</div>
                <div className={`text-2xl font-bold ${
                  fleetStats?.avgDeliverability >= 95 ? 'text-green-400' :
                  fleetStats?.avgDeliverability >= 85 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {fleetStats?.avgDeliverability > 0 ? `${fleetStats?.avgDeliverability}%` : 'N/A'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Today&apos;s avg rate</div>
              </div>
            </div>
          )}

          {emergencyPauseActive && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-3">
              <Icon name="AlertTriangle" size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-red-400 font-semibold mb-1">Emergency Fleet Pause Active</div>
                <div className="text-red-300 text-sm">All outbound email sending has been paused. Click &quot;Resume Fleet&quot; to restore operations.</div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg flex items-start gap-3">
              <Icon name="AlertTriangle" size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-yellow-400 font-semibold mb-1">Data Load Warning</div>
                <div className="text-yellow-300 text-sm">{error}</div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-400">Loading fleet data...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <div className="xl:col-span-2">
                  <FleetStatusPanel servers={fleetData} emergencyPause={emergencyPauseActive} />
                </div>
                <div>
                  <GoldenListHealthPanel data={goldenListData || defaultGoldenList} />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <ThreatWatchPanel events={threatEvents} autoRefresh={autoRefresh} />
                </div>
                <div>
                  <ThreatAssessmentMatrix riskLevels={systemRiskLevel} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default WarRoomDashboard;