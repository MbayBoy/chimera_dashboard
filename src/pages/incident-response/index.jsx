import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { trackIncident, trackEvent } from '../../hooks/useGoogleAnalytics';
import useGoogleAnalytics from '../../hooks/useGoogleAnalytics';

const SEVERITY_CONFIG = {
  P1: { label: 'P1 - Critical', color: 'bg-error text-white', border: 'border-error/40', dot: 'bg-error', escalateAfter: 15 },
  P2: { label: 'P2 - High', color: 'bg-orange-500 text-white', border: 'border-orange-500/40', dot: 'bg-orange-500', escalateAfter: 30 },
  P3: { label: 'P3 - Medium', color: 'bg-warning text-white', border: 'border-warning/40', dot: 'bg-warning', escalateAfter: 60 },
  P4: { label: 'P4 - Low', color: 'bg-muted-foreground text-white', border: 'border-border', dot: 'bg-muted-foreground', escalateAfter: 120 },
};

const STATUS_CONFIG = {
  Detected: { color: 'bg-error/10 text-error border-error/30', icon: 'AlertTriangle' },
  Investigating: { color: 'bg-warning/10 text-warning border-warning/30', icon: 'Search' },
  Mitigating: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: 'Wrench' },
  Resolved: { color: 'bg-success/10 text-success border-success/30', icon: 'CheckCircle2' },
};

const RUNBOOKS = [
  { id: 'restart-function', label: 'Restart Edge Function', icon: 'RotateCcw', description: 'Restart the affected edge function to clear transient errors' },
  { id: 'clear-cache', label: 'Clear Cache', icon: 'Trash2', description: 'Flush Redis/CDN cache to resolve stale data issues' },
  { id: 'scale-resources', label: 'Scale Resources', icon: 'TrendingUp', description: 'Increase compute resources to handle load spike' },
  { id: 'rollback-deployment', label: 'Rollback Deployment', icon: 'Undo2', description: 'Restore previous stable deployment version' },
  { id: 'db-connection-reset', label: 'Reset DB Connections', icon: 'Database', description: 'Reset database connection pool to resolve connection exhaustion' },
  { id: 'rate-limit-adjust', label: 'Adjust Rate Limits', icon: 'Gauge', description: 'Temporarily increase rate limits to handle traffic surge' },
];

const COMPONENTS = [
  'health-check', 'campaign-actions', 'server-actions', 'analytics-overview',
  'anomaly-remediate', 'verification-worker', 'backup-manager', 'intelligence-crawler',
  'campaign-dispatcher', 'bounce-processor', 'ai-governor', 'send-alert-email',
  'Supabase API', 'Database', 'Real-time Subscriptions',
];

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG?.[severity] || SEVERITY_CONFIG?.P4;
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cfg?.color}`}>{severity}</span>;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG?.[status] || STATUS_CONFIG?.Detected;
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.color}`}>
      <Icon name={cfg?.icon} size={10} />
      {status}
    </span>
  );
}

