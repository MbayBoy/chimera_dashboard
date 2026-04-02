import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RemoveServerModal = ({ server, onClose, onConfirm }) => {
  const isActive = server?.status === 'Active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
              <Icon name="Trash2" size={24} className="text-error" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">Remove Server</h2>
              <p className="text-sm text-muted-foreground">This action cannot be undone</p>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-xl mb-4">
            <div className="flex items-center gap-3">
              <Icon name="Server" size={20} className="text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">{server?.name}</p>
                <p className="text-sm text-muted-foreground font-mono">{server?.ip}</p>
              </div>
            </div>
          </div>

          {isActive && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2 mb-4">
              <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground">
                <strong>Warning:</strong> This server is currently active. Removing it will stop all outbound email from this server immediately. Make sure campaigns are reassigned first.
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-6">
            Removing this server will:
          </p>
          <ul className="space-y-2 mb-6">
            {[
              'Stop all email sending from this server',
              'Remove it from the Chimera fleet',
              'Uninstall the Chimera Agent',
              'Archive all associated logs',
            ]?.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="X" size={14} className="text-error flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <Button variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              iconName="Trash2"
              iconPosition="left"
              onClick={onConfirm}
            >
              Remove Server
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveServerModal;
