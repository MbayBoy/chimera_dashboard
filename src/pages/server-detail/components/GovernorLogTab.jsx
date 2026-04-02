import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const GovernorLogTab = ({ logs }) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filterOptions = [
    { value: 'all', label: 'All Events', icon: 'List' },
    { value: 'action', label: 'Actions', icon: 'Zap' },
    { value: 'warning', label: 'Warnings', icon: 'AlertTriangle' },
    { value: 'info', label: 'Info', icon: 'Info' }
  ];

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'text-error bg-error/10 border-error/20';
      case 'warning':
        return 'text-warning bg-warning/10 border-warning/20';
      case 'info':
        return 'text-primary bg-primary/10 border-primary/20';
      case 'success':
        return 'text-success bg-success/10 border-success/20';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'XCircle';
      case 'warning':
        return 'AlertTriangle';
      case 'info':
        return 'Info';
      case 'success':
        return 'CheckCircle2';
      default:
        return 'Circle';
    }
  };

  const getActionIcon = (action) => {
    if (action?.includes('limit')) return 'TrendingDown';
    if (action?.includes('increased')) return 'TrendingUp';
    if (action?.includes('paused')) return 'Pause';
    if (action?.includes('resumed')) return 'Play';
    if (action?.includes('blacklist')) return 'Shield';
    return 'Zap';
  };

  const filteredLogs = logs?.filter(log => {
    const matchesFilter = filter === 'all' || log?.type?.toLowerCase() === filter;
    const matchesSearch = searchTerm === '' || 
      log?.message?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      log?.action?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date?.toLocaleDateString();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
            AI Governor Activity Log
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            Automated decisions and actions taken by the AI Governor
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
          <Icon name="Activity" size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {filteredLogs?.length} Events
          </span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <div className="relative">
            <Icon 
              name="Search" 
              size={18} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
            />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e?.target?.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions?.map((option) => (
            <Button
              key={option?.value}
              variant={filter === option?.value ? 'default' : 'outline'}
              size="sm"
              iconName={option?.icon}
              iconPosition="left"
              onClick={() => setFilter(option?.value)}
            >
              {option?.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {filteredLogs?.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Icon name="FileText" size={32} className="text-muted-foreground md:w-10 md:h-10" />
            </div>
            <h4 className="text-base md:text-lg font-heading font-medium text-foreground mb-2">
              No Events Found
            </h4>
            <p className="text-sm md:text-base text-muted-foreground">
              {searchTerm ? 'Try adjusting your search or filters' : 'No governor activity recorded yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredLogs?.map((log) => (
              <div 
                key={log?.id}
                className="p-4 md:p-6 hover:bg-muted/50 transition-smooth"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getSeverityColor(log?.severity)}`}>
                    <Icon name={getSeverityIcon(log?.severity)} size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(log?.severity)}`}>
                          {log?.severity}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log?.timestamp)}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        ID: {log?.id}
                      </span>
                    </div>

                    <h4 className="text-sm md:text-base font-medium text-foreground mb-2">
                      {log?.message}
                    </h4>

                    <div className="flex items-start gap-2 mb-3">
                      <Icon name={getActionIcon(log?.action)} size={16} className="text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Action:</span> {log?.action}
                      </p>
                    </div>

                    {log?.details && (
                      <div className="bg-muted rounded-lg p-3 mt-3">
                        <div className="text-xs text-muted-foreground mb-1">Details</div>
                        <div className="text-sm text-foreground space-y-1">
                          {Object.entries(log?.details)?.map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-muted-foreground">{key}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {log?.recommendation && (
                      <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Icon name="Lightbulb" size={16} className="text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-medium text-primary mb-1">
                              Recommendation
                            </div>
                            <p className="text-sm text-foreground">
                              {log?.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Zap" size={20} className="text-primary" />
            <span className="text-sm text-muted-foreground">Total Actions</span>
          </div>
          <div className="text-2xl font-heading font-semibold text-foreground">
            {logs?.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Last 30 days
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="AlertTriangle" size={20} className="text-warning" />
            <span className="text-sm text-muted-foreground">Warnings</span>
          </div>
          <div className="text-2xl font-heading font-semibold text-foreground">
            {logs?.filter(l => l?.severity?.toLowerCase() === 'warning')?.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Requires attention
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Clock" size={20} className="text-success" />
            <span className="text-sm text-muted-foreground">Last Action</span>
          </div>
          <div className="text-base font-medium text-foreground">
            {logs?.length > 0 ? formatTimestamp(logs?.[0]?.timestamp) : 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Most recent
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovernorLogTab;