import Icon from '../../../components/AppIcon';

const severityConfig = {
  Critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', dot: 'bg-red-500' },
  High: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40', dot: 'bg-orange-500' },
  Medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', dot: 'bg-yellow-500' },
  Low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/40', dot: 'bg-blue-400' },
};

const statusConfig = {
  Active: 'text-red-400 bg-red-500/10',
  Investigating: 'text-yellow-400 bg-yellow-500/10',
  Resolved: 'text-green-400 bg-green-500/10',
};

const formatTime = (date) => {
  const diff = Date.now() - date?.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const AnomalyGrid = ({ anomalies, selectedAnomaly, onSelect }) => {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="Radar" size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Detected Anomalies</h2>
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {anomalies?.length} found
          </span>
        </div>
      </div>
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {anomalies?.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="CheckCircle" size={32} className="text-success mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No anomalies match current filters</p>
          </div>
        ) : (
          anomalies?.map(anomaly => {
            const sc = severityConfig?.[anomaly?.severity] || severityConfig?.Low;
            const isSelected = selectedAnomaly?.id === anomaly?.id;
            return (
              <button
                key={anomaly?.id}
                onClick={() => onSelect(anomaly)}
                className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                  isSelected ? 'bg-primary/5 border-l-4 border-primary' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${sc?.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon name={anomaly?.icon} size={14} className={sc?.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc?.dot} ${anomaly?.status === 'Active' ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs font-bold ${sc?.color}`}>{anomaly?.severity}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusConfig?.[anomaly?.status]}`}>
                        {anomaly?.status}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-foreground truncate">{anomaly?.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{anomaly?.type} · {formatTime(anomaly?.detectedAt)}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">Δ <strong className={sc?.color}>{anomaly?.metric}</strong></span>
                      <span className="text-xs text-muted-foreground">{anomaly?.server}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnomalyGrid;
