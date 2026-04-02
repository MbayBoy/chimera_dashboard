import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const BackupTimeline = ({ backups, loading, selectedBackup, onSelectBackup, onRestoreClick }) => {
  const [expandedId, setExpandedId] = useState(null);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'running': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      default: return 'text-muted-foreground bg-muted/30 border-border';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-400';
      case 'failed': return 'bg-red-400';
      case 'running': return 'bg-blue-400 animate-pulse';
      default: return 'bg-muted-foreground';
    }
  };

  const getTypeIcon = (type) => type === 'manual' ? 'User' : 'Clock';

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-foreground font-semibold mb-4">Backup Timeline</h3>
        {[...Array(5)]?.map((_, i) => (
          <div key={i} className="flex gap-4 mb-4 animate-pulse">
            <div className="w-3 h-3 rounded-full bg-muted mt-1.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-foreground font-semibold">Backup Timeline</h3>
        <span className="text-xs text-muted-foreground">{backups?.length} restore points</span>
      </div>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-4">
          {backups?.map((backup) => (
            <div key={backup?.id} className="relative pl-8">
              {/* Timeline dot */}
              <div className={`absolute left-0 top-2 w-3 h-3 rounded-full border-2 border-background ${getStatusDot(backup?.status)}`} />

              <div
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedBackup?.id === backup?.id
                    ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                }`}
                onClick={() => {
                  onSelectBackup(backup);
                  setExpandedId(expandedId === backup?.id ? null : backup?.id);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name={getTypeIcon(backup?.backup_type)} size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{backup?.restore_point_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{new Date(backup?.backup_timestamp)?.toLocaleString()}</span>
                      <span>•</span>
                      <span>{backup?.database_size_mb?.toFixed(1)} MB</span>
                      <span>•</span>
                      <span>{backup?.table_count} tables</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(backup?.status)}`}>
                      {backup?.status}
                    </span>
                    <Icon
                      name={expandedId === backup?.id ? 'ChevronUp' : 'ChevronDown'}
                      size={14}
                      className="text-muted-foreground"
                    />
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === backup?.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Compression Ratio</p>
                        <p className="text-sm font-medium text-foreground">{backup?.compression_ratio}x</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Integrity Verified</p>
                        <p className={`text-sm font-medium ${backup?.integrity_verified ? 'text-green-400' : 'text-red-400'}`}>
                          {backup?.integrity_verified ? '✓ Verified' : '✗ Not Verified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Backup Type</p>
                        <p className="text-sm font-medium text-foreground capitalize">{backup?.backup_type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Retention</p>
                        <p className="text-sm font-medium text-foreground">{backup?.retention_days} days</p>
                      </div>
                    </div>

                    {backup?.included_tables?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2">Included Tables ({backup?.included_tables?.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {backup?.included_tables?.map((table, i) => (
                            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{table}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {backup?.notes && (
                      <p className="text-xs text-muted-foreground italic mb-4">{backup?.notes}</p>
                    )}

                    {backup?.status === 'completed' && (
                      <button
                        onClick={(e) => { e?.stopPropagation(); onRestoreClick(backup); }}
                        className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Restore to This Point
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BackupTimeline;
