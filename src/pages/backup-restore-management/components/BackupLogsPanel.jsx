import Icon from '../../../components/AppIcon';

const levelColors = {
  INFO: 'text-blue-400 bg-blue-400/10',
  WARN: 'text-yellow-400 bg-yellow-400/10',
  ERROR: 'text-red-400 bg-red-400/10',
  CRITICAL: 'text-red-500 bg-red-500/10',
};

const BackupLogsPanel = ({ logs, onRefresh }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-foreground font-semibold">Backup Audit Logs</h3>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/70 rounded-lg text-xs text-muted-foreground transition-colors"
        >
          <Icon name="RefreshCw" size={12} />
          Refresh
        </button>
      </div>
      {logs?.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="FileText" size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No backup logs found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {logs?.map(log => (
            <div key={log?.id} className="flex gap-3 p-3 bg-muted/20 rounded-lg">
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold flex-shrink-0 h-fit ${levelColors?.[log?.log_level] || 'text-muted-foreground bg-muted'}`}>
                {log?.log_level}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{log?.message}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{log?.source}</span>
                  <span>•</span>
                  <span>{new Date(log?.log_timestamp)?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackupLogsPanel;
