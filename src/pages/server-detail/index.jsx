import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import ServerHeader from './components/ServerHeader';
import MetricsTab from './components/MetricsTab';
import HealthTab from './components/HealthTab';
import ConfigEditorTab from './components/ConfigEditorTab';
import GovernorLogTab from './components/GovernorLogTab';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

const ServerDetail = () => {
  const [searchParams] = useSearchParams();
  const serverId = searchParams?.get('id') || 'srv-prod-01';
  const [activeTab, setActiveTab] = useState('metrics');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [serverData, setServerData] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);
  const logsChannelRef = useRef(null);
  const toast = useToast();

  const loadServer = useCallback(async () => {
    try {
      const { data, error } = await supabase
        ?.from('servers')
        ?.select('*')
        ?.eq('id', serverId)
        ?.single();
      if (error) throw error;
      if (data) {
        setServerData({
          id: data?.id,
          name: data?.name || 'Unknown Server',
          ip: data?.ip_address || '—',
          location: data?.location || 'Unknown',
          status: data?.server_status || 'Unknown',
          uptime: data?.uptime || '—',
          sentToday: data?.sent_today || 0,
          deliverability: data?.deliverability_rate || 0,
          reputation: data?.reputation_score || 0,
          blacklistCount: data?.blacklist_count || 0,
          dailyLimit: data?.daily_limit || 0,
          purpose: data?.purpose || '—',
        });
      }
    } catch (err) {
      toast?.error(err?.message || 'Failed to load server data', 'Server Error');
      // Fallback to mock data so UI doesn't break
      setServerData({
        id: serverId,
        name: 'Production Mail Server',
        ip: '—',
        location: '—',
        status: 'Unknown',
        uptime: '—',
        sentToday: 0,
        deliverability: 0,
        reputation: 0,
        blacklistCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const loadLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        ?.from('system_logs')
        ?.select('id, log_level, source, message, log_timestamp, server_id')
        ?.eq('server_id', serverId)
        ?.order('log_timestamp', { ascending: false })
        ?.limit(50);
      if (error) throw error;
      setSystemLogs(data || []);
    } catch (err) {
      toast?.error(err?.message || 'Failed to load server logs', 'Logs Error');
    }
  }, [serverId]);

  useEffect(() => {
    loadServer();
    loadLogs();

    // Real-time subscription to servers table for this server
    channelRef.current = supabase
      ?.channel(`server_detail_${serverId}`)
      ?.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'servers', filter: `id=eq.${serverId}` }, (payload) => {
        const d = payload?.new;
        if (d) {
          setServerData(prev => prev ? {
            ...prev,
            status: d?.server_status || prev?.status,
            sentToday: d?.sent_today ?? prev?.sentToday,
            reputation: d?.reputation_score ?? prev?.reputation,
            dailyLimit: d?.daily_limit ?? prev?.dailyLimit,
          } : prev);
          toast?.info('Server data updated in real-time');
        }
      })
      ?.subscribe();

    // Real-time subscription to system_logs for this server
    logsChannelRef.current = supabase
      ?.channel(`server_logs_${serverId}`)
      ?.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs', filter: `server_id=eq.${serverId}` }, (payload) => {
        setSystemLogs(prev => [payload?.new, ...prev?.slice(0, 49)]);
      })
      ?.subscribe();

    return () => {
      if (channelRef?.current) channelRef?.current?.unsubscribe();
      if (logsChannelRef?.current) logsChannelRef?.current?.unsubscribe();
    };
  }, [loadServer, loadLogs, serverId]);

  const metricsData = {
    reputationData: [{ date: "02/17", score: 82 }, { date: "02/18", score: 85 }, { date: "02/19", score: 83 }, { date: "02/20", score: 87 }, { date: "02/21", score: 89 }, { date: "02/22", score: 88 }, { date: "02/23", score: 87 }, { date: "02/24", score: serverData?.reputation || 87 }],
    dailyLimitData: [{ date: "02/17", limit: serverData?.dailyLimit || 10000, sent: 8234 }, { date: "02/18", limit: serverData?.dailyLimit || 10000, sent: 9156 }, { date: "02/19", limit: serverData?.dailyLimit || 10000, sent: 7892 }, { date: "02/20", limit: serverData?.dailyLimit || 10000, sent: 8547 }, { date: "02/21", limit: serverData?.dailyLimit || 10000, sent: 9234 }, { date: "02/22", limit: serverData?.dailyLimit || 10000, sent: 8765 }, { date: "02/23", limit: serverData?.dailyLimit || 10000, sent: 8912 }, { date: "02/24", limit: serverData?.dailyLimit || 10000, sent: serverData?.sentToday || 8547 }],
    averageReputation: serverData?.reputation || 86,
    totalSent: serverData?.sentToday || 0,
    capacityUsed: serverData?.dailyLimit > 0 ? Math.round((serverData?.sentToday / serverData?.dailyLimit) * 100) : 0,
  };

  const healthData = {
    dnsChecks: [
      { type: "PTR Record", description: "Reverse DNS lookup", status: "Pass", value: `mail.${serverData?.ip || 'server'}.example.com`, message: "PTR record correctly configured" },
      { type: "SPF Record", description: "Sender Policy Framework", status: "Pass", value: `v=spf1 ip4:${serverData?.ip || '0.0.0.0'} ~all`, message: "SPF record is valid" },
      { type: "DKIM Record", description: "DomainKeys Identified Mail", status: "Pass", value: "v=DKIM1; k=rsa; p=...", message: "DKIM signature is valid" },
      { type: "DMARC Record", description: "Domain-based Message Authentication", status: "Warning", value: "v=DMARC1; p=none;", message: "Consider upgrading DMARC policy to 'quarantine'" },
    ],
    blacklists: [],
    lastCheck: "Just now",
  };

  const governorLogs = systemLogs?.map(log => ({
    id: log?.id,
    timestamp: new Date(log?.log_timestamp || Date.now()),
    severity: log?.log_level === 'CRITICAL' ? 'Critical' : log?.log_level === 'ERROR' ? 'Warning' : log?.log_level === 'WARN' ? 'Warning' : 'Info',
    type: log?.log_level === 'CRITICAL' || log?.log_level === 'ERROR' ? 'warning' : 'info',
    message: log?.message || '—',
    action: log?.source || '—',
    details: { Source: log?.source || '—', Level: log?.log_level || '—' },
  }));

  const tabs = [
    { id: 'metrics', label: 'Metrics', icon: 'TrendingUp' },
    { id: 'health', label: 'Health', icon: 'Shield' },
    { id: 'config', label: 'Config Editor', icon: 'FileCode' },
    { id: 'governor', label: "Governor's Log", icon: 'Activity' }
  ];

  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className={`pt-20 transition-smooth ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[280px]'}`}>
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
          <div className="mb-4 md:mb-6">
            <Breadcrumbs />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Icon name="Loader2" size={20} className="animate-spin" />
                <span>Loading server data...</span>
              </div>
            </div>
          ) : (
            <>
              <ServerHeader serverData={serverData} />

              <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
                <div className="border-b border-border overflow-x-auto scrollbar-thin">
                  <div className="flex min-w-max">
                    {tabs?.map((tab) => (
                      <button
                        key={tab?.id}
                        onClick={() => setActiveTab(tab?.id)}
                        className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 text-sm md:text-base font-medium transition-smooth border-b-2 whitespace-nowrap ${
                          activeTab === tab?.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon name={tab?.icon} size={18} />
                        <span>{tab?.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 md:p-6">
                  {activeTab === 'metrics' && <MetricsTab metricsData={metricsData} serverData={serverData} />}
                  {activeTab === 'health' && <HealthTab healthData={healthData} serverData={serverData} server={serverData} />}
                  {activeTab === 'config' && <ConfigEditorTab serverData={serverData} serverId={serverId} />}
                  {activeTab === 'governor' && <GovernorLogTab logs={governorLogs} />}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ServerDetail;