function getDuration(createdAt, resolvedAt) {
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  const diff = Math.floor((end - new Date(createdAt)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function CreateIncidentModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '',
    severity: 'P2',
    affected_components: [],
    description: '',
    assigned_team: '',
    runbook_id: '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const toggleComponent = (c) => {
    setForm(prev => ({
      ...prev,
      affected_components: prev?.affected_components?.includes(c)
        ? prev?.affected_components?.filter(x => x !== c)
        : [...prev?.affected_components, c],
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form?.title?.trim()) { toast?.error('Title is required'); return; }
    setSaving(true);
    try {
      const timeline = [{ ts: new Date()?.toISOString(), status: 'Detected', note: 'Incident created' }];
      const { data, error } = await supabase?.from('incidents')?.insert({
        ...form,
        status: 'Detected',
        timeline,
      })?.select()?.single();
      if (error) throw error;
      trackIncident(data?.id, form?.severity, 'created');
      toast?.success('Incident created successfully');
      onCreate(data);
      onClose();
    } catch (err) {
      toast?.error(err?.message || 'Failed to create incident');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Create Incident</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input
              value={form?.title}
              onChange={e => setForm(p => ({ ...p, title: e?.target?.value }))}
              placeholder="Brief incident description..."
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Severity</label>
              <select
                value={form?.severity}
                onChange={e => setForm(p => ({ ...p, severity: e?.target?.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {Object.entries(SEVERITY_CONFIG)?.map(([k, v]) => (
                  <option key={k} value={k}>{v?.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned Team</label>
              <input
                value={form?.assigned_team}
                onChange={e => setForm(p => ({ ...p, assigned_team: e?.target?.value }))}
                placeholder="e.g. Platform Team"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Auto-assign Runbook</label>
            <select
              value={form?.runbook_id}
              onChange={e => setForm(p => ({ ...p, runbook_id: e?.target?.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">— Select runbook —</option>
              {RUNBOOKS?.map(r => <option key={r?.id} value={r?.id}>{r?.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Affected Components</label>
            <div className="flex flex-wrap gap-2">
              {COMPONENTS?.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleComponent(c)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${form?.affected_components?.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea
              value={form?.description}
              onChange={e => setForm(p => ({ ...p, description: e?.target?.value }))}
              rows={3}
              placeholder="Detailed description of the incident..."
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </form>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Incident'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IncidentTimeline({ timeline = [] }) {
  return (
    <div className="space-y-3">
      {[...timeline]?.reverse()?.map((entry, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${STATUS_CONFIG?.[entry?.status]?.color?.includes('success') ? 'bg-success' : STATUS_CONFIG?.[entry?.status]?.color?.includes('warning') ? 'bg-warning' : 'bg-primary'}`} />
            {i < timeline?.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center gap-2 mb-0.5">
              <StatusBadge status={entry?.status} />
              <span className="text-xs text-muted-foreground">{new Date(entry.ts)?.toLocaleString()}</span>
            </div>
            {entry?.note && <p className="text-xs text-foreground">{entry?.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

const IncidentResponse = () => {
  useGoogleAnalytics();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [runningRunbook, setRunningRunbook] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const channelRef = useRef(null);
  const toast = useToast();

  const loadIncidents = useCallback(async () => {
    try {
      const { data, error } = await supabase?.from('incidents')?.select('*')?.order('created_at', { ascending: false })?.limit(50);
      if (error) throw error;
      setIncidents(data || []);
      if (data?.length > 0 && !selectedIncident) setSelectedIncident(data?.[0]);
    } catch (err) {
      toast?.error(err?.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [selectedIncident, toast]);

  useEffect(() => {
    loadIncidents();

    channelRef.current = supabase?.channel('incidents_rt')?.on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
        if (payload?.eventType === 'INSERT') {
          setIncidents(prev => [payload?.new, ...prev]);
          addNotification(`New incident: ${payload?.new?.title}`, payload?.new?.severity);
        } else if (payload?.eventType === 'UPDATE') {
          setIncidents(prev => prev?.map(i => i?.id === payload?.new?.id ? payload?.new : i));
          setSelectedIncident(prev => prev?.id === payload?.new?.id ? payload?.new : prev);
        }
      })?.subscribe();

    // Auto-escalation check every minute
    const escalationInterval = setInterval(checkEscalations, 60000);

    return () => {
      channelRef?.current?.unsubscribe();
      clearInterval(escalationInterval);
    };
  }, [loadIncidents]);

  const addNotification = (message, severity) => {
    const notif = { id: Date.now(), message, severity, ts: new Date() };
    setNotifications(prev => [notif, ...prev?.slice(0, 19)]);
  };

  const checkEscalations = async () => {
    try {
      const { data } = await supabase?.from('incidents')?.select('*')?.not('status', 'eq', 'Resolved');

      for (const incident of (data || [])) {
        const cfg = SEVERITY_CONFIG?.[incident?.severity];
        if (!cfg) continue;
        const ageMin = (Date.now() - new Date(incident.created_at)) / 60000;
        if (ageMin >= cfg?.escalateAfter && incident?.escalation_count === 0) {
          await escalateIncident(incident, `Auto-escalated after ${cfg?.escalateAfter} minutes`);
        }
      }
    } catch (e) {
      console.warn('[IncidentResponse] Escalation check failed:', e);
    }
  };

  const escalateIncident = async (incident, note) => {
    try {
      const timelineEntry = { ts: new Date()?.toISOString(), status: incident?.status, note };
      const updatedTimeline = [...(incident?.timeline || []), timelineEntry];
      const { error } = await supabase?.from('incidents')?.update({
        escalation_count: (incident?.escalation_count || 0) + 1,
        escalated_at: new Date()?.toISOString(),
        timeline: updatedTimeline,
      })?.eq('id', incident?.id);
      if (error) throw error;
      trackIncident(incident?.id, incident?.severity, 'escalated');
      addNotification(`${incident?.severity} escalated: ${incident?.title}`, incident?.severity);
    } catch (err) {
      console.warn('[IncidentResponse] Escalation failed:', err);
    }
  };

  const updateIncidentStatus = async (incident, newStatus, note) => {
    try {
      const timelineEntry = { ts: new Date()?.toISOString(), status: newStatus, note: note || `Status changed to ${newStatus}` };
      const updatedTimeline = [...(incident?.timeline || []), timelineEntry];
      const updates = {
        status: newStatus,
        timeline: updatedTimeline,
      };
      if (newStatus === 'Resolved') updates.resolved_at = new Date()?.toISOString();

      const { error } = await supabase?.from('incidents')?.update(updates)?.eq('id', incident?.id);
      if (error) throw error;
      trackIncident(incident?.id, incident?.severity, `status_${newStatus?.toLowerCase()}`);
      toast?.success(`Incident status updated to ${newStatus}`);
      addNotification(`Incident "${incident?.title}" → ${newStatus}`, incident?.severity);
    } catch (err) {
      toast?.error(err?.message || 'Failed to update status');
    }
  };

  const triggerRunbook = async (incident, runbook) => {
    setRunningRunbook(runbook?.id);
    try {
      const note = `Runbook triggered: ${runbook?.label}`;
      const timelineEntry = { ts: new Date()?.toISOString(), status: incident?.status, note };
      const updatedTimeline = [...(incident?.timeline || []), timelineEntry];

      await supabase?.from('incidents')?.update({
        runbook_id: runbook?.id,
        timeline: updatedTimeline,
        status: 'Mitigating',
      })?.eq('id', incident?.id);

      trackEvent('runbook_triggered', { runbook_id: runbook?.id, incident_id: incident?.id, severity: incident?.severity });
      toast?.success(`Runbook "${runbook?.label}" triggered`);
      addNotification(`Runbook "${runbook?.label}" triggered for ${incident?.title}`, incident?.severity);
    } catch (err) {
      toast?.error(err?.message || 'Failed to trigger runbook');
    } finally {
      setTimeout(() => setRunningRunbook(null), 2000);
    }
  };

  const triggerRollback = async (incident) => {
    try {
      await triggerRunbook(incident, RUNBOOKS?.find(r => r?.id === 'rollback-deployment'));
      toast?.success('Rollback initiated — restoring previous stable state');
    } catch (err) {
      toast?.error(err?.message || 'Rollback failed');
    }
  };

  const activeIncidents = incidents?.filter(i => i?.status !== 'Resolved');
  const resolvedIncidents = incidents?.filter(i => i?.status === 'Resolved');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6">
            <Breadcrumbs />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-heading font-semibold text-foreground">Incident Response</h1>
                  {activeIncidents?.filter(i => i?.severity === 'P1')?.length > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-error text-white animate-pulse">
                      <Icon name="AlertTriangle" size={12} />
                      {activeIncidents?.filter(i => i?.severity === 'P1')?.length} P1 ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">Auto-triggered remediation, escalation rules, and status tracking</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Icon name="Plus" size={16} />
                Create Incident
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Incidents', value: activeIncidents?.length, icon: 'AlertTriangle', color: activeIncidents?.length > 0 ? 'text-error' : 'text-success' },
              { label: 'P1 Critical', value: activeIncidents?.filter(i => i?.severity === 'P1')?.length, icon: 'Flame', color: 'text-error' },
              { label: 'Investigating', value: activeIncidents?.filter(i => i?.status === 'Investigating')?.length, icon: 'Search', color: 'text-warning' },
              { label: 'Resolved Today', value: resolvedIncidents?.filter(i => new Date(i.resolved_at) > new Date(Date.now() - 86400000))?.length, icon: 'CheckCircle2', color: 'text-success' },
            ]?.map(card => (
              <div key={card?.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={card?.icon} size={14} className={card?.color} />
                  <span className="text-xs text-muted-foreground">{card?.label}</span>
                </div>
                <p className={`text-2xl font-bold font-mono ${card?.color}`}>{card?.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: Incidents List */}
            <div className="xl:col-span-1 space-y-4">
              {/* Active Incidents */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Active Incidents</h2>
                  <span className="text-xs text-muted-foreground">{activeIncidents?.length}</span>
                </div>
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3]?.map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
                  </div>
                ) : activeIncidents?.length === 0 ? (
                  <div className="p-6 text-center">
                    <Icon name="CheckCircle2" size={28} className="text-success mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No active incidents</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {activeIncidents?.map(incident => (
                      <button
                        key={incident?.id}
                        onClick={() => setSelectedIncident(incident)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${selectedIncident?.id === incident?.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={incident?.severity} />
                          <StatusBadge status={incident?.status} />
                          {incident?.escalation_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30">ESC</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground truncate mb-1">{incident?.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Icon name="Clock" size={10} />
                          <span>{getDuration(incident?.created_at, null)}</span>
                          {incident?.assigned_team && <span>· {incident?.assigned_team}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notifications Panel */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="Bell" size={14} className="text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">{notifications?.length}</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                  {notifications?.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-4 text-center">No notifications yet</p>
                  ) : notifications?.map(n => (
                    <div key={n?.id} className="px-4 py-2.5 flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n?.severity === 'P1' ? 'bg-error' : n?.severity === 'P2' ? 'bg-orange-500' : 'bg-warning'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{n?.message}</p>
                        <p className="text-xs text-muted-foreground">{n?.ts?.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escalation Rules */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Escalation Rules</h2>
                </div>
                <div className="p-4 space-y-2">
                  {Object.entries(SEVERITY_CONFIG)?.map(([sev, cfg]) => (
                    <div key={sev} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cfg?.dot}`} />
                        <span className="text-xs font-medium text-foreground">{sev}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Auto-escalate after {cfg?.escalateAfter}m</span>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon name="Mail" size={12} />
                      <span>Email: info@leadsconsult.co.za</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Incident Detail */}
            <div className="xl:col-span-2 space-y-4">
              {selectedIncident ? (
                <>
                  {/* Incident Header */}
                  <div className={`bg-card border rounded-xl p-5 ${SEVERITY_CONFIG?.[selectedIncident?.severity]?.border || 'border-border'}`}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <SeverityBadge severity={selectedIncident?.severity} />
                          <StatusBadge status={selectedIncident?.status} />
                          {selectedIncident?.escalation_count > 0 && (
                            <span className="px-2 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30">
                              Escalated {selectedIncident?.escalation_count}x
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-1">{selectedIncident?.title}</h3>
                        {selectedIncident?.description && (
                          <p className="text-xs text-muted-foreground">{selectedIncident?.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="text-sm font-mono font-semibold text-foreground">
                          {getDuration(selectedIncident?.created_at, selectedIncident?.resolved_at)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Assigned Team: </span>
                        <span className="text-foreground">{selectedIncident?.assigned_team || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created: </span>
                        <span className="text-foreground">{new Date(selectedIncident.created_at)?.toLocaleString()}</span>
                      </div>
                      {selectedIncident?.affected_components?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Affected: </span>
                          <span className="text-foreground">{selectedIncident?.affected_components?.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Status Actions */}
                    {selectedIncident?.status !== 'Resolved' && (
                      <div className="flex flex-wrap gap-2">
                        {['Investigating', 'Mitigating', 'Resolved']?.map(s => (
                          <button
                            key={s}
                            onClick={() => updateIncidentStatus(selectedIncident, s)}
                            disabled={selectedIncident?.status === s}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${s === 'Resolved' ? 'bg-success/10 text-success border border-success/30 hover:bg-success/20' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                          >
                            → {s}
                          </button>
                        ))}
                        <button
                          onClick={() => triggerRollback(selectedIncident)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors ml-auto"
                        >
                          <Icon name="Undo2" size={12} />
                          Rollback
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Remediation Runbooks */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <Icon name="Wrench" size={14} className="text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">Remediation Runbooks</h2>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {RUNBOOKS?.map(runbook => (
                        <div key={runbook?.id} className={`border rounded-lg p-3 transition-colors ${selectedIncident?.runbook_id === runbook?.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-border/80'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon name={runbook?.icon} size={14} className="text-primary flex-shrink-0" />
                              <span className="text-xs font-medium text-foreground">{runbook?.label}</span>
                              {selectedIncident?.runbook_id === runbook?.id && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/30">Active</span>
                              )}
                            </div>
                            {selectedIncident?.status !== 'Resolved' && (
                              <button
                                onClick={() => triggerRunbook(selectedIncident, runbook)}
                                disabled={runningRunbook === runbook?.id}
                                className="flex-shrink-0 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                {runningRunbook === runbook?.id ? '...' : 'Run'}
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{runbook?.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Timeline */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <Icon name="GitBranch" size={14} className="text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">Status Timeline</h2>
                    </div>
                    <div className="p-5">
                      {selectedIncident?.timeline?.length > 0 ? (
                        <IncidentTimeline timeline={selectedIncident?.timeline} />
                      ) : (
                        <p className="text-xs text-muted-foreground">No timeline entries yet</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <Icon name="AlertTriangle" size={40} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Select an incident to view details</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Create First Incident
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      {showCreateModal && (
        <CreateIncidentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(incident) => {
            setIncidents(prev => [incident, ...prev]);
            setSelectedIncident(incident);
          }}
        />
      )}
    </div>
  );
};

export default IncidentResponse;
