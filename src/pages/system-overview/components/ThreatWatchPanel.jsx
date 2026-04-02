import { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { motion, AnimatePresence } from 'framer-motion';

const ThreatWatchPanel = ({ threats }) => {
  const [displayedThreats, setDisplayedThreats] = useState([]);

  useEffect(() => {
    setDisplayedThreats(threats?.slice(0, 10) || []);
  }, [threats]);

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { name: 'XCircle', color: 'text-error' };
      case 'warning':
        return { name: 'AlertTriangle', color: 'text-warning' };
      case 'info':
        return { name: 'Info', color: 'text-primary' };
      default:
        return { name: 'Circle', color: 'text-muted-foreground' };
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-error/10 text-error border-error/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'info':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
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

  return (
    <div className="bg-card border border-border rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">
            Threat Watch
          </h2>
          <p className="text-sm text-muted-foreground">
            High-priority system events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3">
        <AnimatePresence>
          {displayedThreats?.map((threat, index) => {
            const severityIcon = getSeverityIcon(threat?.severity);
            return (
              <motion.div
                key={`${threat?.timestamp}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`p-4 rounded-lg border ${
                  threat?.severity?.toLowerCase() === 'critical' ?'bg-error/5 border-error/20'
                    : threat?.severity?.toLowerCase() === 'warning' ?'bg-warning/5 border-warning/20' :'bg-muted/50 border-border'
                } hover:shadow-md transition-all`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon name={severityIcon?.name} size={18} className={severityIcon?.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${
                        getSeverityBadge(threat?.severity)
                      }`}>
                        {threat?.severity}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(threat?.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed mb-2">
                      {threat?.message}
                    </p>
                    <div className="flex items-center gap-2">
                      <Icon name="Server" size={12} className="text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground">
                        {threat?.serverId}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {threat?.source}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {displayedThreats?.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <Icon name="Shield" size={48} className="text-success mb-4" />
          <p className="text-sm text-muted-foreground">All systems operational</p>
          <p className="text-xs text-muted-foreground mt-1">No threats detected</p>
        </div>
      )}
    </div>
  );
};

export default ThreatWatchPanel;