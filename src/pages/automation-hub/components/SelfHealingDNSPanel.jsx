import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const dnsActions = [
  {
    id: 'dns-001',
    timestamp: '2026-02-25T20:45:00Z',
    actionType: 'DKIM Key Regeneration',
    domain: 'news1.chimera.io',
    trigger: 'DKIM mismatch detected — public key in DNS did not match server private key',
    steps: [
      'Detected DKIM public/private key mismatch via Health Monitor',
      'Generated new 2048-bit RSA key pair on srv-prod-01',
      'Updated Postfix DKIM configuration via Chimera Agent API',
      'Updated DNS TXT record via Namecheap Registrar API',
      'Verified new DKIM signature on outbound test message',
    ],
    status: 'success',
    registrarAPI: 'Namecheap API v2',
    affectedServers: ['srv-prod-01'],
    duration: '42s',
    technicalDetails: 'Selector: chimera2026._domainkey | Algorithm: rsa-sha256 | Key Size: 2048-bit',
  },
  {
    id: 'dns-002',
    timestamp: '2026-02-25T18:12:00Z',
    actionType: 'SPF Record Update',
    domain: 'mail.chimera.io',
    trigger: 'New server srv-prod-05 (203.0.113.45) added to fleet — SPF record outdated',
    steps: [
      'Detected new server IP not included in SPF record',
      'Fetched current SPF record from DNS',
      'Appended new IP: include:203.0.113.45 to SPF policy',
      'Updated DNS TXT record via Cloudflare API',
      'Validated SPF record syntax and propagation',
    ],
    status: 'success',
    registrarAPI: 'Cloudflare API v4',
    affectedServers: ['srv-prod-05'],
    duration: '18s',
    technicalDetails: 'v=spf1 include:203.0.113.45 include:198.51.100.0/24 ~all',
  },
  {
    id: 'dns-003',
    timestamp: '2026-02-25T14:30:00Z',
    actionType: 'DMARC Policy Tightening',
    domain: 'promo.chimera.io',
    trigger: 'DMARC aggregate report showed 100% alignment for 30 days — auto-escalating policy',
    steps: [
      'Analyzed 30-day DMARC aggregate reports',
      'Confirmed 99.8% SPF/DKIM alignment rate',
      'Escalated DMARC policy from p=none to p=quarantine',
      'Updated DNS TXT record via GoDaddy API',
      'Sent policy change notification to admin',
    ],
    status: 'success',
    registrarAPI: 'GoDaddy API v1',
    affectedServers: ['srv-prod-02', 'srv-prod-03'],
    duration: '11s',
    technicalDetails: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@chimera.io; pct=100',
  },
  {
    id: 'dns-004',
    timestamp: '2026-02-25T09:55:00Z',
    actionType: 'DKIM Key Regeneration',
    domain: 'transact.chimera.io',
    trigger: 'Scheduled 90-day DKIM key rotation policy triggered',
    steps: [
      'Scheduled rotation triggered (90-day policy)',
      'Generated new 2048-bit RSA key pair',
      'Deployed new key to srv-canary-01 via Agent API',
      'Attempted DNS update via Route53 API — rate limit hit',
      'Retry scheduled in 15 minutes',
    ],
    status: 'retrying',
    registrarAPI: 'AWS Route53 API',
    affectedServers: ['srv-canary-01'],
    duration: 'In progress',
    technicalDetails: 'Rate limit: 5 req/sec exceeded. Retry #1 of 3 scheduled.',
  },
  {
    id: 'dns-005',
    timestamp: '2026-02-24T22:10:00Z',
    actionType: 'SPF Record Repair',
    domain: 'bulk.chimera.io',
    trigger: 'SPF record exceeded 10 DNS lookup limit — causing SPF PermError',
    steps: [
      'Detected SPF PermError in bounce logs',
      'Analyzed SPF record — found 13 DNS lookups (limit: 10)',
      'Flattened SPF record by resolving includes to IPs',
      'Updated DNS TXT record via Cloudflare API',
      'Verified SPF lookup count reduced to 7',
    ],
    status: 'success',
    registrarAPI: 'Cloudflare API v4',
    affectedServers: ['srv-prod-04', 'srv-prod-05'],
    duration: '67s',
    technicalDetails: 'Flattened 6 include: directives to direct IP ranges. Lookup count: 13 → 7',
  },
];

const SelfHealingDNSPanel = () => {
  const [expandedAction, setExpandedAction] = useState(null);
  const [filter, setFilter] = useState('all');

  const getStatusConfig = (status) => {
    switch (status) {
      case 'success': return { color: 'text-success', bg: 'bg-success/10 border-success/30', icon: 'CheckCircle', label: 'Success' };
      case 'retrying': return { color: 'text-warning', bg: 'bg-warning/10 border-warning/30', icon: 'RefreshCw', label: 'Retrying' };
      case 'failed': return { color: 'text-error', bg: 'bg-error/10 border-error/30', icon: 'XCircle', label: 'Failed' };
      default: return { color: 'text-muted-foreground', bg: 'bg-muted border-border', icon: 'Clock', label: 'Pending' };
    }
  };

  const getActionTypeIcon = (type) => {
    if (type?.includes('DKIM')) return 'Key';
    if (type?.includes('SPF')) return 'Shield';
    if (type?.includes('DMARC')) return 'Lock';
    return 'Globe';
  };

  const getActionTypeColor = (type) => {
    if (type?.includes('DKIM')) return 'text-purple-400 bg-purple-500/10';
    if (type?.includes('SPF')) return 'text-blue-400 bg-blue-500/10';
    if (type?.includes('DMARC')) return 'text-green-400 bg-green-500/10';
    return 'text-primary bg-primary/10';
  };

  const filteredActions = filter === 'all' ? dnsActions : dnsActions?.filter(a => a?.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold text-foreground">Self-Healing DNS Actions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Automated infrastructure maintenance log</p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'success', 'retrying', 'failed']?.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {filteredActions?.map(action => {
          const statusConfig = getStatusConfig(action?.status);
          const isExpanded = expandedAction === action?.id;
          const actionTypeColor = getActionTypeColor(action?.actionType);

          return (
            <div key={action?.id} className="bg-card rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setExpandedAction(isExpanded ? null : action?.id)}
                className="w-full p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${actionTypeColor}`}>
                  <Icon name={getActionTypeIcon(action?.actionType)} size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground text-sm">{action?.actionType}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusConfig?.bg} ${statusConfig?.color}`}>
                      {statusConfig?.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Domain: <span className="text-foreground font-mono">{action?.domain}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{action?.trigger}</div>
                </div>

                <div className="text-right flex-shrink-0 hidden md:block">
                  <div className="text-xs text-muted-foreground">{new Date(action.timestamp)?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">Duration: {action?.duration}</div>
                  <div className="text-xs text-primary mt-1">{action?.registrarAPI}</div>
                </div>

                <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
              </button>
              {isExpanded && (
                <div className="border-t border-border p-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Execution Steps</h4>
                    <div className="space-y-2">
                      {action?.steps?.map((step, idx) => {
                        const isLastStep = idx === action?.steps?.length - 1;
                        const stepDone = !isLastStep || action?.status === 'success';
                        const stepColor = stepDone ? 'bg-success/10' : action?.status === 'retrying' ? 'bg-warning/10' : 'bg-error/10';
                        const iconName = stepDone ? 'Check' : action?.status === 'retrying' ? 'RefreshCw' : 'X';
                        const iconColor = stepDone ? 'text-success' : action?.status === 'retrying' ? 'text-warning' : 'text-error';
                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${stepColor}`}>
                              <Icon name={iconName} size={10} className={iconColor} />
                            </div>
                            <span className="text-xs text-foreground">{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg font-mono">
                    <div className="text-xs text-muted-foreground mb-1">Technical Details</div>
                    <div className="text-xs text-foreground">{action?.technicalDetails}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Affected Servers</div>
                      <div className="flex flex-wrap gap-1">
                        {action?.affectedServers?.map(srv => (
                          <span key={srv} className="text-xs px-2 py-0.5 bg-muted rounded font-mono text-foreground">{srv}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Registrar API</div>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">{action?.registrarAPI}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelfHealingDNSPanel;
