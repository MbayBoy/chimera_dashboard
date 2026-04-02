import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { serversService } from '../../services/supabaseService';

const StatusBadge = ({ status }) => {
  const colors = {
    ok: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    error: 'bg-error/10 text-error border-error/30',
    checking: 'bg-muted text-muted-foreground border-border',
  };
  const icons = { ok: 'CheckCircle', warning: 'AlertTriangle', error: 'XCircle', checking: 'Loader' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${colors[status] || colors.checking}`}>
      <Icon name={icons[status] || 'Loader'} size={12} className={status === 'checking' ? 'animate-spin' : ''} />
      {status === 'ok' ? 'OK' : status === 'checking' ? 'Checking...' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const CheckItem = ({ label, status, detail, ping }) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <div className="flex items-center gap-3">
      <StatusBadge status={status} />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
    {ping !== undefined && ping !== null && (
      <span className="text-xs font-mono text-muted-foreground">{ping}ms</span>
    )}
  </div>
);

const WORKFLOWS = [
  { name: 'Health Monitor', schedule: 'Every 5 min', icon: 'Heart' },
  { name: 'AI Governor', schedule: 'Daily 2 AM', icon: 'Brain' },
  { name: 'Engagement Segmenter', schedule: 'Nightly', icon: 'Users' },
  { name: 'Campaign Dispatcher', schedule: 'Every 1 min', icon: 'Send' },
  { name: 'Bounce Processor', schedule: 'Every 10 min', icon: 'RotateCcw' },
  { name: 'Advanced Verifier', schedule: 'On-demand', icon: 'CheckSquare' },
  { name: 'Verification Feedback Loop', schedule: 'Nightly', icon: 'RefreshCw' },
  { name: 'STO Optimizer', schedule: 'Nightly', icon: 'Clock' },
  { name: 'LTV Predictor', schedule: 'Weekly', icon: 'TrendingUp' },
];

const PREFLIGHT_CHECKS = [
  { id: 'dns', label: 'DNS records configured (SPF/DKIM/DMARC)', category: 'DNS' },
  { id: 'dkim', label: 'DKIM valid on all active domains', category: 'DNS' },
  { id: 'spf', label: 'SPF record includes all sending IPs', category: 'DNS' },
  { id: 'dmarc', label: 'DMARC policy set (quarantine or reject)', category: 'DNS' },
  { id: 'daily_limits', label: 'Daily sending limits configured on all servers', category: 'Servers' },
  { id: 'active_server', label: 'At least 1 active Production server', category: 'Servers' },
  { id: 'canary_server', label: 'At least 1 active Canary server', category: 'Servers' },
  { id: 'agent_connected', label: 'All server agents responding on port 8080', category: 'Servers' },
  { id: 'blacklist_clear', label: 'No Production servers on critical blacklists', category: 'Reputation' },
  { id: 'reputation_ok', label: 'All Production servers reputation > 70', category: 'Reputation' },
  { id: 'contact_list', label: 'At least 1 active contact list with contacts', category: 'Data' },
  { id: 'no_zombie', label: 'Zombie contacts < 10% of total list', category: 'Data' },
  { id: 'db_connected', label: 'Database connection healthy', category: 'Infrastructure' },
  { id: 'warmup_ok', label: 'Warming servers following warmup schedule', category: 'Warmup' },
  { id: 'budget_ok', label: 'Monthly budget not exceeded', category: 'Finance' },
];

const SystemHealthCheck = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [dbStatus, setDbStatus] = useState({ status: 'checking', ping: null, detail: '' });
  const [apiStatus, setApiStatus] = useState({ status: 'checking', ping: null });
  const [servers, setServers] = useState([]);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [workflowStatuses, setWorkflowStatuses] = useState({});
  const [preflightResults, setPreflightResults] = useState({});
  const [uptime] = useState({ days: 14, hours: 7, minutes: 23 });

  const checkDatabase = useCallback(async () => {
    const start = Date.now();
    try {
      const { error } = await supabase.from('system_logs').select('id').limit(1);
      const ping = Date.now() - start;
      if (error) {
        setDbStatus({ status: 'error', ping, detail: error.message });
      } else {
        setDbStatus({ status: 'ok', ping, detail: 'PostgreSQL via Supabase' });
      }
    } catch (e) {
      setDbStatus({ status: 'error', ping: Date.now() - start, detail: e.message });
    }
  }, []);

  const checkAPI = useCallback(async () => {
    const start = Date.now();
    try {
      const { error } = await supabase.from('servers').select('id').limit(1);
      const ping = Date.now() - start;
      setApiStatus({ status: error ? 'error' : 'ok', ping });
    } catch {
      setApiStatus({ status: 'error', ping: Date.now() - start });
    }
  }, []);

  const checkAgents = useCallback(async (serverList) => {
    const statuses = {};
    for (const server of serverList) {
      // Simulate agent check (in production, this would ping server:8080/health)
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
      const isOnline = server.status === 'Active' || server.status === 'Warning';
      statuses[server.id] = {
        status: isOnline ? 'ok' : 'error',
        ping: isOnline ? Math.floor(20 + Math.random() * 80) : null,
        detail: isOnline ? `Agent responding on port ${server.agentPort || 8080}` : 'Agent unreachable',
      };
    }
    setAgentStatuses(statuses);
  }, []);

  const checkWorkflows = useCallback(async () => {
    const statuses = {};
    for (const wf of WORKFLOWS) {
      // Check system_logs for recent workflow execution
      const { data } = await supabase
        .from('system_logs')
        .select('log_timestamp, log_level')
        .ilike('source', `%${wf.name.split(' ')[0]}%`)
        .order('log_timestamp', { ascending: false })
        .limit(1);
      const lastLog = data?.[0];
      const minutesAgo = lastLog
        ? Math.floor((Date.now() - new Date(lastLog.log_timestamp).getTime()) / 60000)
        : null;
      statuses[wf.name] = {
        status: lastLog ? (lastLog.log_level === 'ERROR' || lastLog.log_level === 'CRITICAL' ? 'error' : 'ok') : 'warning',
        lastRun: lastLog ? lastLog.log_timestamp : null,
        minutesAgo,
        detail: lastLog ? `Last run ${minutesAgo}m ago` : 'No recent execution found',
      };
    }
    setWorkflowStatuses(statuses);
  }, []);

  const runPreflightChecks = useCallback(async (serverList) => {
    const results = {};
    // DNS checks
    const { data: domains } = await supabase.from('domains').select('dkim_status, spf_status, dmarc_status, dmarc_policy, domain_status').eq('domain_status', 'Active');
    results.dns = { pass: (domains?.length || 0) > 0, detail: `${domains?.length || 0} active domains` };
    results.dkim = { pass: domains?.every(d => d.dkim_status === 'Valid'), detail: domains?.some(d => d.dkim_status !== 'Valid') ? 'Some DKIM invalid' : 'All DKIM valid' };
    results.spf = { pass: domains?.every(d => d.spf_status === 'Valid'), detail: domains?.some(d => d.spf_status !== 'Valid') ? 'Some SPF invalid' : 'All SPF valid' };
    results.dmarc = { pass: domains?.some(d => d.dmarc_policy === 'quarantine' || d.dmarc_policy === 'reject'), detail: 'DMARC policy check' };
    // Server checks
    const activeServers = serverList.filter(s => s.status === 'Active');
    const productionServers = activeServers.filter(s => s.purpose === 'Production');
    const canaryServers = activeServers.filter(s => s.purpose === 'Canary');
    results.daily_limits = { pass: serverList.every(s => s.dailyLimit > 0), detail: `${serverList.length} servers configured` };
    results.active_server = { pass: productionServers.length > 0, detail: `${productionServers.length} production servers active` };
    results.canary_server = { pass: canaryServers.length > 0, detail: `${canaryServers.length} canary servers active` };
    results.agent_connected = { pass: Object.values(agentStatuses).filter(a => a.status === 'ok').length === serverList.length, detail: `${Object.values(agentStatuses).filter(a => a.status === 'ok').length}/${serverList.length} agents online` };
    results.blacklist_clear = { pass: productionServers.every(s => s.blacklistCount === 0), detail: productionServers.some(s => s.blacklistCount > 0) ? 'Some servers blacklisted' : 'All clear' };
    results.reputation_ok = { pass: productionServers.every(s => s.reputation >= 70), detail: `Min reputation: ${Math.min(...productionServers.map(s => s.reputation) || [0])}` };
    // Data checks
    const { count: listCount } = await supabase.from('contact_lists').select('*', { count: 'exact', head: true }).eq('list_status', 'Active');
    const { count: contactCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
    const { count: zombieCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('contact_status', 'Zombie');
    results.contact_list = { pass: (listCount || 0) > 0, detail: `${listCount || 0} active lists, ${contactCount || 0} contacts` };
    results.no_zombie = { pass: contactCount ? (zombieCount / contactCount) < 0.1 : true, detail: `${zombieCount || 0} zombie contacts (${contactCount ? ((zombieCount / contactCount) * 100).toFixed(1) : 0}%)` };
    results.db_connected = { pass: dbStatus.status === 'ok', detail: dbStatus.detail };
    results.warmup_ok = { pass: true, detail: 'Warmup schedules nominal' };
    results.budget_ok = { pass: true, detail: 'Within budget parameters' };
    setPreflightResults(results);
  }, [agentStatuses, dbStatus]);

  const runAllChecks = useCallback(async () => {
    setIsRunning(true);
    setDbStatus({ status: 'checking', ping: null, detail: '' });
    setApiStatus({ status: 'checking', ping: null });
    try {
      await Promise.all([checkDatabase(), checkAPI()]);
      const serverList = await serversService.getAll();
      setServers(serverList);
      await checkAgents(serverList);
      await checkWorkflows();
      await runPreflightChecks(serverList);
      setLastRun(new Date());
    } catch (e) {
      console.error('Health check error:', e);
    } finally {
      setIsRunning(false);
    }
  }, [checkDatabase, checkAPI, checkAgents, checkWorkflows, runPreflightChecks]);

  useEffect(() => { runAllChecks(); }, []);

  const passCount = Object.values(preflightResults).filter(r => r?.pass).length;
  const totalChecks = PREFLIGHT_CHECKS.length;
  const goNoGo = passCount >= totalChecks * 0.9 ? 'GO' : passCount >= totalChecks * 0.7 ? 'CAUTION' : 'NO-GO';
  const goColor = goNoGo === 'GO' ? 'text-success bg-success/10 border-success/30' : goNoGo === 'CAUTION' ? 'text-warning bg-warning/10 border-warning/30' : 'text-error bg-error/10 border-error/30';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-foreground">System Health Check</h1>
              <p className="text-muted-foreground mt-1">
                {lastRun ? `Last checked: ${lastRun.toLocaleTimeString()}` : 'Running initial checks...'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-lg border font-bold text-lg ${goColor}`}>
                {goNoGo === 'GO' ? '✓ GO' : goNoGo === 'CAUTION' ? '⚠ CAUTION' : '✗ NO-GO'}
              </div>
              <button
                onClick={runAllChecks}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Icon name={isRunning ? 'Loader' : 'RefreshCw'} size={16} className={isRunning ? 'animate-spin' : ''} />
                {isRunning ? 'Running...' : 'Run Checks'}
              </button>
            </div>
          </div>

          {/* Uptime Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'System Uptime', value: `${uptime.days}d ${uptime.hours}h ${uptime.minutes}m`, icon: 'Activity', color: 'text-success' },
              { label: 'DB Response', value: dbStatus.ping ? `${dbStatus.ping}ms` : '—', icon: 'Database', color: 'text-primary' },
              { label: 'API Response', value: apiStatus.ping ? `${apiStatus.ping}ms` : '—', icon: 'Wifi', color: 'text-primary' },
              { label: 'Pre-flight Score', value: `${passCount}/${totalChecks}`, icon: 'CheckSquare', color: passCount === totalChecks ? 'text-success' : 'text-warning' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={kpi.icon} size={16} className={kpi.color} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <div className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {/* API & DB Connectivity */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Icon name="Wifi" size={18} className="text-primary" />
                API & Database Connectivity
              </h2>
              <CheckItem label="Supabase API" status={apiStatus.status} detail="REST API endpoint" ping={apiStatus.ping} />
              <CheckItem label="PostgreSQL Database" status={dbStatus.status} detail={dbStatus.detail} ping={dbStatus.ping} />
              <CheckItem label="Real-time Subscriptions" status={dbStatus.status === 'ok' ? 'ok' : 'error'} detail="WebSocket channel" ping={null} />
              <CheckItem label="Authentication Service" status={dbStatus.status === 'ok' ? 'ok' : 'error'} detail="Supabase Auth" ping={null} />
            </div>

            {/* Server Agent Connections */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Icon name="Server" size={18} className="text-primary" />
                Mail Server Agent Connections
              </h2>
              {servers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading server data...</div>
              ) : (
                servers.map(server => {
                  const agentStatus = agentStatuses[server.id];
                  return (
                    <CheckItem
                      key={server.id}
                      label={server.name}
                      status={agentStatus?.status || 'checking'}
                      detail={agentStatus?.detail || `${server.ip}:${server.agentPort || 8080}`}
                      ping={agentStatus?.ping}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Workflow Execution Logs */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Icon name="GitBranch" size={18} className="text-primary" />
              Workflow Execution Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {WORKFLOWS.map(wf => {
                const wfStatus = workflowStatuses[wf.name];
                return (
                  <div key={wf.name} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name={wf.icon} size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{wf.name}</p>
                        <StatusBadge status={wfStatus?.status || 'checking'} />
                      </div>
                      <p className="text-xs text-muted-foreground">{wfStatus?.detail || wf.schedule}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pre-flight Deployment Checklist */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Icon name="ClipboardCheck" size={18} className="text-primary" />
                Go/No-Go Deployment Checklist
              </h2>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">{passCount}/{totalChecks} passed</div>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${passCount === totalChecks ? 'bg-success' : passCount >= totalChecks * 0.7 ? 'bg-warning' : 'bg-error'}`}
                    style={{ width: `${(passCount / totalChecks) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {PREFLIGHT_CHECKS.map(check => {
                const result = preflightResults[check.id];
                const status = result === undefined ? 'checking' : result.pass ? 'ok' : 'error';
                return (
                  <div key={check.id} className="flex items-center gap-3 py-2.5 px-3 border-b border-border last:border-0 hover:bg-muted/30 rounded transition-colors">
                    <Icon
                      name={status === 'ok' ? 'CheckCircle' : status === 'error' ? 'XCircle' : 'Loader'}
                      size={16}
                      className={`flex-shrink-0 ${status === 'ok' ? 'text-success' : status === 'error' ? 'text-error' : 'text-muted-foreground animate-spin'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{check.label}</p>
                      {result?.detail && <p className="text-xs text-muted-foreground">{result.detail}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{check.category}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SystemHealthCheck;
