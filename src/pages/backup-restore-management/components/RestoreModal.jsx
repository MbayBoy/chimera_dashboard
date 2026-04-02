import Icon from '../../../components/AppIcon';

const RestoreModal = ({ backup, onConfirm, onCancel }) => {
  if (!backup) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Icon name="AlertTriangle" size={20} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-foreground font-semibold">Confirm Database Restore</h3>
              <p className="text-xs text-muted-foreground">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <p className="text-orange-400 text-sm font-medium mb-2">⚠ Restoration Impact Analysis</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• All data created after this backup will be permanently lost</li>
              <li>• Active sessions will be terminated during restoration</li>
              <li>• Estimated downtime: 3–8 minutes</li>
              <li>• All 9 workflow cron jobs will be paused and restarted</li>
            </ul>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Restore Point</span>
              <span className="text-foreground font-medium">{backup?.restore_point_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Backup Date</span>
              <span className="text-foreground">{new Date(backup?.backup_timestamp)?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Database Size</span>
              <span className="text-foreground">{backup?.database_size_mb?.toFixed(1)} MB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tables</span>
              <span className="text-foreground">{backup?.table_count} tables</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Integrity</span>
              <span className="text-green-400">✓ Verified</span>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-400">
              <strong>Affected Components:</strong> Database, API connections, Campaign Queue, Verification Jobs, Cron Workflows
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="RotateCcw" size={16} />
            Confirm Restore
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreModal;
