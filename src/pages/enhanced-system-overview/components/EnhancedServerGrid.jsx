import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

const EnhancedServerGrid = ({ servers, onRemoveServer, onAddServer }) => {
  const navigate = useNavigate();
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [filter, setFilter] = useState('all');

  const getPurposeColor = (purpose) => {
    switch (purpose) {
      case 'Production': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'Canary': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'Sanitizer': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Quarantine': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'HotSpare': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Verifier': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'Online': return 'bg-green-400';
      case 'Warning': return 'bg-yellow-400';
      case 'Quarantined': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getReputationColor = (rep) => {
    if (rep >= 90) return 'text-green-400';
    if (rep >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const filtered = filter === 'all' ? servers : servers?.filter(s => s?.purpose?.toLowerCase() === filter);

  const handleConfirmRemove = (server) => {
    setConfirmRemove(server);
  };

  const handleDoRemove = () => {
    if (confirmRemove) {
      onRemoveServer?.(confirmRemove?.id);
      setConfirmRemove(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">Server Fleet</h2>
            <p className="text-sm text-muted-foreground mt-1">{servers?.length} servers in fleet</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'Production', 'Canary', 'Sanitizer', 'Quarantine']?.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all' ? `All (${servers?.length})` : f}
              </button>
            ))}
            <button
              onClick={onAddServer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Icon name="Plus" size={14} />
              Add Server
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Server</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Purpose</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Reputation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Daily Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Blacklists</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cost/Mo</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered?.map(server => (
              <tr key={server?.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(server?.status)}`} />
                    <div>
                      <div className="text-sm font-medium text-foreground">{server?.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{server?.ip}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded border font-medium ${getPurposeColor(server?.purpose)}`}>
                    {server?.purpose}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getReputationColor(server?.reputation)}`}>{server?.reputation}%</span>
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${server?.reputation >= 90 ? 'bg-green-400' : server?.reputation >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${server?.reputation}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (server?.dailySent / server?.dailyLimit) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{((server?.dailySent / server?.dailyLimit) * 100)?.toFixed(0)}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{server?.dailySent?.toLocaleString()} / {server?.dailyLimit?.toLocaleString()}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${server?.blacklistCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {server?.blacklistCount > 0 ? `${server?.blacklistCount} listed` : 'Clear'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-foreground">${server?.costPerMonth}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => navigate('/server-detail')}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                      title="View Details"
                    >
                      <Icon name="Eye" size={14} />
                    </button>
                    <button
                      onClick={() => navigate('/server-autopsy')}
                      className="p-1.5 text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors"
                      title="Autopsy"
                    >
                      <Icon name="Stethoscope" size={14} />
                    </button>
                    <button
                      onClick={() => handleConfirmRemove(server)}
                      className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      title="Remove Server"
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered?.length === 0 && (
        <div className="p-12 text-center">
          <Icon name="Server" size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No servers found</p>
        </div>
      )}
      {/* Remove Confirmation Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <Icon name="AlertTriangle" size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Remove Server</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-foreground">{confirmRemove?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{confirmRemove?.ip}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Removing this server will stop all active campaigns assigned to it and cannot be reversed. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDoRemove}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                Remove Server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedServerGrid;
