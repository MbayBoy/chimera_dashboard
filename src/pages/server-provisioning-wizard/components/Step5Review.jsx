import { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const Step5Review = ({ config, updateConfig }) => {
  const [healthChecks, setHealthChecks] = useState([
    { name: 'IP Address Format', status: 'pending' },
    { name: 'Hostname Resolution', status: 'pending' },
    { name: 'Domain Availability', status: 'pending' },
    { name: 'DKIM Key Validity', status: 'pending' },
    { name: 'SPF Record Syntax', status: 'pending' },
    { name: 'Budget Compliance', status: 'pending' }
  ]);
  const [checksRunning, setChecksRunning] = useState(false);
  const [checksComplete, setChecksComplete] = useState(false);

  useEffect(() => {
    runHealthChecks();
  }, []);

  const runHealthChecks = () => {
    setChecksRunning(true);
    setChecksComplete(false);
    const checks = [
      { name: 'IP Address Format', status: 'pending' },
      { name: 'Hostname Resolution', status: 'pending' },
      { name: 'Domain Availability', status: 'pending' },
      { name: 'DKIM Key Validity', status: 'pending' },
      { name: 'SPF Record Syntax', status: 'pending' },
      { name: 'Budget Compliance', status: 'pending' }
    ];
    setHealthChecks(checks);

    checks?.forEach((check, i) => {
      setTimeout(() => {
        setHealthChecks(prev => prev?.map((c, j) =>
          j === i ? { ...c, status: Math.random() > 0.1 ? 'pass' : 'warn' } : c
        ));
        if (i === checks?.length - 1) {
          setChecksRunning(false);
          setChecksComplete(true);
        }
      }, (i + 1) * 400);
    });
  };

  const allPassed = healthChecks?.every(c => c?.status === 'pass' || c?.status === 'warn');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-foreground mb-1">Review & Deploy</h2>
        <p className="text-sm text-muted-foreground">Review your configuration and run pre-deployment health checks.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Configuration Summary */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-medium text-foreground mb-4">Configuration Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Server Name', value: config?.serverName || '—' },
              { label: 'Server Type', value: config?.serverType || '—' },
              { label: 'IP Address', value: config?.ipAddress || '—', mono: true },
              { label: 'Hostname', value: config?.hostname || '—', mono: true },
              { label: 'Domain', value: config?.domain || '—', mono: true },
              { label: 'Provider', value: config?.provider },
              { label: 'Region', value: config?.region },
              { label: 'DMARC Policy', value: config?.dmarcPolicy },
              { label: 'DKIM Keys', value: config?.dkimGenerated ? 'Generated ✓' : 'Not generated' },
              { label: 'Billing', value: config?.billingCycle === 'annual' ? 'Annual (17% off)' : 'Monthly' }
            ]?.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{item?.label}</span>
                <span className={`text-sm font-medium text-foreground ${item?.mono ? 'font-mono' : ''}`}>{item?.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Health Checks */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-foreground">Pre-Deployment Health Checks</h3>
              <button
                onClick={runHealthChecks}
                disabled={checksRunning}
                className="text-xs text-primary hover:text-primary/80 disabled:opacity-50"
              >
                Re-run
              </button>
            </div>
            <div className="space-y-2">
              {healthChecks?.map((check, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded">
                  <span className="text-sm text-foreground">{check?.name}</span>
                  <div className="flex items-center gap-1">
                    {check?.status === 'pending' && <Icon name="Loader2" size={14} className="text-muted-foreground animate-spin" />}
                    {check?.status === 'pass' && <Icon name="CheckCircle2" size={14} className="text-green-400" />}
                    {check?.status === 'warn' && <Icon name="AlertTriangle" size={14} className="text-yellow-400" />}
                    {check?.status === 'fail' && <Icon name="XCircle" size={14} className="text-red-400" />}
                    <span className={`text-xs font-medium ${
                      check?.status === 'pass' ? 'text-green-400' :
                      check?.status === 'warn' ? 'text-yellow-400' :
                      check?.status === 'fail'? 'text-red-400' : 'text-muted-foreground'
                    }`}>
                      {check?.status === 'pending' ? 'Checking...' : check?.status === 'pass' ? 'Pass' : check?.status === 'warn' ? 'Warning' : 'Fail'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {checksComplete && (
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-medium text-foreground mb-3">Deployment Confirmation</h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.confirmed}
                  onChange={e => updateConfig({ confirmed: e?.target?.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary"
                />
                <span className="text-sm text-foreground">
                  I confirm this configuration is correct and authorize the deployment of this server to the Chimera fleet. I understand this will incur monthly costs.
                </span>
              </label>
            </div>
          )}

          {checksComplete && allPassed && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <Icon name="CheckCircle2" size={16} className="text-green-400" />
              <p className="text-sm text-green-400">All health checks passed. Ready to deploy.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step5Review;
