import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import { Link } from 'react-router-dom';
import { serversService, campaignsService, contactListsService, systemLogsService } from '../../services/supabaseService';

import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import ActivityAuditTab from './components/ActivityAuditTab';
import { useToast } from '../../components/ui/Toast';
import { subscribeToNetworkStatus, withOfflineFallback, isOnline } from '../../utils/offlineDetection';

const allProjects = ['All Projects', 'Q1 Newsletter', 'Flash Sale Feb', 'Win-Back Campaign', 'Onboarding Series'];

const EnhancedSystemOverview = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('today');
  const [serverFilter, setServerFilter] = useState('all');
  const [purposeFilter, setPurposeFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [isExporting, setIsExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const toast = useToast();

  const loadData = useCallback(async () => {
    const { data: result, fromCache } = await withOfflineFallback(
      async () => {
        const [serverData, campaignData, listData, logData] = await Promise.all([
          serversService?.getAll(),
          campaignsService?.getAll(),
          contactListsService?.getAll(),
          systemLogsService?.getRecent(10),
        ]);
        return { serverData, campaignData, listData, logData };
      },
      'system_overview_data',
      (msg) => toast?.warning(msg, 'Data Warning')
    );

    if (result) {
      setServers(result?.serverData || []);
      setCampaigns(result?.campaignData || []);
      setContactLists(result?.listData || []);
      setLogs(result?.logData || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    // Real-time: new system logs
    const logsChannel = systemLogsService?.subscribeToNewLogs((payload) => {
      const log = payload?.new;
      setLogs(prev => [{
        id: log?.id,
        timestamp: new Date(log?.log_timestamp),
        level: log?.log_level,
        source: log?.source,
        msg: log?.message,
      }, ...prev]?.slice(0, 10));
    });

    // Real-time: server changes
    const serversChannel = serversService?.subscribeToChanges((payload) => {
      if (payload?.eventType === 'INSERT') {
        loadData();
      } else if (payload?.eventType === 'UPDATE') {
        setServers(prev => prev?.map(s => s?.id === payload?.new?.id
          ? { ...s, status: payload?.new?.server_status || s?.status, reputation: payload?.new?.reputation_score ?? s?.reputation }
          : s
        ));
      } else if (payload?.eventType === 'DELETE') {
        setServers(prev => prev?.filter(s => s?.id !== payload?.old?.id));
      }
    });

    // Real-time: campaign changes
    const campaignsChannel = campaignsService?.subscribeToChanges((payload) => {
      if (payload?.eventType === 'INSERT') {
        loadData();
      } else if (payload?.eventType === 'UPDATE') {
        setCampaigns(prev => prev?.map(c => c?.id === payload?.new?.id
          ? { ...c, status: payload?.new?.campaign_status || c?.status }
          : c
        ));
      } else if (payload?.eventType === 'DELETE') {
        setCampaigns(prev => prev?.filter(c => c?.id !== payload?.old?.id));
      }
    });

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
      logsChannel?.unsubscribe?.();
      serversChannel?.unsubscribe?.();
      campaignsChannel?.unsubscribe?.();
      unsubscribeNetwork?.();
    };
  }, [loadData]);

  // Compute stats from real data
  const filteredServers = useMemo(() => {
    let s = servers;
    if (purposeFilter !== 'All') s = s?.filter(sv => sv?.purpose === purposeFilter);
    if (serverFilter !== 'all') s = s?.filter(sv => sv?.id === serverFilter);
    return s;
  }, [servers, purposeFilter, serverFilter]);

  const stats = useMemo(() => {
    const activeServers = filteredServers?.filter(s => s?.status === 'Active')?.length;
    const totalSent = filteredServers?.reduce((sum, s) => sum + (s?.dailySent || 0), 0);
    const totalCapacity = filteredServers?.reduce((sum, s) => sum + (s?.dailyLimit || 0), 0);
    const deliverability = totalCapacity > 0 ? ((totalSent / totalCapacity) * 100)?.toFixed(1) : 0;
    const totalContacts = contactLists?.reduce((sum, l) => sum + (l?.totalContacts || 0), 0);
    const totalLTV = contactLists?.reduce((sum, l) => sum + (l?.predictedLtv || 0), 0);
    const avgChurn = contactLists?.length > 0 ? (contactLists?.reduce((sum, l) => sum + (l?.churnRiskScore || 0), 0) / contactLists?.length)?.toFixed(1) : 0;
    const activeCampaigns = campaigns?.filter(c => c?.status === 'Running')?.length;
    const criticalAlerts = logs?.filter(l => l?.level === 'CRITICAL')?.length;
    return { activeServers, totalSent, deliverability, totalContacts, totalLTV, avgChurn, activeCampaigns, criticalAlerts };
  }, [filteredServers, contactLists, campaigns, logs]);

  const kpis = [
    { label: 'Sent Today', value: stats?.totalSent?.toLocaleString(), icon: 'Send', color: 'text-primary', trend: '+12.5%', up: true },
    { label: 'Deliverability', value: `${stats?.deliverability}%`, icon: 'TrendingUp', color: 'text-success', trend: '+2.1%', up: true },
    { label: 'Active Servers', value: String(stats?.activeServers), icon: 'Server', color: 'text-primary', trend: '', up: true },
    { label: 'Active Campaigns', value: String(stats?.activeCampaigns), icon: 'Target', color: 'text-warning', trend: '', up: true },
    { label: 'Predicted LTV', value: `$${(stats?.totalLTV / 1000000)?.toFixed(1)}M`, icon: 'DollarSign', color: 'text-success', trend: '+8.3%', up: true },
    { label: 'Avg Churn Risk', value: `${stats?.avgChurn}%`, icon: 'TrendingDown', color: 'text-warning', trend: '', up: false },
    { label: 'Total Contacts', value: stats?.totalContacts?.toLocaleString(), icon: 'Users', color: 'text-primary', trend: '', up: true },
    { label: 'Critical Alerts', value: String(stats?.criticalAlerts), icon: 'AlertCircle', color: stats?.criticalAlerts > 0 ? 'text-error' : 'text-success', trend: '', up: false },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 1500));
    const csv = [
      ['Metric', 'Value'],
      ...kpis?.map(k => [k?.label, k?.value]),
    ]?.map(row => row?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chimera-overview-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  const getLevelColor = (level) => {
    if (level === 'CRITICAL') return 'text-error';
    if (level === 'WARN') return 'text-warning';
    if (level === 'ERROR') return 'text-error';
    return 'text-success';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-foreground">System Overview</h1>
              <p className="text-muted-foreground mt-1">Chimera v5.0 — Real-time fleet intelligence</p>
            </div>
            <div className="flex items-center gap-3">
              {isOffline && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/30">
                  <Icon name="WifiOff" size={12} className="text-warning" />
                  <span className="text-xs text-warning">Offline — Cached Data</span>
                </div>
              )}
              {activeTab === 'overview' && (
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Icon name={isExporting ? 'Loader' : 'Download'} size={16} className={isExporting ? 'animate-spin' : ''} />
                  {isExporting ? 'Exporting...' : 'Export CSV'}
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mb-6 border-b border-border">
            {[
              { key: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
              { key: 'audit', label: 'Activity Audit', icon: 'ClipboardList' },
            ]?.map(tab => (
              <button
                key={tab?.key}
                onClick={() => setActiveTab(tab?.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab?.key
                    ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={15} />
                {tab?.label}
              </button>
            ))}
          </div>

          {activeTab === 'audit' ? (
            <ActivityAuditTab />
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-2">
                  <Icon name="Calendar" size={14} className="text-muted-foreground" />
                  <select
                    value={timeRange}
                    onChange={e => setTimeRange(e?.target?.value)}
                    className="text-sm bg-muted border border-border rounded-lg px-2 py-1 text-foreground"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7">Last 7 Days</option>
                    <option value="last30">Last 30 Days</option>
                    <option value="last90">Last 90 Days</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="Server" size={14} className="text-muted-foreground" />
                  <select
                    value={serverFilter}
                    onChange={e => setServerFilter(e?.target?.value)}
                    className="text-sm bg-muted border border-border rounded-lg px-2 py-1 text-foreground"
                  >
                    <option value="all">All Servers</option>
                    {servers?.map(s => <option key={s?.id} value={s?.id}>{s?.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="Filter" size={14} className="text-muted-foreground" />
                  <select
                    value={purposeFilter}
                    onChange={e => setPurposeFilter(e?.target?.value)}
                    className="text-sm bg-muted border border-border rounded-lg px-2 py-1 text-foreground"
                  >
                    {['All', 'Production', 'Canary', 'Sanitizer', 'Verifier']?.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="Folder" size={14} className="text-muted-foreground" />
                  <select
                    value={projectFilter}
                    onChange={e => setProjectFilter(e?.target?.value)}
                    className="text-sm bg-muted border border-border rounded-lg px-2 py-1 text-foreground"
                  >
                    {allProjects?.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {loading
                  ? Array.from({ length: 8 })?.map((_, i) => <SkeletonCard key={i} />)
                  : kpis?.map(kpi => (
                    <div key={kpi?.label} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-muted-foreground font-medium">{kpi?.label}</span>
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Icon name={kpi?.icon} size={16} className={kpi?.color} />
                        </div>
                      </div>
                      <div className="text-2xl font-bold font-mono text-foreground mb-1">{kpi?.value}</div>
                      {kpi?.trend && (
                        <div className={`flex items-center gap-1 text-xs ${kpi?.up ? 'text-success' : 'text-error'}`}>
                          <Icon name={kpi?.up ? 'TrendingUp' : 'TrendingDown'} size={12} />
                          {kpi?.trend}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>

              {/* Bottom Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Server Fleet Status */}
                <div className="xl:col-span-2 bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-foreground">Server Fleet</h2>
                    <Link to="/server-management" className="text-xs text-primary hover:underline">Manage →</Link>
                  </div>
                  {loading ? (
                    <div className="space-y-2">
                      {[1,2,3]?.map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
                    </div>
                  ) : servers?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No servers configured</div>
                  ) : (
                    <div className="space-y-2">
                      {servers?.slice(0, 6)?.map(server => (
                        <div key={server?.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            server?.status === 'Active' ? 'bg-success' :
                            server?.status === 'Warning' ? 'bg-warning' :
                            server?.status === 'Quarantined' ? 'bg-error' : 'bg-muted-foreground'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{server?.name}</p>
                            <p className="text-xs text-muted-foreground">{server?.purpose} • {server?.ip}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono text-foreground">{server?.reputation?.toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">rep</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* System Log Feed */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-foreground">Live System Logs</h2>
                    <Link to="/system-overview" className="text-xs text-primary hover:underline">View All →</Link>
                  </div>
                  {loading ? (
                    <div className="space-y-2">
                      {[1,2,3,4]?.map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
                    </div>
                  ) : logs?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No recent logs</div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {logs?.map(log => (
                        <div key={log?.id} className="p-2 rounded bg-muted/30">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-bold ${getLevelColor(log?.level)}`}>{log?.level}</span>
                            <span className="text-xs text-muted-foreground">{log?.source}</span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{log?.message || log?.msg}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default EnhancedSystemOverview;
