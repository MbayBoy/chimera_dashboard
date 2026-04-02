import Icon from '../../../components/AppIcon';

const ToggleSwitch = ({ enabled, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
      enabled ? 'bg-primary' : 'bg-muted'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
      enabled ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
);

const AlertChannelSection = ({ channels, onChange }) => {
  const channelConfig = [
    {
      key: 'browser',
      label: 'Browser Notifications',
      description: 'Receive real-time push notifications in your browser',
      icon: 'Monitor',
      badge: null,
    },
    {
      key: 'email',
      label: 'Email Notifications',
      description: 'Get alert summaries and critical events via email',
      icon: 'Mail',
      badge: null,
    },
    {
      key: 'sms',
      label: 'SMS Notifications',
      description: 'Text message alerts for critical events',
      icon: 'Smartphone',
      badge: 'Coming Soon',
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="Bell" size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Alert Channels</h2>
          <p className="text-xs text-muted-foreground">Choose how you receive notifications</p>
        </div>
      </div>
      <div className="space-y-4">
        {channelConfig?.map(ch => (
          <div key={ch?.key} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                channels?.[ch?.key] ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <Icon name={ch?.icon} size={16} className={channels?.[ch?.key] ? 'text-primary' : 'text-muted-foreground'} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{ch?.label}</p>
                  {ch?.badge && (
                    <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">{ch?.badge}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{ch?.description}</p>
              </div>
            </div>
            <ToggleSwitch
              enabled={channels?.[ch?.key]}
              onChange={val => onChange(ch?.key, val)}
              disabled={ch?.key === 'sms'}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertChannelSection;
