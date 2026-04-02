import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { Link } from 'react-router-dom';

const FleetStatusPanel = ({ servers, emergencyPause }) => {
  const [hoveredServer, setHoveredServer] = useState(null);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Online': case'Active':
        return { bg: 'bg-green-500', ring: 'ring-green-400', text: 'text-green-400', glow: 'shadow-green-500/50', dot: 'bg-green-500' };
      case 'Quarantined':
        return { bg: 'bg-red-500', ring: 'ring-red-400', text: 'text-red-400', glow: 'shadow-red-500/50', dot: 'bg-red-500' };
      case 'Warming':
        return { bg: 'bg-yellow-500', ring: 'ring-yellow-400', text: 'text-yellow-400', glow: 'shadow-yellow-500/50', dot: 'bg-yellow-500' };
      case 'Burnt':
        return { bg: 'bg-slate-600', ring: 'ring-slate-500', text: 'text-slate-400', glow: 'shadow-slate-500/50', dot: 'bg-slate-500' };
      case 'Provisioning':
        return { bg: 'bg-blue-500', ring: 'ring-blue-400', text: 'text-blue-400', glow: 'shadow-blue-500/50', dot: 'bg-blue-500' };
      default:
        return { bg: 'bg-slate-500', ring: 'ring-slate-400', text: 'text-slate-400', glow: 'shadow-slate-500/50', dot: 'bg-slate-500' };
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Online': case'Active':
        return 'CheckCircle2';
      case 'Quarantined':
        return 'ShieldAlert';
      case 'Warming':
        return 'Flame';
      case 'Burnt':
        return 'XCircle';
      default:
        return 'Circle';
    }
  };

  const statusCounts = servers?.reduce((acc, server) => {
    const st = server?.status;
    acc[st] = (acc?.[st] || 0) + 1;
    return acc;
  }, {});

  const getSentProgress = (sentToday, dailyLimit) => {
    if (!dailyLimit || dailyLimit === 0) return 0;
    return Math.min(100, Math.round((sentToday / dailyLimit) * 100));
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden h-full">
      <div className="p-4 md:p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl md:text-2xl font-heading font-semibold text-white">
            Fleet Status
          </h2>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              emergencyPause ? 'bg-red-500 animate-pulse' : 'bg-green-500 animate-pulse'
            }`} />
            <span className="text-sm text-slate-400">
              {emergencyPause ? 'Paused' : 'Live'}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-400">Real-time server fleet visualization</p>
      </div>
      <div className="p-6">
        {/* Status legend */}
        <div className="flex flex-wrap gap-4 mb-6">
          {Object.entries(statusCounts || {})?.map(([status, count]) => {
            const colors = getStatusColor(status);
            return (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${colors?.dot}`} />
                <span className="text-sm text-slate-300">
                  {status} <span className="text-slate-500">({count})</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="relative bg-slate-950 rounded-lg p-8 min-h-[400px] border border-slate-800">
          {servers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Icon name="Server" size={40} className="mb-3 opacity-30" />
              <span>No servers found</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {servers?.map((server) => {
                const colors = getStatusColor(server?.status);
                const isHovered = hoveredServer === server?.id;
                const sentPct = getSentProgress(server?.sentToday, server?.dailyLimit);

                return (
                  <Link
                    key={server?.id}
                    to={`/server-detail?id=${server?.id}`}
                    className="relative group"
                    onMouseEnter={() => setHoveredServer(server?.id)}
                    onMouseLeave={() => setHoveredServer(null)}
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className={`relative w-16 h-16 rounded-full ${colors?.bg} flex items-center justify-center transition-all duration-300 ${
                          isHovered ? `ring-4 ${colors?.ring} scale-110 shadow-lg ${colors?.glow}` : 'ring-2 ring-slate-700'
                        } ${
                          (server?.status === 'Online' || server?.status === 'Active') ? 'animate-pulse-subtle' : ''
                        } ${
                          emergencyPause ? 'opacity-50' : ''
                        }`}
                      >
                        <Icon name="Server" size={24} className="text-white" />
                        {/* Status indicator dot */}
                        <div
                          className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                            server?.status === 'Online' || server?.status === 'Active' ? 'bg-green-500' :
                            server?.status === 'Quarantined' ? 'bg-red-500' :
                            server?.status === 'Warming' ? 'bg-yellow-500' : 'bg-slate-500'
                          }`}
                        >
                          <Icon name={getStatusIcon(server?.status)} size={12} className="text-white" />
                        </div>
                        {/* Critical blacklist badge */}
                        {server?.hasCriticalBlacklist && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center border-2 border-slate-950">
                            <Icon name="ShieldX" size={10} className="text-white" />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 text-center w-full">
                        <div className={`text-sm font-medium ${colors?.text} mb-1 truncate max-w-[100px] mx-auto`}>
                          {server?.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono truncate max-w-[100px] mx-auto">
                          {server?.ip}
                        </div>
                        {/* Reputation score */}
                        <div className={`text-xs mt-1 font-semibold ${
                          (server?.reputation || 0) >= 80 ? 'text-green-400' :
                          (server?.reputation || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          Rep: {server?.reputation ?? '—'}
                        </div>
                        {/* Blacklist count */}
                        {(server?.blacklistCount || 0) > 0 && (
                          <div className="text-xs text-red-400 mt-0.5">
                            ⚠ {server?.blacklistCount} RBL{server?.blacklistCount > 1 ? 's' : ''}
                          </div>
                        )}
                        {/* Sent today progress bar */}
                        {server?.dailyLimit > 0 && (
                          <div className="mt-2 w-full max-w-[80px] mx-auto">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>{(server?.sentToday || 0)?.toLocaleString()}</span>
                              <span>{sentPct}%</span>
                            </div>
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  sentPct >= 90 ? 'bg-red-500' : sentPct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${sentPct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hover tooltip */}
                      {isHovered && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-10 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl min-w-[200px]">
                          <div className="text-xs space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Status:</span>
                              <span className={`font-medium ${colors?.text}`}>{server?.status}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Purpose:</span>
                              <span className="text-white">{server?.purpose}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Reputation:</span>
                              <span className={`font-medium ${
                                (server?.reputation || 0) >= 80 ? 'text-green-400' :
                                (server?.reputation || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                              }`}>{server?.reputation ?? '—'}/100</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Sent Today:</span>
                              <span className="text-white">{(server?.sentToday || 0)?.toLocaleString()} / {(server?.dailyLimit || 0)?.toLocaleString()}</span>
                            </div>
                            {(server?.blacklistCount || 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Blacklists:</span>
                                <span className="text-red-400 font-medium">{server?.blacklistCount} listed</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FleetStatusPanel;