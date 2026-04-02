import { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';

const SystemLogFeed = ({ logs }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (autoScroll && logContainerRef?.current) {
      logContainerRef.current.scrollTop = logContainerRef?.current?.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (logContainerRef?.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef?.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { name: 'XCircle', color: 'text-error' };
      case 'warning':
        return { name: 'AlertTriangle', color: 'text-warning' };
      case 'info':
        return { name: 'Info', color: 'text-primary' };
      case 'success':
        return { name: 'CheckCircle2', color: 'text-success' };
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
      case 'success':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date?.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-full">
      <div className="p-4 md:p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl md:text-2xl font-heading font-semibold text-foreground">
            System Log Feed
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-2 rounded-lg transition-smooth ${
                autoScroll 
                  ? 'bg-primary/10 text-primary' :'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
            >
              <Icon name={autoScroll ? 'Play' : 'Pause'} size={16} />
            </button>
            <span className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Real-time system events and notifications
        </p>
      </div>
      <div 
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6 space-y-3"
      >
        {logs?.map((log, index) => {
          const severityIcon = getSeverityIcon(log?.severity);
          return (
            <div 
              key={index}
              className="flex gap-3 p-3 md:p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-smooth"
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon name={severityIcon?.name} size={18} className={severityIcon?.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border flex-shrink-0 ${getSeverityBadge(log?.severity)}`}>
                    {log?.severity}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                    {formatTimestamp(log?.timestamp)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {log?.source}
                  </span>
                </div>
                
                <p className="text-sm text-foreground leading-relaxed break-words">
                  {log?.message}
                </p>
                
                {log?.serverId && (
                  <div className="mt-2 flex items-center gap-2">
                    <Icon name="Server" size={12} className="text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">
                      {log?.serverId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!autoScroll && (
        <div className="p-3 border-t border-border bg-muted/50 flex-shrink-0">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (logContainerRef?.current) {
                logContainerRef.current.scrollTop = logContainerRef?.current?.scrollHeight;
              }
            }}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-smooth flex items-center justify-center gap-2"
          >
            <Icon name="ArrowDown" size={16} />
            Resume Auto-Scroll
          </button>
        </div>
      )}
    </div>
  );
};

export default SystemLogFeed;