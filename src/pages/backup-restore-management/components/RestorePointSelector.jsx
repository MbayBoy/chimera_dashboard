import Icon from '../../../components/AppIcon';

const RestorePointSelector = ({ backups, selectedBackup, onSelectBackup, onRestoreClick }) => {
  const completedBackups = backups?.filter(b => b?.status === 'completed') || [];

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-foreground font-semibold mb-4">Restore Point Selection</h3>
      {!selectedBackup ? (
        <div className="text-center py-8">
          <Icon name="Database" size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select a backup from the timeline to view details</p>
        </div>
      ) : (
        <div>
          <div className="bg-muted/30 rounded-lg p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-1">Selected Restore Point</p>
            <p className="text-sm font-semibold text-foreground">{selectedBackup?.restore_point_name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(selectedBackup?.backup_timestamp)?.toLocaleString()}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Database Size</span>
              <span className="text-foreground font-medium">{selectedBackup?.database_size_mb?.toFixed(1)} MB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tables</span>
              <span className="text-foreground font-medium">{selectedBackup?.table_count}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Compression</span>
              <span className="text-foreground font-medium">{selectedBackup?.compression_ratio}x</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Integrity</span>
              <span className={`font-medium ${selectedBackup?.integrity_verified ? 'text-green-400' : 'text-red-400'}`}>
                {selectedBackup?.integrity_verified ? '✓ Verified' : '✗ Failed'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium capitalize ${selectedBackup?.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                {selectedBackup?.status}
              </span>
            </div>
          </div>

          {selectedBackup?.status === 'completed' ? (
            <button
              onClick={() => onRestoreClick(selectedBackup)}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="RotateCcw" size={16} />
              Restore to This Point
            </button>
          ) : (
            <div className="w-full py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <p className="text-red-400 text-sm">Cannot restore — backup failed</p>
            </div>
          )}
        </div>
      )}
      {/* Quick select list */}
      <div className="mt-6">
        <p className="text-xs text-muted-foreground mb-3">Available Restore Points ({completedBackups?.length})</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {completedBackups?.map(backup => (
            <button
              key={backup?.id}
              onClick={() => onSelectBackup(backup)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                selectedBackup?.id === backup?.id
                  ? 'bg-primary/10 border border-primary/30 text-primary' :'hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <div className="font-medium truncate">{backup?.restore_point_name}</div>
              <div className="text-xs opacity-70">{new Date(backup?.backup_timestamp)?.toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RestorePointSelector;
