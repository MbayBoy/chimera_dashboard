import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

const CRITICAL_RBLS = ['zen.spamhaus.org', 'cbl.abuseat.org'];

const ServerHealthRow = ({ server }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'bg-success/10 text-success border-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'offline':
        return 'bg-error/10 text-error border-error/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getReputationColor = (score) => {
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-warning';
    return 'bg-error';
  };

  const getPurposeColor = (purpose) => {
    switch (purpose) {
      case 'Production': return 'text-primary';
      case 'Canary': return 'text-warning';
      case 'Quarantine': return 'text-error';
      case 'Sanitizer': return 'text-orange-600';
      default: return 'text-muted-foreground';
    }
  };

  const parseBlacklistStatus = (raw) => {
    if (!raw) return { totalListed: 0, listings: [] };
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return { totalListed: 0, listings: [] };
    }
  };

  const blData = parseBlacklistStatus(server?.blacklist_status);
  const listings = blData?.listings || [];
  const blCount = server?.blacklist_count ?? blData?.totalListed ?? server?.blacklistCount ?? 0;
  const hasCritical = listings?.some(l => CRITICAL_RBLS?.includes(l?.rbl));

  return (
    <tr className="border-b border-border hover:bg-muted/50 cursor-pointer transition-smooth">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${getStatusColor(server?.status)}/10 flex items-center justify-center flex-shrink-0`}>
            <Icon name="Server" size={18} className={getStatusColor(server?.status)} />
          </div>
          <div className="min-w-0">
            <Link
              to={`/server-detail?id=${server?.id}`}
              className="text-sm font-medium text-foreground hover:text-primary transition-smooth block truncate"
            >
              {server?.name}
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground font-mono">{server?.ip_address || server?.ip}</span>
              {server?.purpose && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className={`text-xs font-medium ${getPurposeColor(server?.purpose)}`}>
                    {server?.purpose}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs md:text-sm font-medium border ${getStatusColor(server?.status)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          {server?.status}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-2 min-w-[120px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm text-muted-foreground">Reputation</span>
            <span className="text-xs md:text-sm font-mono font-medium text-foreground">{server?.reputation_score ?? server?.reputation}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getReputationColor(server?.reputation_score ?? server?.reputation)}`}
              style={{ width: `${server?.reputation_score ?? server?.reputation}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-2 min-w-[140px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm text-muted-foreground">Daily Limit</span>
            <span className="text-xs md:text-sm font-mono font-medium text-foreground whitespace-nowrap">
              {(server?.daily_sent ?? server?.dailySent ?? 0)?.toLocaleString()} / {(server?.daily_limit ?? server?.dailyLimit ?? 0)?.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(((server?.daily_sent ?? server?.dailySent ?? 0) / (server?.daily_limit ?? server?.dailyLimit ?? 1)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        {blCount > 0 ? (
          <div className="flex flex-col items-center gap-1">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
              hasCritical ? 'bg-error/10 text-error border-error/20' : 'bg-warning/10 text-warning border-warning/20'
            }`}>
              <Icon name={hasCritical ? 'ShieldAlert' : 'AlertTriangle'} size={14} />
              <span className="text-xs md:text-sm font-medium font-mono">{blCount}</span>
            </div>
            {hasCritical && (
              <span className="text-xs text-error font-medium">Critical</span>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 text-success border border-success/20">
            <Icon name="CheckCircle2" size={14} />
            <span className="text-xs md:text-sm font-medium">Clean</span>
          </div>
        )}
      </td>
    </tr>
  );
};

export default ServerHealthRow;