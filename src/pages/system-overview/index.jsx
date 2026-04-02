import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import KPIWidget from './components/KPIWidget';
import SystemLogFeed from './components/SystemLogFeed';
import FleetStatusPanel from './components/FleetStatusPanel';
import ThreatWatchPanel from './components/ThreatWatchPanel';
import GoldenListHealthKPI from './components/GoldenListHealthKPI';
import { serversService, systemLogsService, contactListsService, campaignsService } from '../../services/supabaseService';
import { useToast } from '../../components/ui/Toast';
import { subscribeToNetworkStatus, withOfflineFallback, isOnline } from '../../utils/offlineDetection';
import Icon from '../../components/AppIcon';

const SystemOverview = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [kpiData, setKpiData] = useState({
    totalSent: 0,
    avgDeliverability: 0,
    avgOpenRate: 0,
    activeServers: 0,
    goldenListSize: 0,
    goldenListEngagement: 0,
    goldenListTrend: '+0%'
  });
  const [servers, setServers] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const toast = useToast();

  const loadData = useCallback(async () => {
    const { data: result, fromCache } = await withOfflineFallback(
      async () => {
        const [serverData, logData, listData, campaignData] = await Promise.all([
          serversService?.getAll(),
          systemLogsService?.getRecent(20),
          contactListsService?.getAll(),
          campaignsService?.getAll(),
        ]);
        return { serverData, logData, listData, campaignData };
      },
      'system_overview_legacy_data',
      (msg) => toast?.warning(msg, 'System Overview')
    );

    if (!result) {
      setLoading(false);
      return;
    }

    const { serverData = [], logData = [], listData = [], campaignData = [] } = result;

    setServers(serverData?.map(s => ({
      id: s?.id,
      name: s?.name,
      ip: s?.ip,
      status: s?.status === 'Active' ? 'Online' : s?.status,
      purpose: s?.purpose,
      reputation: s?.reputation,
      dailySent: s?.dailySent,
      dailyLimit: s?.dailyLimit,
      blacklistCount: s?.blacklistCount || 0,
    })));

    const mappedLogs = logData?.map(l => ({
      timestamp: new Date(l?.timestamp),
      severity: l?.level === 'CRITICAL' ? 'Critical' : l?.level === 'ERROR' ? 'Error' : l?.level === 'WARN' ? 'Warning' : 'Info',
      source: l?.source,
      serverId: l?.serverId,
      message: l?.message,
    }));
    setSystemLogs(mappedLogs);

    const activeServers = serverData?.filter(s => s?.status === 'Active' || s?.status === 'Online');
    const totalSent = serverData?.reduce((sum, s) => sum + (s?.dailySent || 0), 0);
    const totalCapacity = serverData?.reduce((sum, s) => sum + (s?.dailyLimit || 0), 0);
    const deliverability = totalCapacity > 0 ? +((totalSent / totalCapacity) * 100)?.toFixed(1) : 0;
    const totalContacts = listData?.reduce((sum, l) => sum + (l?.totalContacts || 0), 0);
    const avgEngagement = listData?.length > 0
      ? +(listData?.reduce((sum, l) => sum + (l?.avgEngagement || 0), 0) / listData?.length)?.toFixed(1)
      : 0;
    const completedCampaigns = campaignData?.filter(c => c?.status === 'Completed');
    const avgOpenRate = completedCampaigns?.length > 0
      ? +(completedCampaigns?.reduce((sum, c) => sum + (c?.opens && c?.delivered ? (c?.opens / c?.delivered) * 100 : 0), 0) / completedCampaigns?.length)?.toFixed(1)
      : 0;

    setKpiData({
      totalSent,
      avgDeliverability: deliverability,
      avgOpenRate,
      activeServers: activeServers?.length,
      goldenListSize: totalContacts,
      goldenListEngagement: avgEngagement,
      goldenListTrend: '+0%',
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    // Real-time: new system logs
    const logsChannel = systemLogsService?.subscribeToNewLogs((payload) => {
      const log = payload?.new;
      const mapped = {
        timestamp: new Date(log?.log_timestamp),
        severity: log?.log_level === 'CRITICAL' ? 'Critical' : log?.log_level === 'ERROR' ? 'Error' : log?.log_level === 'WARN' ? 'Warning' : 'Info',
        source: log?.source,
        serverId: log?.server_id,
        message: log?.message,
      };
      setSystemLogs(prev => [mapped, ...prev]?.slice(0, 20));
      if (log?.log_level === 'CRITICAL') {
        toast?.error(log?.message, `CRITICAL: ${log?.source}`);
      }
    });

    // Real-time: server changes
    const serversChannel = serversService?.subscribeToChanges((payload) => {
      if (payload?.eventType === 'UPDATE') {
        setServers(prev => prev?.map(s => s?.id === payload?.new?.id
          ? { ...s, status: payload?.new?.server_status === 'Active' ? 'Online' : payload?.new?.server_status, reputation: payload?.new?.reputation_score ?? s?.reputation }
          : s
        ));
      } else {
        loadData();
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
      unsubscribeNetwork?.();
    };
  }, [loadData]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <main 
        className={`pt-20 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6 md:mb-8">
            <Breadcrumbs />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-heading font-semibold text-foreground">
                  War Room Dashboard
                </h1>
                <p className="text-base md:text-lg text-muted-foreground">
                  Zero-Burn Core Architecture - Real-time fleet monitoring and threat detection
                </p>
              </div>
              {isOffline && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/30">
                  <Icon name="WifiOff" size={12} className="text-warning" />
                  <span className="text-xs text-warning">Offline — Cached Data</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <KPIWidget
              title="Total Sent Today"
              value={loading ? '—' : kpiData?.totalSent?.toLocaleString()}
              unit=""
              trend="up"
              trendValue="+12.5%"
              icon="Send"
              iconColor="text-primary"
            />
            <KPIWidget
              title="Average Deliverability"
              value={loading ? '—' : kpiData?.avgDeliverability}
              unit="%"
              trend="up"
              trendValue="+2.1%"
              icon="TrendingUp"
              iconColor="text-success"
            />
            <KPIWidget
              title="Average Open Rate"
              value={loading ? '—' : kpiData?.avgOpenRate}
              unit="%"
              trend="down"
              trendValue="-0.8%"
              icon="Mail"
              iconColor="text-warning"
            />
            <KPIWidget
              title="Active Servers"
              value={loading ? '—' : kpiData?.activeServers}
              unit=""
              trend="up"
              trendValue="+2"
              icon="Server"
              iconColor="text-primary"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="lg:col-span-2">
              <FleetStatusPanel servers={servers} />
            </div>
            <div>
              <GoldenListHealthKPI 
                goldenListData={{
                  size: kpiData?.goldenListSize,
                  engagement: kpiData?.goldenListEngagement,
                  trend: kpiData?.goldenListTrend
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
            <ThreatWatchPanel threats={systemLogs?.filter(log => 
              log?.severity === 'Critical' || log?.severity === 'Warning'
            )} />
            <div className="h-[600px]">
              <SystemLogFeed logs={systemLogs} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SystemOverview;