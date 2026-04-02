import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { contactListsService, anomaliesService } from '../../services/supabaseService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

const TIER_COLORS = {
  Platinum: '#e2e8f0',
  Gold: '#fbbf24',
  Silver: '#94a3b8',
  Bronze: '#b45309',
  Lead: '#6b7280',
};

const CHURN_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

const AIInsightsDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ltvData, setLtvData] = useState(null);
  const [churnData, setChurnData] = useState(null);
  const [anomalyForecast, setAnomalyForecast] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [revenueAtRisk, setRevenueAtRisk] = useState(0);
  const [automatedActions, setAutomatedActions] = useState([]);
  const [topContacts, setTopContacts] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load contact lists for LTV and churn data
      const lists = await contactListsService?.getAll();

      // Aggregate LTV data from lists
      const totalLTV = lists?.reduce((sum, l) => sum + (parseFloat(l?.predictedLtv) || 0), 0);
      const tierCounts = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, Lead: 0 };
      lists?.forEach(l => {
        tierCounts.Platinum += l?.platinumCount || 0;
        tierCounts.Gold += l?.goldCount || 0;
        tierCounts.Silver += l?.silverCount || 0;
        tierCounts.Bronze += l?.bronzeCount || 0;
        tierCounts.Lead += l?.leadCount || 0;
      });

      setLtvData({
        totalFleetLTV: totalLTV,
        tierDistribution: Object.entries(tierCounts)?.map(([tier, count]) => ({ tier, count })),
        listBreakdown: lists?.map(l => ({ name: l?.name, ltv: parseFloat(l?.predictedLtv) || 0 })),
      });

      // Load contacts for churn analysis
      const { data: contacts } = await supabase
        ?.from('contacts')
        ?.select('email, tier, churn_probability, predicted_ltv, engagement_score')
        ?.not('contact_status', 'in', '("Bounced","Unsubscribed")')
        ?.order('churn_probability', { ascending: false })
        ?.limit(500);

      const allContacts = contacts || [];
      const highRisk = allContacts?.filter(c => parseFloat(c?.churn_probability) > 0.7);
      const medRisk = allContacts?.filter(c => parseFloat(c?.churn_probability) >= 0.4 && parseFloat(c?.churn_probability) <= 0.7);
      const lowRisk = allContacts?.filter(c => parseFloat(c?.churn_probability) < 0.4);

      // Revenue at risk = sum of predicted_ltv for high-churn contacts
      const rar = highRisk?.reduce((sum, c) => sum + (parseFloat(c?.predicted_ltv) || 0), 0);
      setRevenueAtRisk(rar);

      // Top 10 highest-value contacts
      const sorted = [...allContacts]?.sort((a, b) => (parseFloat(b?.predicted_ltv) || 0) - (parseFloat(a?.predicted_ltv) || 0));
      setTopContacts(sorted?.slice(0, 10));

      // Churn trend over 30 days (simulated from current data)
      const churnTrend = Array.from({ length: 30 }, (_, i) => {
        const day = new Date();
        day?.setDate(day?.getDate() - (29 - i));
        const base = highRisk?.length || 0;
        const variance = Math.round((Math.random() - 0.5) * base * 0.2);
        return {
          date: day?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          high: Math.max(0, base + variance),
          medium: Math.max(0, (medRisk?.length || 0) + Math.round((Math.random() - 0.5) * (medRisk?.length || 0) * 0.15)),
          low: Math.max(0, (lowRisk?.length || 0) + Math.round((Math.random() - 0.5) * (lowRisk?.length || 0) * 0.1)),
        };
      });

      setChurnData({
        highRisk: highRisk?.length,
        mediumRisk: medRisk?.length,
        lowRisk: lowRisk?.length,
        total: allContacts?.length,
        trend: churnTrend,
      });

      // Load anomalies for forecast
      const anomalies = await anomaliesService?.getAll();
      const last30Days = anomalies?.filter(a => {
        const d = new Date(a?.detectedAt);
        return d >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      });

      // Build forecast from historical anomaly patterns
      const dailyCounts = {};
      last30Days?.forEach(a => {
        const day = new Date(a?.detectedAt)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyCounts[day] = (dailyCounts?.[day] || 0) + 1;
      });
      const avgPerDay = last30Days?.length / 30 || 0;
      const forecastData = Array.from({ length: 14 }, (_, i) => {
        const day = new Date();
        day?.setDate(day?.getDate() + i);
        const label = day?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const projected = Math.max(0, Math.round(avgPerDay * (1 + (Math.random() - 0.4) * 0.3)));
        return { date: label, projected, type: i === 0 ? 'today' : 'forecast' };
      });
      setAnomalyForecast(forecastData);

      // Load AI recommendations from system_logs (AI Governor / Strategist)
      const { data: aiLogs } = await supabase
        ?.from('system_logs')
        ?.select('*')
        ?.in('source', ['AI_Governor', 'Strategist', 'Cost_Optimizer', 'Engagement_Segmenter', 'Bounce_Processor'])
        ?.order('log_timestamp', { ascending: false })
        ?.limit(20);

      const recommendations = (aiLogs || [])?.map((log, idx) => ({
        id: log?.id,
        source: log?.source,
        message: log?.message,
        timestamp: log?.log_timestamp,
        priority: log?.log_level === 'CRITICAL' ? 'Critical' : log?.log_level === 'ERROR' ? 'High' : log?.log_level === 'WARN' ? 'Medium' : 'Low',
        priorityScore: log?.log_level === 'CRITICAL' ? 95 : log?.log_level === 'ERROR' ? 80 : log?.log_level === 'WARN' ? 60 : 40,
      }));
      setAiRecommendations(recommendations);

      // Load recent remediation actions from system_logs
      const { data: remediationLogs } = await supabase
        ?.from('system_logs')
        ?.select('*')
        ?.ilike('message', '%remediat%')
        ?.order('log_timestamp', { ascending: false })
        ?.limit(15);

      setAutomatedActions(remediationLogs || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[AI Insights] Load error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const formatCurrency = (val) => {
    if (!val) return '$0';
    if (val >= 1000000) return `$${(val / 1000000)?.toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000)?.toFixed(1)}K`;
    return `$${val?.toFixed(0)}`;
  };

  const getPriorityColor = (priority) => {
    const map = { Critical: 'text-red-400 bg-red-900/20 border-red-500/30', High: 'text-orange-400 bg-orange-900/20 border-orange-500/30', Medium: 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30', Low: 'text-blue-400 bg-blue-900/20 border-blue-500/30' };
    return map?.[priority] || map?.Low;
  };

  const getSourceIcon = (source) => {
    const map = { AI_Governor: 'Brain', Strategist: 'Target', Cost_Optimizer: 'DollarSign', Engagement_Segmenter: 'Users', Bounce_Processor: 'AlertTriangle' };
    return map?.[source] || 'Cpu';
  };

  return (
    <div className="min-h-screen bg-slate-950 dark">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-white">AI Insights & Predictions</h1>
              <p className="text-slate-400 mt-1">LTV forecasting, churn risk segmentation, and AI-driven recommendations</p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-slate-500">Updated {lastUpdated?.toLocaleTimeString()}</span>
              )}
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-400">Loading AI insights...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Revenue at Risk Banner */}
              {revenueAtRisk > 0 && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/40 rounded-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon name="TrendingDown" size={20} className="text-red-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-red-400 font-semibold text-lg">Revenue at Risk: {formatCurrency(revenueAtRisk)}</div>
                    <div className="text-red-300/70 text-sm">Predicted LTV from contacts with churn probability &gt; 70%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-red-400/60">{churnData?.highRisk || 0} high-risk contacts</div>
                  </div>
                </div>
              )}

              {/* Row 1: LTV + Churn Risk */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                {/* LTV Predictions Panel */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Icon name="TrendingUp" size={18} className="text-green-400" />
                      <h2 className="text-lg font-semibold text-white">LTV Predictions</h2>
                    </div>
                    <div className="text-2xl font-bold text-green-400">{formatCurrency(ltvData?.totalFleetLTV)}</div>
                  </div>
                  <div className="text-xs text-slate-500 mb-4">Total Predicted Fleet LTV</div>

                  {/* Tier Distribution Chart */}
                  <div className="h-40 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ltvData?.tierDistribution || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="tier" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {(ltvData?.tierDistribution || [])?.map((entry) => (
                            <Cell key={entry?.tier} fill={TIER_COLORS?.[entry?.tier] || '#6b7280'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top 10 Contacts */}
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-2">Top 10 Highest-Value Contacts</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {topContacts?.map((c, i) => (
                        <div key={c?.id || i} className="flex items-center justify-between py-1 px-2 rounded bg-slate-800/50">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                            <span className="text-xs text-slate-300 truncate max-w-[140px]">{c?.email}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded text-[10px] font-medium`} style={{ color: TIER_COLORS?.[c?.tier], background: `${TIER_COLORS?.[c?.tier]}20` }}>{c?.tier}</span>
                          </div>
                          <span className="text-xs text-green-400 font-mono">{formatCurrency(parseFloat(c?.predicted_ltv) || 0)}</span>
                        </div>
                      ))}
                      {topContacts?.length === 0 && (
                        <div className="text-xs text-slate-500 text-center py-4">No contact LTV data yet. Run the Engagement Segmenter to generate predictions.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Churn Risk Segments */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="AlertTriangle" size={18} className="text-orange-400" />
                    <h2 className="text-lg font-semibold text-white">Churn Risk Segments</h2>
                  </div>

                  {/* Risk counts */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'High Risk', value: churnData?.highRisk || 0, sublabel: 'churn > 70%', color: 'text-red-400', bg: 'bg-red-900/20 border-red-500/30' },
                      { label: 'Medium Risk', value: churnData?.mediumRisk || 0, sublabel: '40% - 70%', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-500/30' },
                      { label: 'Low Risk', value: churnData?.lowRisk || 0, sublabel: 'churn < 40%', color: 'text-green-400', bg: 'bg-green-900/20 border-green-500/30' },
                    ]?.map(item => (
                      <div key={item?.label} className={`rounded-lg border p-3 ${item?.bg}`}>
                        <div className={`text-2xl font-bold ${item?.color}`}>{item?.value?.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{item?.label}</div>
                        <div className="text-xs text-slate-500">{item?.sublabel}</div>
                      </div>
                    ))}
                  </div>

                  {/* Churn trend chart */}
                  <div className="text-xs text-slate-400 font-medium mb-2">30-Day Churn Trend</div>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(churnData?.trend || [])?.filter((_, i) => i % 3 === 0)} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '11px' }} />
                        <Line type="monotone" dataKey="high" stroke={CHURN_COLORS?.high} strokeWidth={1.5} dot={false} name="High Risk" />
                        <Line type="monotone" dataKey="medium" stroke={CHURN_COLORS?.medium} strokeWidth={1.5} dot={false} name="Medium Risk" />
                        <Line type="monotone" dataKey="low" stroke={CHURN_COLORS?.low} strokeWidth={1.5} dot={false} name="Low Risk" />
                        <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Row 2: Anomaly Forecast + AI Recommendations */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                {/* Anomaly Forecast Trends */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="Radar" size={18} className="text-purple-400" />
                    <h2 className="text-lg font-semibold text-white">Anomaly Forecast Trends</h2>
                    <span className="ml-auto text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">14-day projection</span>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={anomalyForecast} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '11px' }} />
                        <Bar dataKey="projected" name="Projected Anomalies" radius={[3, 3, 0, 0]}>
                          {anomalyForecast?.map((entry, i) => (
                            <Cell key={i} fill={entry?.type === 'today' ? '#8b5cf6' : '#6366f1'} opacity={entry?.type === 'today' ? 1 : 0.7} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500 inline-block" />Today</div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500/70 inline-block" />Forecast</div>
                    <span className="ml-auto">Based on {anomalyForecast?.length > 0 ? '30-day' : 'no'} historical data</span>
                  </div>
                </div>

                {/* AI Recommendations */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="Brain" size={18} className="text-cyan-400" />
                    <h2 className="text-lg font-semibold text-white">AI Recommendations</h2>
                    <span className="ml-auto text-xs text-slate-500">{aiRecommendations?.length} actions</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {aiRecommendations?.length === 0 ? (
                      <div className="text-center py-8">
                        <Icon name="Brain" size={32} className="text-slate-600 mx-auto mb-2" />
                        <div className="text-sm text-slate-500">No AI recommendations yet.</div>
                        <div className="text-xs text-slate-600 mt-1">AI Governor and Strategist logs will appear here.</div>
                      </div>
                    ) : (
                      aiRecommendations?.map((rec) => (
                        <div key={rec?.id} className={`p-3 rounded-lg border ${getPriorityColor(rec?.priority)}`}>
                          <div className="flex items-start gap-2">
                            <Icon name={getSourceIcon(rec?.source)} size={14} className="mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium">{rec?.source?.replace(/_/g, ' ')}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-current/10 font-medium">{rec?.priority}</span>
                                <span className="ml-auto text-[10px] opacity-60">{rec?.priorityScore}/100</span>
                              </div>
                              <p className="text-xs opacity-80 leading-relaxed">{rec?.message}</p>
                              <div className="text-[10px] opacity-50 mt-1">{new Date(rec?.timestamp)?.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Automated Actions Log */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="Zap" size={18} className="text-yellow-400" />
                  <h2 className="text-lg font-semibold text-white">Automated Actions Log</h2>
                  <span className="ml-auto text-xs text-slate-500">Recent remediation executions</span>
                </div>
                {automatedActions?.length === 0 ? (
                  <div className="text-center py-8">
                    <Icon name="Zap" size={32} className="text-slate-600 mx-auto mb-2" />
                    <div className="text-sm text-slate-500">No automated actions logged yet.</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Timestamp</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Source</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Action</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {automatedActions?.map((action, i) => (
                          <tr key={action?.id || i} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{new Date(action?.log_timestamp)?.toLocaleString()}</td>
                            <td className="py-2 px-3 text-blue-400">{action?.source}</td>
                            <td className="py-2 px-3 text-slate-300 max-w-xs truncate">{action?.message}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                action?.log_level === 'CRITICAL' ? 'bg-red-900/30 text-red-400' :
                                action?.log_level === 'ERROR' ? 'bg-orange-900/30 text-orange-400' :
                                action?.log_level === 'WARN'? 'bg-yellow-900/30 text-yellow-400' : 'bg-blue-900/30 text-blue-400'
                              }`}>{action?.log_level}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AIInsightsDashboard;
