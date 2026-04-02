import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { motion } from 'framer-motion';

const TimelineOfEvents = ({ events }) => {
  const [expandedEvent, setExpandedEvent] = useState(null);

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { name: 'XCircle', color: 'text-error', bg: 'bg-error' };
      case 'warning':
        return { name: 'AlertTriangle', color: 'text-warning', bg: 'bg-warning' };
      case 'info':
        return { name: 'Info', color: 'text-primary', bg: 'bg-primary' };
      default:
        return { name: 'Circle', color: 'text-muted-foreground', bg: 'bg-muted' };
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date?.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">
            Timeline of Events
          </h2>
          <p className="text-sm text-muted-foreground">
            Chronological incident analysis leading to quarantine
          </p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
          <Icon name="Clock" size={24} className="text-error" />
        </div>
      </div>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-6">
          {events?.map((event, index) => {
            const severityIcon = getSeverityIcon(event?.severity);
            const isExpanded = expandedEvent === event?.id;

            return (
              <motion.div
                key={event?.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-16"
              >
                {/* Timeline dot */}
                <div className={`absolute left-3 top-3 w-6 h-6 rounded-full ${severityIcon?.bg}/20 border-2 ${severityIcon?.bg} flex items-center justify-center`}>
                  <div className={`w-2 h-2 rounded-full ${severityIcon?.bg}`} />
                </div>
                <div 
                  className={`bg-muted/50 rounded-lg p-4 cursor-pointer hover:bg-muted transition-smooth ${
                    isExpanded ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setExpandedEvent(isExpanded ? null : event?.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon name={severityIcon?.name} size={18} className={severityIcon?.color} />
                      <span className="text-sm font-medium text-foreground">
                        {event?.title}
                      </span>
                      {event?.automated && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          <Icon name="Zap" size={10} />
                          Auto
                        </span>
                      )}
                    </div>
                    <Icon 
                      name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
                      size={16} 
                      className="text-muted-foreground"
                    />
                  </div>

                  <p className="text-xs font-mono text-muted-foreground mb-2">
                    {formatTimestamp(event?.timestamp)}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {event?.description}
                  </p>

                  {isExpanded && event?.details && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-border"
                    >
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Event Details
                      </div>
                      <div className="space-y-2">
                        {Object.entries(event?.details)?.map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">{key}:</span>
                            <span className="text-xs font-medium text-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimelineOfEvents;