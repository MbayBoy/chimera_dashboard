import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const monitors = [
  { id: 'm1', name: 'Engagement Rate Monitor', status: 'Alert', lastCheck: 'Just now', interval: '5 min', icon: 'Activity', color: 'text-red-400' },
  { id: 'm2', name: 'Bounce Rate Tracker', status: 'Alert', lastCheck: '2 min ago', interval: '5 min', icon: 'AlertOctagon', color: 'text-orange-400' },
  { id: 'm3', name: 'Budget Watchdog', status: 'Warning', lastCheck: '5 min ago', interval: '15 min', icon: 'DollarSign', color: 'text-yellow-400' },
  { id: 'm4', name: 'Reputation Score Monitor', status: 'Alert', lastCheck: '3 min ago', interval: '5 min', icon: 'Shield', color: 'text-orange-400' },
  { id: 'm5', name: 'DNS Health Checker', status: 'OK', lastCheck: '1 min ago', interval: '10 min', icon: 'Globe', color: 'text-green-400' },
  { id: 'm6', name: 'Blacklist Scanner', status: 'OK', lastCheck: '4 min ago', interval: '30 min', icon: 'Search', color: 'text-green-400' },
  { id: 'm7', name: 'Verification Accuracy', status: 'Warning', lastCheck: '10 min ago', interval: '1 hour', icon: 'CheckCircle', color: 'text-yellow-400' },
  { id: 'm8', name: 'Server Capacity Monitor', status: 'OK', lastCheck: '1 min ago', interval: '1 min', icon: 'Server', color: 'text-green-400' },
];

const statusConfig = {
  OK: { color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-500' },
  Warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  Alert: { color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500 animate-pulse' },
};

const MonitoringPanel = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastRefresh(new Date());
    }, 1500);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Monitor" size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Real-Time Monitoring Panel</h2>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Last refresh: {lastRefresh?.toLocaleTimeString()}</span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium rounded-lg border border-primary/30 transition-colors"
          >
            <Icon name="RefreshCw" size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {monitors?.map(monitor => {
          const sc = statusConfig?.[monitor?.status];
          return (
            <div key={monitor?.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className={`w-8 h-8 rounded-lg ${sc?.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon name={monitor?.icon} size={14} className={monitor?.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{monitor?.name}</div>
                <div className="text-xs text-muted-foreground">Every {monitor?.interval} · {monitor?.lastCheck}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${sc?.dot}`} />
                <span className={`text-xs font-medium ${sc?.color}`}>{monitor?.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonitoringPanel;
