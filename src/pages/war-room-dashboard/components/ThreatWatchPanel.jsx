import { useRef, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const ThreatWatchPanel = ({ events, autoRefresh }) => {
  const feedRef = useRef(null);

  useEffect(() => {
    if (autoRefresh && feedRef?.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events, autoRefresh]);

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'Critical':
        return { icon: 'XCircle', color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/50', badge: 'bg-red-900/40 text-red-400' };
      case 'Error':
        return { icon: 'AlertOctagon', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/50', badge: 'bg-orange-900/40 text-orange-400' };
      case 'Warning':
        return { icon: 'AlertTriangle', color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-500/50', badge: 'bg-yellow-900/40 text-yellow-400' };
      case 'Success':
        return { icon: 'CheckCircle2', color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-500/50', badge: 'bg-green-900/40 text-green-400' };
      case 'Info':
      default:
        return { icon: 'Info', color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/50', badge: 'bg-blue-900/40 text-blue-400' };
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date?.toLocaleDateString();
  };

  const criticalCount = events?.filter(e => e?.severity === 'Critical')?.length || 0;
  const errorCount = events?.filter(e => e?.severity === 'Error')?.length || 0;
  const warnCount = events?.filter(e => e?.severity === 'Warning')?.length || 0;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-2xl font-heading font-semibold text-white">
              Threat Watch
            </h2>
            {(events?.length || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300">
                {events?.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-400">
                {criticalCount} Critical
              </span>
            )}
            {errorCount > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-900/40 text-orange-400">
                {errorCount} Error
              </span>
            )}
            {warnCount > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/40 text-yellow-400">
                {warnCount} Warn
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-500'
              }`} />
              <span className="text-sm text-slate-400">
                {autoRefresh ? 'Live' : 'Paused'}
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Real-time alerts from system_logs &middot; WARN / ERROR / CRITICAL
        </p>
      </div>
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3"
        style={{ maxHeight: '480px' }}
      >
        {(events?.length || 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Icon name="ShieldCheck" size={40} className="mb-3 opacity-30" />
            <span className="text-sm">No active alerts</span>
            <span className="text-xs text-slate-600 mt-1">System is operating normally</span>
          </div>
        ) : (
          events?.map((event) => {
            const config = getSeverityConfig(event?.severity);
            return (
              <div
                key={event?.id}
                className={`p-4 rounded-lg border ${config?.bg} ${config?.border} hover:bg-opacity-80 transition-all`}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon name={config?.icon} size={18} className={config?.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config?.badge}`}>
                        {event?.severity}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatTimestamp(event?.timestamp)}
                      </span>
                      {event?.type && (
                        <span className="text-xs text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                          {event?.type}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-white mb-2">
                      {event?.message}
                    </p>

                    <div className="flex items-center gap-4 text-xs">
                      {event?.serverId && (
                        <div className="flex items-center gap-1.5">
                          <Icon name="Server" size={12} className="text-slate-500" />
                          <span className="text-slate-400 font-mono">Server #{event?.serverId}</span>
                        </div>
                      )}
                      {event?.action && (
                        <div className="flex items-center gap-1.5">
                          <Icon name="Zap" size={12} className="text-slate-500" />
                          <span className="text-slate-400">{event?.action}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ThreatWatchPanel;