import Icon from '../../../components/AppIcon';

const Step1ServerType = ({ config, updateConfig }) => {
  const serverTypes = [
    {
      type: 'Production',
      icon: 'Server',
      color: 'border-green-500/50 bg-green-500/5',
      selectedColor: 'border-green-500 bg-green-500/10',
      iconColor: 'text-green-400',
      description: 'High-reputation server for Platinum and Gold lists. Maximum deliverability.',
      capacity: '50,000 emails/day',
      recommendation: 'Recommended when fleet capacity is below 85%',
      warmupDays: 30
    },
    {
      type: 'Canary',
      icon: 'FlaskConical',
      color: 'border-yellow-500/50 bg-yellow-500/5',
      selectedColor: 'border-yellow-500 bg-yellow-500/10',
      iconColor: 'text-yellow-400',
      description: 'Testing server for new campaigns and warming. Isolated from production reputation.',
      capacity: '25,000 emails/day',
      recommendation: 'Auto-provisioned when queue exceeds 85% capacity',
      warmupDays: 14
    },
    {
      type: 'Sanitizer',
      icon: 'Filter',
      color: 'border-purple-500/50 bg-purple-500/5',
      selectedColor: 'border-purple-500 bg-purple-500/10',
      iconColor: 'text-purple-400',
      description: 'Low-reputation server for zombie re-engagement and risky lists.',
      capacity: '10,000 emails/day',
      recommendation: 'Use for Bronze/Lead tier re-engagement campaigns',
      warmupDays: 7
    },
    {
      type: 'HotSpare',
      icon: 'Zap',
      color: 'border-blue-500/50 bg-blue-500/5',
      selectedColor: 'border-blue-500 bg-blue-500/10',
      iconColor: 'text-blue-400',
      description: 'Standby server ready for immediate activation when another server fails.',
      capacity: '50,000 emails/day',
      recommendation: 'Maintain at least 1 HotSpare per 5 Production servers',
      warmupDays: 0
    },
    {
      type: 'Verifier',
      icon: 'CheckSquare',
      color: 'border-cyan-500/50 bg-cyan-500/5',
      selectedColor: 'border-cyan-500 bg-cyan-500/10',
      iconColor: 'text-cyan-400',
      description: 'Dedicated server for email verification traffic. Isolated from marketing sends.',
      capacity: '100,000 verifications/day',
      recommendation: 'Required for running the Advanced In-House Verifier workflow',
      warmupDays: 0
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-foreground mb-1">Select Server Type</h2>
        <p className="text-sm text-muted-foreground">Choose the purpose for this server. The AI Governor will use this to route campaigns appropriately.</p>
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">Server Name <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={config?.serverName}
          onChange={e => updateConfig({ serverName: e?.target?.value })}
          placeholder="e.g. Production Mail Server 07"
          className="w-full max-w-md px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serverTypes?.map(st => (
          <button
            key={st?.type}
            onClick={() => updateConfig({ serverType: st?.type })}
            className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.01] ${
              config?.serverType === st?.type ? st?.selectedColor : st?.color
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg bg-background flex items-center justify-center`}>
                <Icon name={st?.icon} size={20} className={st?.iconColor} />
              </div>
              <div>
                <div className="font-medium text-foreground">{st?.type}</div>
                <div className="text-xs text-muted-foreground">{st?.capacity}</div>
              </div>
              {config?.serverType === st?.type && (
                <div className="ml-auto">
                  <Icon name="CheckCircle2" size={18} className="text-primary" />
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">{st?.description}</p>
            <div className="flex items-start gap-2 p-2 bg-background/50 rounded">
              <Icon name="Lightbulb" size={12} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{st?.recommendation}</p>
            </div>
            {st?.warmupDays > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                <Icon name="Clock" size={10} className="inline mr-1" />
                {st?.warmupDays}-day warmup period
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Step1ServerType;
