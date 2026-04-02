import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import ServerHeader from '../server-detail/components/ServerHeader';
import TimelineOfEvents from './components/TimelineOfEvents';
import ContactZero from './components/ContactZero';
import RehabilitationPlan from './components/RehabilitationPlan';
import DiagnosticTools from './components/DiagnosticTools';
import QuarantineLog from './components/QuarantineLog';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import { exportAutopsyPDF, exportAutopsyCSV } from '../../services/exportService';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || '';

const ServerAutopsy = () => {
  const [searchParams] = useSearchParams();
  const serverId = searchParams?.get('id') || '1';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [autopsyData, setAutopsyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { user } = useAuth();

  const fetchAutopsy = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch directly from Supabase
    try {
      const { data: server, error: sErr } = await supabase
        ?.from('servers')
        ?.select('*')
        ?.eq('id', serverId)
        ?.single();
      if (sErr) throw sErr;

      const { data: logs } = await supabase
        ?.from('system_logs')
        ?.select('*')
        ?.eq('server_id', serverId)
        ?.order('timestamp', { ascending: true })
        ?.limit(200);

      const allLogs = logs || [];
      const timeline = allLogs?.map(log => ({
        id: log?.id,
        timestamp: log?.timestamp,
        event_type: inferEventType(log?.source, log?.message, log?.level),
        description: log?.message,
        severity: log?.level,
        source: log?.source,
        title: formatEventTitle(log?.source, log?.level),
        automated: true,
        details: {}
      }));

      const blacklistStatus = server?.blacklist_status || {};
      const reputationTrajectory = buildLocalTrajectory(allLogs, server?.reputation_score);
      const rehabilitationProgress = buildLocalRehab(server, allLogs);

      setAutopsyData({
        server,
        timeline,
        blacklist_history: blacklistStatus?.listings || [],
        reputation_trajectory: reputationTrajectory,
        rehabilitation_progress: rehabilitationProgress,
        contact_zero: null
      });
    } catch (err) {
      setError(err?.message || 'Failed to load autopsy data');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { fetchAutopsy(); }, [fetchAutopsy]);

  const handleManualPromote = async () => {
    setPromoting(true);
    try {
      const { error } = await supabase
        ?.from('servers')
        ?.update({ server_status: 'Active', health_last_checked: new Date()?.toISOString() })
        ?.eq('id', serverId);
      if (error) throw error;
      setPromoteSuccess(true);
      setShowOverrideModal(false);
      await fetchAutopsy();
    } catch (e) {
      await supabase?.from('servers')?.update({ status: 'Active', last_strategy_change: 'Manually promoted to Production' })?.eq('id', serverId);
      setPromoteSuccess(true);
      setShowOverrideModal(false);
      await fetchAutopsy();
    } finally {
      setPromoting(false);
    }
  };

  const handleExportPDF = () => {
    setShowExportMenu(false);
    exportAutopsyPDF({
      autopsyData,
      serverData,
      generatedBy: user?.email || 'System',
    });
  };

  const handleExportCSV = () => {
    setShowExportMenu(false);
    exportAutopsyCSV({ autopsyData, serverData });
  };

  // Build server data for ServerHeader
  const srv = autopsyData?.server || {};
  const serverData = {
    id: srv?.id || serverId,
    name: srv?.name || 'Loading...',
    ip: srv?.ip_address || '—',
    location: srv?.hostname || '—',
    status: srv?.status || 'Unknown',
    uptime: '—',
    sentToday: srv?.sent_today || 0,
    deliverability: autopsyData?.rehabilitation_progress?.deliverability_rate_7d || 0,
    reputation: srv?.reputation_score || 0,
    blacklistCount: srv?.blacklist_count || 0,
    purpose: srv?.purpose || '—',
    quarantinedAt: srv?.quarantined_at ? new Date(srv?.quarantined_at) : null,
    quarantineReason: srv?.quarantine_reason || '—'
  };

  // Map timeline to component format
  const timelineEvents = (autopsyData?.timeline || [])?.slice(-20)?.reverse()?.map(evt => ({
    id: evt?.id || Math.random(),
    timestamp: new Date(evt?.timestamp),
    severity: mapSeverity(evt?.severity),
    type: evt?.event_type,
    title: evt?.title || formatEventTitle(evt?.source, evt?.severity),
    description: evt?.description,
    details: evt?.metadata || {},
    automated: true
  }));

  // Map contact zero
  const cz = autopsyData?.contact_zero;
  const contactZeroData = cz ? {
    email: cz?.email || 'Unknown',
    name: cz?.name || 'Unknown',
    tier: cz?.tier || 'Unknown',
    engagementScore: cz?.engagement_score || 0,
    lastOpened: cz?.last_open_date || 'N/A',
    bounceHistory: cz?.bounce_count || 0,
    complaintHistory: 0,
    campaign: { id: '', name: 'Unknown Campaign', subject: '—', riskScore: 0, contentScore: 0 },
    triggerDetails: {
      smtpCode: '—',
      smtpMessage: cz?.trigger_log?.message || '—',
      isp: '—',
      timestamp: cz?.trigger_log?.timestamp ? new Date(cz?.trigger_log?.timestamp) : new Date()
    }
  } : {
    email: 'Not identified',
    name: 'Unknown',
    tier: 'Unknown',
    engagementScore: 0,
    lastOpened: 'N/A',
    bounceHistory: 0,
    complaintHistory: 0,
    campaign: { id: '', name: '—', subject: '—', riskScore: 0, contentScore: 0 },
    triggerDetails: { smtpCode: '—', smtpMessage: 'No trigger identified', isp: '—', timestamp: new Date() }
  };

  // Map rehabilitation data
  const rehab = autopsyData?.rehabilitation_progress;
  const rehabilitationData = rehab ? {
    currentPhase: Math.ceil((rehab?.current_step || 1) / 2),
    daysInQuarantine: rehab?.days_in_quarantine || 0,
    estimatedCompletion: new Date(Date.now() + Math.max(0, (7 - (rehab?.days_in_quarantine || 0))) * 24 * 60 * 60 * 1000),
    phases: [
      {
        id: 1, name: 'Investigation', status: rehab?.current_step >= 2 ? 'completed' : 'in_progress',
        completedAt: rehab?.current_step >= 2 ? new Date() : null,
        tasks: [
          { name: 'Identify root cause', completed: rehab?.current_step >= 2 },
          { name: 'Analyze campaign content', completed: rehab?.current_step >= 2 },
          { name: 'Review contact list quality', completed: rehab?.current_step >= 2 },
          { name: 'Check DNS/SPF/DKIM records', completed: rehab?.current_step >= 2 }
        ]
      },
      {
        id: 2, name: 'Blacklist Removal', status: rehab?.current_step >= 4 ? 'completed' : rehab?.current_step >= 3 ? 'in_progress' : 'pending',
        progress: rehab?.current_step >= 3 ? Math.min(100, (rehab?.test_sends?.success_rate || 0)) : 0,
        tasks: [
          { name: 'Submit delisting requests', completed: rehab?.current_step >= 3 },
          { name: 'Test sends to Golden List', completed: rehab?.test_sends?.count > 0 },
          { name: `Test send success rate: ${rehab?.test_sends?.success_rate || 0}%`, completed: rehab?.test_sends?.success_rate >= 80 },
          { name: 'Verify removal from blacklists', completed: rehab?.current_step >= 4 }
        ]
      },
      {
        id: 3, name: 'Reputation Recovery', status: rehab?.current_step >= 6 ? 'completed' : rehab?.current_step >= 5 ? 'in_progress' : 'pending',
        tasks: [
          { name: 'Zero complaints achieved', completed: rehab?.zero_complaints_achieved },
          { name: '7-day deliverability rate', completed: rehab?.deliverability_rate_7d >= 95 },
          { name: `Current rate: ${rehab?.deliverability_rate_7d || 0}%`, completed: rehab?.deliverability_rate_7d >= 95 },
          { name: 'Reputation score recovery', completed: (srv?.reputation_score || 0) >= 70 }
        ]
      },
      {
        id: 4, name: 'Production Return', status: rehab?.ready_for_promotion ? 'completed' : 'pending',
        tasks: [
          { name: 'Reputation score 85+', completed: (srv?.reputation_score || 0) >= 85 },
          { name: 'Zero complaints (7 days)', completed: rehab?.zero_complaints_achieved },
          { name: '95%+ deliverability', completed: rehab?.deliverability_rate_7d >= 95 },
          { name: 'Ready for promotion', completed: rehab?.ready_for_promotion }
        ]
      }
    ]
  } : {
    currentPhase: 1, daysInQuarantine: 0,
    estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    phases: []
  };

  // Diagnostic data from autopsy
  const repTraj = autopsyData?.reputation_trajectory;
  const diagnosticData = {
    dnsStatus: {
      ptr: { status: 'Unknown', value: srv?.hostname || '—' },
      spf: { status: 'Unknown', value: '—' },
      dkim: { status: 'Unknown', value: '—' },
      dmarc: { status: 'Unknown', value: '—' }
    },
    blacklists: (autopsyData?.blacklist_history || [])?.map(b => ({
      name: b?.rbl,
      listed: b?.listed,
      delistUrl: '#'
    })),
    reputationTrend: (repTraj?.data || [])?.slice(-7)?.map(d => ({ date: d?.date, score: d?.score }))
  };

  // Quarantine log from timeline
  const quarantineLog = (autopsyData?.timeline || [])
    ?.filter(e => e?.event_type === 'quarantine' || e?.severity === 'CRITICAL')
    ?.slice(0, 10)
    ?.map((e, i) => ({
      id: `qlog-${i}`,
      timestamp: new Date(e?.timestamp),
      action: e?.title || 'System Event',
      reason: e?.description?.slice(0, 80) || '—',
      automatedBy: e?.source || 'System',
      details: e?.description || '—'
    }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={`pt-20 transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[280px]'
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6 md:mb-8">
            <Breadcrumbs />
          </div>

          {/* Header actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="Stethoscope" size={20} className="text-error" />
              <span className="text-lg font-heading font-semibold text-foreground">Server Autopsy Report</span>
            </div>
            <div className="flex items-center gap-3">
              {promoteSuccess && (
                <span className="flex items-center gap-1.5 text-sm text-success">
                  <Icon name="CheckCircle" size={14} />
                  Promoted to Production
                </span>
              )}
              {/* Export Button */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="Download" size={14} />
                  Export Report
                  <Icon name="ChevronDown" size={12} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Icon name="FileText" size={14} className="text-red-400" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Icon name="Table" size={14} className="text-green-400" />
                      Export as CSV
                    </button>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" iconName="RefreshCw" iconPosition="left" onClick={fetchAutopsy}>
                Refresh
              </Button>
              {srv?.status === 'Quarantined' && (
                <Button
                  variant="primary"
                  size="sm"
                  iconName="ArrowUpCircle"
                  iconPosition="left"
                  onClick={() => setShowOverrideModal(true)}
                >
                  Manually Promote to Production
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Icon name="Loader2" size={32} className="text-primary animate-spin" />
              <p className="text-muted-foreground">Loading autopsy data for server {serverId}...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Icon name="AlertCircle" size={32} className="text-error" />
              <p className="text-error font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchAutopsy}>Retry</Button>
            </div>
          ) : (
            <>
              <ServerHeader serverData={serverData} />

              {/* Reputation Trajectory Chart */}
              {repTraj?.data?.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-heading font-semibold text-foreground">Reputation Trajectory (30 Days)</h2>
                      <p className="text-sm text-muted-foreground">
                        Trend: <span className={`font-medium ${
                          repTraj?.trend === 'improving' ? 'text-success' :
                          repTraj?.trend === 'declining' ? 'text-error' : 'text-warning'
                        }`}>{repTraj?.trend} ({repTraj?.trend_delta >= 0 ? '+' : ''}{repTraj?.trend_delta} pts)</span>
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon name="TrendingUp" size={20} className="text-primary" />
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={repTraj?.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} interval={4} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                      <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                        labelStyle={{ color: '#ccc' }}
                        itemStyle={{ color: '#7c3aed' }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                  <TimelineOfEvents events={timelineEvents?.length > 0 ? timelineEvents : getFallbackTimeline()} />
                </div>
                <div>
                  <ContactZero data={contactZeroData} />
                </div>
              </div>

              <div className="mb-6">
                <RehabilitationPlan
                  data={rehabilitationData}
                  onManualOverride={() => setShowOverrideModal(true)}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <DiagnosticTools data={diagnosticData} />
                <QuarantineLog logs={quarantineLog?.length > 0 ? quarantineLog : getFallbackQuarantineLog()} />
              </div>

              {/* Blacklist History */}
              {autopsyData?.blacklist_history?.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6 mb-6">
                  <h2 className="text-lg font-heading font-semibold text-foreground mb-4">Blacklist History</h2>
                  <div className="space-y-3">
                    {autopsyData?.blacklist_history?.map((bl, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${bl?.listed ? 'bg-error' : 'bg-success'}`} />
                          <span className="text-sm font-medium text-foreground">{bl?.rbl}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {bl?.listed_at && <span>Listed: {new Date(bl?.listed_at)?.toLocaleDateString()}</span>}
                          {bl?.delisted_at && <span>Delisted: {new Date(bl?.delisted_at)?.toLocaleDateString()}</span>}
                          <span className={`px-2 py-0.5 rounded font-medium ${
                            bl?.listed ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                          }`}>{bl?.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Manual Promote Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card rounded-lg border border-error shadow-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <Icon name="AlertTriangle" size={24} className="text-error flex-shrink-0" />
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                  Manually Promote to Production
                </h3>
                <p className="text-sm text-muted-foreground">
                  You are about to force this quarantined server back to Production status. This bypasses all safety protocols and may result in:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Further IP reputation damage</li>
                  <li>• Additional blacklist listings</li>
                  <li>• Campaign delivery failures</li>
                  <li>• ISP blocks and policy violations</li>
                </ul>
                {rehab?.ready_for_promotion && (
                  <div className="mt-3 p-2 bg-success/10 border border-success/30 rounded text-xs text-success">
                    ✓ Rehabilitation complete — server is ready for promotion
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowOverrideModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleManualPromote}
                className="flex-1"
                disabled={promoting}
              >
                {promoting ? 'Promoting...' : 'Confirm Promote'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helpers
function inferEventType(source, message, level) {
  const msg = (message || '')?.toLowerCase();
  const src = (source || '')?.toLowerCase();
  if (msg?.includes('quarantine') || src?.includes('quarantine')) return 'quarantine';
  if (msg?.includes('blacklist') || msg?.includes('rbl')) return 'blacklist_detected';
  if (msg?.includes('reputation') || msg?.includes('score')) return 'reputation_change';
  if (msg?.includes('campaign') || msg?.includes('sent')) return 'campaign_sent';
  if (src?.includes('health') || msg?.includes('health')) return 'health_check';
  return 'system_event';
}

function formatEventTitle(source, level) {
  if (!source) return 'System Event';
  const titles = {
    AI_Governor: 'AI Governor Action',
    Health_Monitor: 'Health Check',
    Campaign_Dispatcher: 'Campaign Event',
    Blacklist_Scanner: 'Blacklist Scan',
    Engagement_Segmenter: 'Engagement Update',
    Manual_Action: 'Manual Action',
    Anomaly_Remediator: 'Anomaly Remediation'
  };
  return titles?.[source] || source?.replace(/_/g, ' ');
}

function mapSeverity(level) {
  if (level === 'CRITICAL' || level === 'ERROR') return 'Critical';
  if (level === 'WARN' || level === 'WARNING') return 'Warning';
  return 'Info';
}

function buildLocalTrajectory(logs, currentScore) {
  const now = new Date();
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now?.getTime() - i * 24 * 60 * 60 * 1000);
    data?.push({ date: date?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }), score: currentScore || 50 });
  }
  return { data, trend: 'stable', trend_delta: 0, current_score: currentScore || 50 };
}

function buildLocalRehab(server, logs) {
  const daysInQuarantine = server?.quarantined_at
    ? Math.floor((Date.now() - new Date(server?.quarantined_at)) / (1000 * 60 * 60 * 24))
    : 0;
  return {
    current_step: Math.min(7, daysInQuarantine + 1),
    total_steps: 7,
    days_in_quarantine: daysInQuarantine,
    test_sends: { count: 0, success_rate: 0 },
    zero_complaints_achieved: false,
    deliverability_rate_7d: 0,
    ready_for_promotion: false,
    steps: []
  };
}

function getFallbackTimeline() {
  return [{
    id: 'fallback-1',
    timestamp: new Date(),
    severity: 'Info',
    type: 'system_event',
    title: 'No Events Found',
    description: 'No system log events found for this server.',
    details: {},
    automated: false
  }];
}

function getFallbackQuarantineLog() {
  return [{
    id: 'qlog-fallback',
    timestamp: new Date(),
    action: 'No quarantine events',
    reason: 'No quarantine events found',
    automatedBy: 'System',
    details: 'No quarantine log entries available'
  }];
}

export default ServerAutopsy;