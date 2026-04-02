import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const STEPS = [
  { id: 1, label: 'Server Info', icon: 'Server' },
  { id: 2, label: 'Configuration', icon: 'Settings' },
  { id: 3, label: 'Review & Deploy', icon: 'Rocket' },
];

const AddServerWizard = ({ onClose, onAdd }) => {
  const [step, setStep] = useState(1);
  const [deploying, setDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployLog, setDeployLog] = useState([]);
  const [form, setForm] = useState({
    name: '',
    ip: '',
    hostname: '',
    region: 'US-East',
    purpose: 'Production',
    dailyLimit: 50000,
    warmupEnabled: true,
    sshKey: '',
    agentPort: 8080,
  });
  const [errors, setErrors] = useState({});

  const regions = ['US-East', 'US-West', 'EU-West', 'EU-Central', 'AP-Southeast', 'AP-Northeast'];
  const purposes = ['Production', 'Canary', 'Sanitizer', 'HotSpare', 'Verifier'];

  const validate = () => {
    const e = {};
    if (!form?.name?.trim()) e.name = 'Server name is required';
    if (!form?.ip?.trim()) e.ip = 'IP address is required';
    else if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/?.test(form?.ip)) e.ip = 'Invalid IP address format';
    if (!form?.hostname?.trim()) e.hostname = 'Hostname is required';
    setErrors(e);
    return Object.keys(e)?.length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validate()) return;
    setStep(s => s + 1);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployProgress(0);
    setDeployLog([]);
    const steps = [
      { msg: 'Connecting to server via SSH...', progress: 15 },
      { msg: 'Installing Postfix mail server...', progress: 30 },
      { msg: 'Configuring mail server settings...', progress: 45 },
      { msg: 'Installing Chimera Agent...', progress: 60 },
      { msg: 'Generating DKIM key pair...', progress: 72 },
      { msg: 'Creating DNS records...', progress: 82 },
      { msg: 'Running health check...', progress: 92 },
      { msg: 'Server deployed successfully!', progress: 100 },
    ];
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 700));
      setDeployProgress(s?.progress);
      setDeployLog(prev => [...prev, { msg: s?.msg, ok: true }]);
    }
    await new Promise(r => setTimeout(r, 500));
    onAdd({ ...form, status: form?.warmupEnabled ? 'Warming' : 'Active' });
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">Add New Server</h2>
            <p className="text-sm text-muted-foreground mt-1">Deploy a new mail server to your Chimera fleet</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center px-6 py-4 border-b border-border">
          {STEPS?.map((s, i) => (
            <div key={s?.id} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${
                step === s?.id ? 'text-primary' : step > s?.id ? 'text-success' : 'text-muted-foreground'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  step === s?.id ? 'border-primary bg-primary/10' :
                  step > s?.id ? 'border-success bg-success/10': 'border-border bg-muted'
                }`}>
                  {step > s?.id ? <Icon name="Check" size={14} /> : s?.id}
                </div>
                <span className="text-sm font-medium hidden sm:block">{s?.label}</span>
              </div>
              {i < STEPS?.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 ${
                  step > s?.id ? 'bg-success' : 'bg-border'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Server Name *</label>
                  <input
                    type="text"
                    value={form?.name}
                    onChange={e => update('name', e?.target?.value)}
                    placeholder="e.g. Production Mail Server 04"
                    className={`w-full px-3 py-2 bg-muted border rounded-lg text-sm text-foreground outline-none focus:border-primary ${
                      errors?.name ? 'border-error' : 'border-border'
                    }`}
                  />
                  {errors?.name && <p className="text-xs text-error mt-1">{errors?.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">IP Address *</label>
                  <input
                    type="text"
                    value={form?.ip}
                    onChange={e => update('ip', e?.target?.value)}
                    placeholder="e.g. 203.0.113.10"
                    className={`w-full px-3 py-2 bg-muted border rounded-lg text-sm text-foreground outline-none focus:border-primary font-mono ${
                      errors?.ip ? 'border-error' : 'border-border'
                    }`}
                  />
                  {errors?.ip && <p className="text-xs text-error mt-1">{errors?.ip}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Hostname *</label>
                  <input
                    type="text"
                    value={form?.hostname}
                    onChange={e => update('hostname', e?.target?.value)}
                    placeholder="e.g. mail4.yourdomain.com"
                    className={`w-full px-3 py-2 bg-muted border rounded-lg text-sm text-foreground outline-none focus:border-primary ${
                      errors?.hostname ? 'border-error' : 'border-border'
                    }`}
                  />
                  {errors?.hostname && <p className="text-xs text-error mt-1">{errors?.hostname}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Region</label>
                  <select
                    value={form?.region}
                    onChange={e => update('region', e?.target?.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
                  >
                    {regions?.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">SSH Private Key</label>
                <textarea
                  value={form?.sshKey}
                  onChange={e => update('sshKey', e?.target?.value)}
                  placeholder="Paste your SSH private key here (-----BEGIN RSA PRIVATE KEY-----...)"
                  rows={4}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-xs text-foreground outline-none focus:border-primary font-mono resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Required for automated deployment. Key is encrypted and stored securely.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Server Purpose</label>
                  <select
                    value={form?.purpose}
                    onChange={e => update('purpose', e?.target?.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
                  >
                    {purposes?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form?.purpose === 'Production' && 'High-reputation server for Platinum/Gold lists'}
                    {form?.purpose === 'Canary' && 'Testing server for new/untested campaigns'}
                    {form?.purpose === 'Sanitizer' && 'Low-reputation server for zombie re-engagement'}
                    {form?.purpose === 'HotSpare' && 'Backup server ready for instant rotation'}
                    {form?.purpose === 'Verifier' && 'Dedicated server for email verification traffic'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Daily Sending Limit</label>
                  <input
                    type="number"
                    value={form?.dailyLimit}
                    onChange={e => update('dailyLimit', parseInt(e?.target?.value) || 0)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Max emails per day. Start low for new servers.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Agent Port</label>
                  <input
                    type="number"
                    value={form?.agentPort}
                    onChange={e => update('agentPort', parseInt(e?.target?.value) || 8080)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="warmup"
                    checked={form?.warmupEnabled}
                    onChange={e => update('warmupEnabled', e?.target?.checked)}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="warmup" className="text-sm font-medium text-foreground cursor-pointer">Enable IP Warmup</label>
                    <p className="text-xs text-muted-foreground mt-1">Gradually increase sending volume over 30 days to build reputation</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Icon name="Info" size={16} className="text-primary mt-0.5" />
                  <div className="text-sm text-foreground">
                    <strong>What will be installed automatically:</strong>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>• Postfix mail server with optimized configuration</li>
                      <li>• Chimera Agent (Node.js) for remote management</li>
                      <li>• DKIM key pair generation and DNS record creation</li>
                      <li>• SPF and DMARC record setup</li>
                      <li>• Blacklist monitoring integration</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && !deploying && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl">
                <h3 className="font-semibold text-foreground mb-3">Deployment Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Name', value: form?.name },
                    { label: 'IP Address', value: form?.ip },
                    { label: 'Hostname', value: form?.hostname },
                    { label: 'Region', value: form?.region },
                    { label: 'Purpose', value: form?.purpose },
                    { label: 'Daily Limit', value: form?.dailyLimit?.toLocaleString() },
                    { label: 'Agent Port', value: form?.agentPort },
                    { label: 'IP Warmup', value: form?.warmupEnabled ? 'Enabled' : 'Disabled' },
                  ]?.map(item => (
                    <div key={item?.label}>
                      <span className="text-muted-foreground">{item?.label}: </span>
                      <span className="font-medium text-foreground">{item?.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
                <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
                <p className="text-sm text-foreground">Deployment will take approximately 2-3 minutes. Do not close this window during the process.</p>
              </div>
            </div>
          )}

          {deploying && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Deploying server...</span>
                <span className="text-sm font-mono text-primary">{deployProgress}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${deployProgress}%` }}
                />
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {deployLog?.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Icon name="CheckCircle" size={14} className="text-success flex-shrink-0" />
                    <span className="text-foreground">{log?.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            disabled={deploying}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <div className="flex items-center gap-3">
            {step < 3 && (
              <Button variant="default" onClick={handleNext} iconName="ChevronRight" iconPosition="right">
                Next Step
              </Button>
            )}
            {step === 3 && !deploying && (
              <Button variant="default" onClick={handleDeploy} iconName="Rocket" iconPosition="left">
                Deploy Server
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddServerWizard;
