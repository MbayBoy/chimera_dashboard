import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const Step2Infrastructure = ({ config, updateConfig }) => {
  const [checkingDomain, setCheckingDomain] = useState(false);

  const providers = ['DigitalOcean', 'Vultr', 'Linode', 'AWS EC2', 'Hetzner', 'Custom/Self-hosted'];
  const regions = [
    { value: 'nyc1', label: 'New York (NYC1)' },
    { value: 'sfo3', label: 'San Francisco (SFO3)' },
    { value: 'lon1', label: 'London (LON1)' },
    { value: 'fra1', label: 'Frankfurt (FRA1)' },
    { value: 'sgp1', label: 'Singapore (SGP1)' },
    { value: 'ams3', label: 'Amsterdam (AMS3)' }
  ];

  const checkDomainAvailability = () => {
    if (!config?.domain) return;
    setCheckingDomain(true);
    setTimeout(() => {
      updateConfig({ domainAvailable: Math.random() > 0.3 });
      setCheckingDomain(false);
    }, 1500);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-foreground mb-1">Infrastructure Configuration</h2>
        <p className="text-sm text-muted-foreground">Configure IP allocation, DNS setup, and domain assignment.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">IP Address <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={config?.ipAddress}
              onChange={e => updateConfig({ ipAddress: e?.target?.value })}
              placeholder="e.g. 192.168.1.110"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">The dedicated IP address for this mail server</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Hostname <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={config?.hostname}
              onChange={e => updateConfig({ hostname: e?.target?.value })}
              placeholder="e.g. mail7.yourdomain.com"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">FQDN for the server (must match PTR record)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Sending Domain <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config?.domain}
                onChange={e => updateConfig({ domain: e?.target?.value, domainAvailable: null })}
                placeholder="e.g. news7.yourdomain.com"
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono"
              />
              <button
                onClick={checkDomainAvailability}
                disabled={!config?.domain || checkingDomain}
                className="px-3 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {checkingDomain ? <Icon name="Loader2" size={14} className="animate-spin" /> : 'Check'}
              </button>
            </div>
            {config?.domainAvailable === true && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Icon name="CheckCircle2" size={12} /> Domain available and DNS auto-setup ready</p>
            )}
            {config?.domainAvailable === false && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Icon name="XCircle" size={12} /> Domain already in use. Please choose another.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Cloud Provider</label>
            <select
              value={config?.provider}
              onChange={e => updateConfig({ provider: e?.target?.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {providers?.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Region</label>
            <select
              value={config?.region}
              onChange={e => updateConfig({ region: e?.target?.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {regions?.map(r => <option key={r?.value} value={r?.value}>{r?.label}</option>)}
            </select>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
              <Icon name="Wand2" size={14} />
              Auto DNS Setup
            </h4>
            <p className="text-xs text-muted-foreground mb-3">The wizard will automatically create these DNS records:</p>
            <div className="space-y-1.5">
              {[
                { type: 'A', record: `${config?.domain || 'domain'} → ${config?.ipAddress || 'IP'}` },
                { type: 'PTR', record: `${config?.ipAddress || 'IP'} → ${config?.hostname || 'hostname'}` },
                { type: 'MX', record: `${config?.domain || 'domain'} → ${config?.hostname || 'hostname'}` },
                { type: 'SPF', record: 'Auto-generated from IP' },
                { type: 'DKIM', record: 'Generated in Step 3' },
                { type: 'DMARC', record: 'Configured in Step 3' }
              ]?.map((rec, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400 w-10">{rec?.type}</span>
                  <span className="text-xs text-muted-foreground">{rec?.record}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step2Infrastructure;
