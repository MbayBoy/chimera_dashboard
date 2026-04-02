
import Icon from '../../../components/AppIcon';

const ServerHeader = ({ serverData }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'bg-success/10 text-success border-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'offline':
        return 'bg-error/10 text-error border-error/20';
      case 'provisioning':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'CheckCircle2';
      case 'warning':
        return 'AlertTriangle';
      case 'offline':
        return 'XCircle';
      case 'provisioning':
        return 'Loader2';
      default:
        return 'Circle';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 lg:p-8 mb-4 md:mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 md:gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Server" size={24} className="text-primary md:w-7 md:h-7 lg:w-8 lg:h-8" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold text-foreground mb-2">
              {serverData?.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2">
                <Icon name="Globe" size={16} className="text-muted-foreground" />
                <span className="text-sm md:text-base text-foreground font-mono">
                  {serverData?.ip}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="MapPin" size={16} className="text-muted-foreground" />
                <span className="text-sm md:text-base text-muted-foreground">
                  {serverData?.location}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusColor(serverData?.status)}`}>
            <Icon 
              name={getStatusIcon(serverData?.status)} 
              size={16} 
              className={serverData?.status?.toLowerCase() === 'provisioning' ? 'animate-spin' : ''}
            />
            <span className="text-sm font-medium whitespace-nowrap">
              {serverData?.status}
            </span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Icon name="Activity" size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              Uptime: {serverData?.uptime}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6">
        <div className="bg-muted rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Mail" size={16} className="text-muted-foreground" />
            <span className="text-xs md:text-sm text-muted-foreground">Sent Today</span>
          </div>
          <div className="text-xl md:text-2xl font-heading font-semibold text-foreground">
            {serverData?.sentToday?.toLocaleString()}
          </div>
        </div>

        <div className="bg-muted rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="TrendingUp" size={16} className="text-success" />
            <span className="text-xs md:text-sm text-muted-foreground">Deliverability</span>
          </div>
          <div className="text-xl md:text-2xl font-heading font-semibold text-foreground">
            {serverData?.deliverability}%
          </div>
        </div>

        <div className="bg-muted rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Shield" size={16} className="text-primary" />
            <span className="text-xs md:text-sm text-muted-foreground">Reputation</span>
          </div>
          <div className="text-xl md:text-2xl font-heading font-semibold text-foreground">
            {serverData?.reputation}/100
          </div>
        </div>

        <div className="bg-muted rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="AlertCircle" size={16} className="text-warning" />
            <span className="text-xs md:text-sm text-muted-foreground">Blacklists</span>
          </div>
          <div className="text-xl md:text-2xl font-heading font-semibold text-foreground">
            {serverData?.blacklistCount}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerHeader;