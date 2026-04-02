import Icon from '../../../components/AppIcon';
import { motion } from 'framer-motion';

const FleetStatusPanel = ({ servers }) => {
  const getPurposeColor = (purpose) => {
    switch (purpose) {
      case 'Production':
        return { bg: 'bg-success', text: 'text-success', glow: 'shadow-success/50' };
      case 'Canary':
        return { bg: 'bg-warning', text: 'text-warning', glow: 'shadow-warning/50' };
      case 'Quarantine':
        return { bg: 'bg-error', text: 'text-error', glow: 'shadow-error/50' };
      case 'Sanitizer':
        return { bg: 'bg-muted-foreground', text: 'text-muted-foreground', glow: 'shadow-muted/50' };
      default:
        return { bg: 'bg-muted', text: 'text-muted-foreground', glow: 'shadow-muted/50' };
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'CheckCircle2';
      case 'warning':
        return 'AlertTriangle';
      case 'quarantined': case'offline':
        return 'XCircle';
      default:
        return 'Circle';
    }
  };

  const groupedServers = servers?.reduce((acc, server) => {
    if (!acc?.[server?.purpose]) {
      acc[server?.purpose] = [];
    }
    acc?.[server?.purpose]?.push(server);
    return acc;
  }, {});

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">
            Fleet Status
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time server infrastructure health
          </p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="Server" size={24} className="text-primary" />
        </div>
      </div>
      <div className="space-y-6">
        {Object.entries(groupedServers || {})?.map(([purpose, purposeServers]) => {
          const colors = getPurposeColor(purpose);
          return (
            <div key={purpose}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${colors?.bg}`} />
                <span className="text-sm font-medium text-foreground">
                  {purpose} ({purposeServers?.length})
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {purposeServers?.map((server, index) => (
                  <motion.div
                    key={server?.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="relative group"
                  >
                    <div className={`w-full aspect-square rounded-lg border-2 ${colors?.text} border-current bg-card hover:bg-muted/50 transition-all cursor-pointer flex flex-col items-center justify-center p-2 ${
                      server?.status?.toLowerCase() === 'online' ? `shadow-lg ${colors?.glow}` : ''
                    }`}>
                      <Icon 
                        name={getStatusIcon(server?.status)} 
                        size={24} 
                        className={`${colors?.text} mb-1`}
                      />
                      <span className="text-xs font-mono text-foreground text-center truncate w-full">
                        {server?.name?.split(' ')?.pop()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {server?.reputation}%
                      </span>
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
                        <div className="text-xs font-medium text-foreground mb-2">{server?.name}</div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>IP:</span>
                            <span className="font-mono">{server?.ip}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className={colors?.text}>{server?.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Reputation:</span>
                            <span>{server?.reputation}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Daily Sent:</span>
                            <span>{server?.dailySent?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 pt-6 border-t border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Production</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Canary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-error" />
            <span className="text-xs text-muted-foreground">Quarantine</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span className="text-xs text-muted-foreground">Sanitizer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FleetStatusPanel;