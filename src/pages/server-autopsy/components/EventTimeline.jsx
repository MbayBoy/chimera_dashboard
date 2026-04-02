import Icon from '../../../components/AppIcon';

const EventTimeline = ({ events }) => {
  const getEventConfig = (type) => {
    switch (type) {
      case 'critical':
        return { color: 'text-error', bg: 'bg-error', border: 'border-error' };
      case 'warning':
        return { color: 'text-warning', bg: 'bg-warning', border: 'border-warning' };
      case 'success':
        return { color: 'text-success', bg: 'bg-success', border: 'border-success' };
      case 'info':
      default:
        return { color: 'text-primary', bg: 'bg-primary', border: 'border-primary' };
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date?.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden h-full">
      <div className="p-4 md:p-6 border-b border-border">
        <h3 className="text-xl font-heading font-semibold text-foreground mb-1">
          Timeline of Events
        </h3>
        <p className="text-sm text-muted-foreground">
          Chronological sequence leading to quarantine
        </p>
      </div>

      <div className="p-4 md:p-6">
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {events?.map((event, index) => {
              const config = getEventConfig(event?.type);
              
              return (
                <div key={event?.id} className="relative pl-14">
                  <div className={`absolute left-0 w-12 h-12 rounded-full ${config?.bg}/10 border-2 ${config?.border}/30 flex items-center justify-center`}>
                    <Icon name={event?.icon} size={20} className={config?.color} />
                  </div>
                  
                  <div className={`bg-muted rounded-lg p-4 border-l-4 ${config?.border}`}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className={`text-sm font-semibold ${config?.color} mb-1`}>
                          {event?.title}
                        </div>
                        <div className="text-sm text-foreground">
                          {event?.description}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(event?.timestamp)}
                      </div>
                    </div>
                    
                    {event?.details && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(event?.details)?.map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground">{key}:</span>
                              <span className="ml-1 font-medium text-foreground">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventTimeline;