import Icon from '../../../components/AppIcon';

const ALERT_TYPES = [
  { key: 'Server_Quarantined', label: 'Server Quarantined', description: 'Triggered when a server is automatically quarantined', severity: 'Critical', icon: 'ServerCrash' },
  { key: 'Blacklist_Detected', label: 'Blacklist Detected', description: 'Server IP found on email blacklist', severity: 'High', icon: 'ShieldX' },
  { key: 'Campaign_Failed', label: 'Campaign Failed', description: 'Campaign delivery failure or high error rate', severity: 'High', icon: 'XCircle' },
  { key: 'Bounce_Spike', label: 'Bounce Spike', description: 'Abnormal increase in email bounce rate', severity: 'Medium', icon: 'TrendingDown' },
  { key: 'Cost_Overrun', label: 'Cost Overrun', description: 'Budget threshold exceeded for services', severity: 'Medium', icon: 'DollarSign' },
  { key: 'Reputation_Drop', label: 'Reputation Drop', description: 'Server reputation score declined significantly', severity: 'High', icon: 'TrendingDown' },
  { key: 'Verification_Failed', label: 'Verification Failed', description: 'Email verification job encountered errors', severity: 'Low', icon: 'AlertCircle' },
];

const SEVERITY_COLORS = {
  Critical: 'text-error bg-error/10',
  High: 'text-orange-400 bg-orange-400/10',
  Medium: 'text-warning bg-warning/10',
  Low: 'text-success bg-success/10',
};

const ToggleSwitch = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? 'bg-primary' : 'bg-muted'
    }`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
      enabled ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
);

const AlertSubscriptionsTable = ({ subscriptions, onChange }) => {
  const allEnabled = ALERT_TYPES?.every(t => subscriptions?.[t?.key]);

  const toggleAll = () => {
    const newVal = !allEnabled;
    const updated = {};
    ALERT_TYPES?.forEach(t => { updated[t.key] = newVal; });
    onChange(updated);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
            <Icon name="ListChecks" size={18} className="text-success" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Per-Alert-Type Subscriptions</h2>
            <p className="text-xs text-muted-foreground">Subscribe to specific alert categories</p>
          </div>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-primary hover:underline"
        >
          {allEnabled ? 'Disable All' : 'Enable All'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alert Type</th>
              <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              <th className="pb-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Severity</th>
              <th className="pb-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subscribed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ALERT_TYPES?.map(alertType => (
              <tr key={alertType?.key} className="hover:bg-muted/10 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Icon name={alertType?.icon} size={15} className="text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground text-xs">{alertType?.label}</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <p className="text-xs text-muted-foreground">{alertType?.description}</p>
                </td>
                <td className="py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS?.[alertType?.severity]}`}>
                    {alertType?.severity}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <div className="flex justify-center">
                    <ToggleSwitch
                      enabled={subscriptions?.[alertType?.key] ?? true}
                      onChange={val => onChange({ ...subscriptions, [alertType?.key]: val })}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertSubscriptionsTable;
