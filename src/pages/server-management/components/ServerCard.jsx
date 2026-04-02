import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Link } from 'react-router-dom';

const purposeColors = {
  Production: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Canary: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Sanitizer: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  HotSpare: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  Verifier: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

const statusColors = {
  Active: 'text-success',
  Warning: 'text-warning',
  Quarantined: 'text-error',
  HotSpare: 'text-muted-foreground',
  Provisioning: 'text-primary',
};

const statusDot = {
  Active: 'bg-success',
  Warning: 'bg-warning',
  Quarantined: 'bg-error',
  HotSpare: 'bg-muted-foreground',
  Provisioning: 'bg-primary animate-pulse',
};

const ServerCard = ({ server, onRemove, onStatusChange }) => {
  const usagePercent = server?.dailyLimit > 0 ? Math.round((server?.dailySent / server?.dailyLimit) * 100) : 0;
  const reputationColor = server?.reputation >= 80 ? 'text-success' : server?.reputation >= 60 ? 'text-warning' : 'text-error';
  const usageColor = usagePercent >= 90 ? 'bg-error' : usagePercent >= 70 ? 'bg-warning' : 'bg-success';

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${statusDot?.[server?.status] || 'bg-muted-foreground'}`} />
            <h3 className="font-semibold text-foreground text-sm truncate">{server?.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{server?.ip}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0 ml-2 ${
          purposeColors?.[server?.purpose] || 'bg-muted text-muted-foreground border-border'
        }`}>
          {server?.purpose}
        </span>
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className={`text-lg font-mono font-bold ${reputationColor}`}>{server?.reputation}</div>
          <div className="text-xs text-muted-foreground">Reputation</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-mono font-bold text-foreground">{server?.dailySent?.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Sent Today</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-mono font-bold ${server?.blacklistCount > 0 ? 'text-error' : 'text-success'}`}>
            {server?.blacklistCount}
          </div>
          <div className="text-xs text-muted-foreground">Blacklists</div>
        </div>
      </div>
      {/* Usage Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Daily Usage</span>
          <span>{usagePercent}% of {server?.dailyLimit?.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usageColor}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>
      {/* Info Row */}
      <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Icon name="MapPin" size={12} />
          <span>{server?.region}</span>
        </div>
        {server?.warmupDay > 0 && (
          <div className="flex items-center gap-1">
            <Icon name="Flame" size={12} className="text-orange-400" />
            <span>Warmup Day {server?.warmupDay}</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ${statusColors?.[server?.status] || 'text-muted-foreground'}`}>
          <Icon name="Activity" size={12} />
          <span>{server?.status}</span>
        </div>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link to="/server-detail" className="flex-1">
          <Button variant="outline" size="sm" fullWidth iconName="Eye" iconPosition="left">
            Details
          </Button>
        </Link>
        {server?.status === 'Quarantined' ? (
          <Button
            variant="outline"
            size="sm"
            iconName="RefreshCw"
            onClick={() => onStatusChange(server?.id, 'Active')}
            className="text-success border-success/30 hover:bg-success/10"
          >
            Restore
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            iconName="ShieldOff"
            onClick={() => onStatusChange(server?.id, 'Quarantined')}
            className="text-warning border-warning/30 hover:bg-warning/10"
          >
            Quarantine
          </Button>
        )}
        <button
          onClick={onRemove}
          className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors"
          title="Remove server"
        >
          <Icon name="Trash2" size={16} />
        </button>
      </div>
    </div>
  );
};

export default ServerCard;
