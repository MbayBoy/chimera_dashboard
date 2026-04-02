import Icon from '../../../components/AppIcon';

const SEVERITIES = [
  { key: 'critical', label: 'Critical', description: 'System failures, security breaches, data loss', color: 'text-error', bg: 'bg-error/10', icon: 'AlertOctagon', alwaysOn: true },
  { key: 'high', label: 'High', description: 'Server quarantine, blacklist detection, major failures', color: 'text-orange-400', bg: 'bg-orange-400/10', icon: 'AlertTriangle', alwaysOn: false },
  { key: 'medium', label: 'Medium', description: 'Bounce spikes, reputation drops, campaign issues', color: 'text-warning', bg: 'bg-warning/10', icon: 'AlertCircle', alwaysOn: false },
  { key: 'low', label: 'Low', description: 'Informational updates, minor threshold crossings', color: 'text-success', bg: 'bg-success/10', icon: 'Info', alwaysOn: false },
];

const SeverityFiltersSection = ({ severities, onChange }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
          <Icon name="Filter" size={18} className="text-warning" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Severity Filters</h2>
          <p className="text-xs text-muted-foreground">Select which severity levels trigger alerts</p>
        </div>
      </div>
      <div className="space-y-3">
        {SEVERITIES?.map(sev => (
          <label
            key={sev?.key}
            className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
              severities?.[sev?.key] ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-muted/20'
            } ${sev?.alwaysOn ? 'cursor-not-allowed' : 'hover:border-primary/20'}`}
          >
            <input
              type="checkbox"
              checked={severities?.[sev?.key]}
              onChange={e => !sev?.alwaysOn && onChange(sev?.key, e?.target?.checked)}
              disabled={sev?.alwaysOn}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sev?.bg}`}>
              <Icon name={sev?.icon} size={16} className={sev?.color} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${sev?.color}`}>{sev?.label}</span>
                {sev?.alwaysOn && (
                  <span className="px-1.5 py-0.5 bg-error/10 text-error text-xs rounded-full">Always On</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{sev?.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default SeverityFiltersSection;
