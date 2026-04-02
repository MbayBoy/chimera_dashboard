import Icon from '../../../components/AppIcon';

const QuarantineLog = ({ logs }) => {
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
            Quarantine Log
          </h2>
          <p className="text-sm text-muted-foreground">
            AI Governor decisions and automated actions
          </p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="FileText" size={24} className="text-primary" />
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
        {logs?.map((log, index) => (
          <div key={log?.id} className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-smooth">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Icon name="Zap" size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {log?.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(log?.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {log?.details}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    <Icon name="Bot" size={10} />
                    {log?.automatedBy}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Reason: {log?.reason}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {logs?.length === 0 && (
        <div className="py-12 text-center">
          <Icon name="FileText" size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">No quarantine logs available</p>
        </div>
      )}
    </div>
  );
};

export default QuarantineLog;