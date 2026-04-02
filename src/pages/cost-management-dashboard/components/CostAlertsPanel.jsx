import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const CostAlertsPanel = ({ alerts = [] }) => {
  const [dismissed, setDismissed] = useState(new Set());

  const visible = alerts?.filter(a => !dismissed?.has(a?.id));

  if (!visible?.length) return null;

  const severityConfig = {
    critical: { bg: 'bg-rose-500/10 border-rose-500/40', text: 'text-rose-400', icon: 'AlertOctagon' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/40', text: 'text-amber-400', icon: 'AlertTriangle' },
    info: { bg: 'bg-blue-500/10 border-blue-500/40', text: 'text-blue-400', icon: 'Info' },
  };

  return (
    <div className="space-y-2">
      {visible?.map(alert => {
        const config = severityConfig?.[alert?.severity] || severityConfig?.info;
        return (
          <div key={alert?.id} className={`flex items-start gap-3 p-3 rounded-lg border ${config?.bg}`}>
            <Icon name={config?.icon} size={16} className={`${config?.text} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${config?.text}`}>{alert?.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{alert?.message}</p>
            </div>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, alert?.id]))}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default CostAlertsPanel;
