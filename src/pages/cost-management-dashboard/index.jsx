import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';
import { supabase, cacheGet, cacheSet } from '../../lib/supabase';
import ServiceBreakdownChart from './components/ServiceBreakdownChart';
import BudgetGauge from './components/BudgetGauge';
import CostTrendChart from './components/CostTrendChart';
import AIRecommendationsPanel from './components/AIRecommendationsPanel';
import CostMetricsRow from './components/CostMetricsRow';
import CostAlertsPanel from './components/CostAlertsPanel';
import { useToast } from '../../components/ui/Toast';
import { subscribeToNetworkStatus, withOfflineFallback, isOnline } from '../../utils/offlineDetection';

const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || '';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_SERVICE_DATA = [
  { name: 'Mail Servers', value: 480 },
  { name: 'MXToolbox API', value: 99 },
  { name: 'Domain Registrar', value: 145 },
  { name: 'Supabase', value: 75 },
  { name: 'Verification APIs', value: 120 },
  { name: 'Other', value: 31 },
];

const generateFallbackTrend = () => {
  const now = new Date();
  const currentMonth = now?.getMonth();
  return MONTHS?.map((month, i) => {
    const base = 850 + Math.sin(i * 0.5) * 120;
    return {
      month,
      actual: i <= currentMonth ? Math.round(base) : null,
      projected: i > currentMonth ? Math.round(base * 1.05) : null,
    };
  });
};

const generateAlerts = (actual, budget) => {
  const alerts = [];
  if (budget > 0) {
    const pct = (actual / budget) * 100;
    if (pct > 110) {
      alerts?.push({
        id: 'alert-over-budget',
        severity: 'critical',
        title: `Spending ${(pct - 100)?.toFixed(1)}% over budget`,
        message: `Current spend $${actual?.toLocaleString()} exceeds budget $${budget?.toLocaleString()} by $${(actual - budget)?.toLocaleString()}. Immediate review required.`,
      });
    } else if (pct > 90) {
      alerts?.push({
        id: 'alert-near-budget',
        severity: 'warning',
        title: 'Approaching budget limit',
        message: `${pct?.toFixed(1)}% of monthly budget consumed. ${(100 - pct)?.toFixed(1)}% remaining.`,
      });
    }
  }
  return alerts;
};

const CostManagementDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [serviceData, setServiceData] = useState(DEFAULT_SERVICE_DATA);
  const [trendData, setTrendData] = useState(generateFallbackTrend());
  const [budget, setBudget] = useState(1200);
  const [actual, setActual] = useState(950);
  const [emailsSent, setEmailsSent] = useState(0);
  const [filterPeriod, setFilterPeriod] = useState('current-month');
  const [exporting, setExporting] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const toast = useToast();

  const costPerEmail = emailsSent > 0 ? actual / emailsSent : 0;
  const alerts = generateAlerts(actual, budget);

  const loadCostData = useCallback(async () => {
    setLoading(true);
    const cacheKey = `costs_supabase_${filterPeriod}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      applyData(cached);
      setLoading(false);
      return;
    }

    const { data: campaigns, fromCache, error: fetchError } = await withOfflineFallback(
      async () => {
        const { data, error } = await supabase
          ?.from('campaigns')
          ?.select('sent_count, created_at');
        if (error) throw error;
        return data;
      },
      `cost_campaigns_${filterPeriod}`,
      (msg) => toast?.warning(msg, 'Cost Data')
    );

    if (fetchError && !fromCache) {
      setSupabaseConnected(false);
      setLoading(false);
      return;
    }

    const totalSent = (campaigns || [])?.reduce((sum, c) => sum + (c?.sent_count || 0), 0);
    setEmailsSent(totalSent);
    setSupabaseConnected(true);

    const result = {
      actual: 950,
      budget: 1200,
      emailsSent: totalSent,
      services: DEFAULT_SERVICE_DATA,
    };
    cacheSet(cacheKey, result);
    applyData(result);
    setLoading(false);
  }, [filterPeriod]);

  const applyData = ({ svcData, totalActual, totalBudget, trendData: td }) => {
    if (svcData?.length) setServiceData(svcData);
    if (totalActual > 0) setActual(totalActual);
    if (totalBudget > 0) setBudget(totalBudget);
    if (td?.length) setTrendData(td);
  };

  useEffect(() => {
    loadCostData();

    // Real-time: listen for campaign changes to update email sent count
    const campaignsChannel = supabase
      ?.channel('cost_campaigns_realtime')
      ?.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns' }, (payload) => {
        const updated = payload?.new;
        if (updated?.sent_count !== undefined) {
          setEmailsSent(prev => {
            const diff = (updated?.sent_count || 0) - (payload?.old?.sent_count || 0);
            return Math.max(0, prev + diff);
          });
        }
      })
      ?.subscribe();

    // Real-time: listen for new anomalies that may affect costs
    const anomaliesChannel = supabase
      ?.channel('cost_anomalies_realtime')
      ?.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anomalies' }, (payload) => {
        const anomaly = payload?.new;
        if (anomaly?.severity === 'Critical') {
          toast?.error(anomaly?.description || 'Critical anomaly may impact costs', 'Cost Alert');
        }
      })
      ?.subscribe();

    // Offline detection
    const unsubscribeNetwork = subscribeToNetworkStatus(
      () => {
        setIsOffline(false);
        toast?.success('Connection restored', 'Back Online');
        loadCostData();
      },
      () => {
        setIsOffline(true);
        toast?.warning('You are offline. Showing cached data.', 'Connection Lost');
      }
    );

    return () => {
      campaignsChannel?.unsubscribe?.();
      anomaliesChannel?.unsubscribe?.();
      unsubscribeNetwork?.();
    };
  }, [loadCostData]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const rows = [
        ['Service', 'Monthly Cost', 'Budget', 'Variance'],
        ...serviceData?.map(s => [
          s?.name,
          s?.value,
          Math.round(budget / serviceData?.length),
          s?.value - Math.round(budget / serviceData?.length),
        ]),
        ['TOTAL', actual, budget, actual - budget],
      ];
      const csv = rows?.map(r => r?.join(','))?.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost-report-${new Date()?.toISOString()?.slice(0, 7)}.csv`;
      a?.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Cost Management', href: '/cost-management-dashboard' },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(prev => !prev)} />
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <Breadcrumbs items={breadcrumbs} />
                <h1 className="text-2xl font-bold text-foreground mt-1">Cost Management</h1>
                <p className="text-sm text-muted-foreground">Financial oversight and AI-driven cost optimization</p>
              </div>
              <div className="flex items-center gap-3">
                {isOffline && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/30">
                    <Icon name="WifiOff" size={12} className="text-warning" />
                    <span className="text-xs text-warning">Offline — Cached Data</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                  <span className={`text-xs ${supabaseConnected ? 'text-success' : 'text-warning'}`}>
                    {supabaseConnected ? 'Supabase Connected' : 'Connecting...'}
                  </span>
                </div>
                <select
                  value={filterPeriod}
                  onChange={e => setFilterPeriod(e?.target?.value)}
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="current-month">Current Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="last-3-months">Last 3 Months</option>
                  <option value="ytd">Year to Date</option>
                </select>
                <button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Icon name={exporting ? 'Loader2' : 'Download'} size={14} className={exporting ? 'animate-spin' : ''} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Cost Alerts */}
            {alerts?.length > 0 && <CostAlertsPanel alerts={alerts} />}

            {/* KPI Metrics Row */}
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)]?.map((_, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl p-4 h-24 animate-pulse" />
                ))}
              </div>
            ) : (
              <CostMetricsRow
                totalSpend={actual}
                budget={budget}
                emailsSent={emailsSent}
                costPerEmail={costPerEmail}
              />
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {loading ? (
                  <div className="bg-surface border border-border rounded-xl p-5 h-80 animate-pulse" />
                ) : (
                  <ServiceBreakdownChart data={serviceData} />
                )}
              </div>
              <div>
                {loading ? (
                  <div className="bg-surface border border-border rounded-xl p-5 h-80 animate-pulse" />
                ) : (
                  <BudgetGauge budget={budget} actual={actual} />
                )}
              </div>
            </div>

            {/* Trend Chart */}
            {loading ? (
              <div className="bg-surface border border-border rounded-xl p-5 h-64 animate-pulse" />
            ) : (
              <CostTrendChart data={trendData} />
            )}

            {/* AI Recommendations */}
            <AIRecommendationsPanel
              onApprove={(rec) => console.log('Applying recommendation:', rec?.title)}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default CostManagementDashboard;
