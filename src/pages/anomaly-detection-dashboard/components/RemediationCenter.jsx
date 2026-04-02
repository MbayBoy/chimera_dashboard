import Icon from '../../../components/AppIcon';

const severityConfig = {
  Critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  High: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  Medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  Low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
};

const riskColors = {
  Low: 'text-green-400 bg-green-500/10',
  Medium: 'text-yellow-400 bg-yellow-500/10',
  High: 'text-red-400 bg-red-500/10',
};

const RemediationCenter = ({ anomaly, executingActions, resolvedActions, onExecute, onResolve }) => {
  const sc = severityConfig?.[anomaly?.severity] || severityConfig?.Low;

  return (
    <div className={`bg-card border ${sc?.border} rounded-xl overflow-hidden`}>
      <div className={`p-4 ${sc?.bg} border-b ${sc?.border}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${sc?.bg} border ${sc?.border} flex items-center justify-center`}>
              <Icon name={anomaly?.icon} size={18} className={sc?.color} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${sc?.bg} ${sc?.color}`}>{anomaly?.severity}</span>
                <span className="text-xs text-muted-foreground">{anomaly?.type}</span>
              </div>
              <h3 className="font-semibold text-foreground mt-0.5">{anomaly?.title}</h3>
            </div>
          </div>
          {anomaly?.status !== 'Resolved' && (
            <button
              onClick={() => onResolve(anomaly?.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success text-xs font-medium rounded-lg border border-success/30 transition-colors"
            >
              <Icon name="CheckCircle" size={12} />
              Mark Resolved
            </button>
          )}
        </div>
      </div>
      <div className="p-5">
        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4">{anomaly?.description}</p>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Baseline</div>
            <div className="text-lg font-bold text-foreground">{anomaly?.baseline}</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Current</div>
            <div className={`text-lg font-bold ${sc?.color}`}>{anomaly?.current}</div>
          </div>
          <div className={`${sc?.bg} border ${sc?.border} rounded-lg p-3`}>
            <div className="text-xs text-muted-foreground mb-1">Delta</div>
            <div className={`text-lg font-bold ${sc?.color}`}>{anomaly?.metric}</div>
          </div>
        </div>

        {/* Remediation Actions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Wrench" size={14} className="text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Auto-Triggered Remediation Actions</h4>
          </div>
          <div className="space-y-2">
            {anomaly?.remediation?.map(rem => {
              const key = `${anomaly?.id}-${rem?.id}`;
              const isExecuting = executingActions?.[key];
              const isResolved = resolvedActions?.[key];
              return (
                <div key={rem?.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{rem?.action}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${riskColors?.[rem?.risk]}`}>
                        {rem?.risk} Risk
                      </span>
                      <span className="text-xs text-muted-foreground">ETA: {rem?.eta}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => !isResolved && !isExecuting && onExecute(anomaly?.id, rem?.id, rem?.action)}
                    disabled={isExecuting || isResolved}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex-shrink-0 ${
                      isResolved
                        ? 'bg-success/10 text-success border-success/30 cursor-default'
                        : isExecuting
                        ? 'bg-primary/10 text-primary border-primary/30 cursor-wait' :'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30'
                    }`}
                  >
                    {isResolved ? (
                      <><Icon name="CheckCircle" size={12} /> Done</>
                    ) : isExecuting ? (
                      <><Icon name="Loader" size={12} className="animate-spin" /> Running...</>
                    ) : (
                      <><Icon name="Play" size={12} /> Execute</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="Clock" size={12} />
          <span>Detected: {anomaly?.detectedAt?.toLocaleString()}</span>
          <span className="mx-2">·</span>
          <Icon name="Server" size={12} />
          <span>{anomaly?.server}</span>
        </div>
      </div>
    </div>
  );
};

export default RemediationCenter;
