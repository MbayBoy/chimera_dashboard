import Icon from '../../../components/AppIcon';

const KPIWidget = ({ title, value, unit, trend, trendValue, icon, iconColor }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return 'TrendingUp';
    if (trend === 'down') return 'TrendingDown';
    return 'Minus';
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-success';
    if (trend === 'down') return 'text-error';
    return 'text-muted-foreground';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 hover-lift transition-smooth">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold text-foreground">
              {value}
            </h3>
            {unit && (
              <span className="text-sm md:text-base text-muted-foreground">{unit}</span>
            )}
          </div>
        </div>
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg ${iconColor} bg-opacity-10 flex items-center justify-center flex-shrink-0`}>
          <Icon name={icon} size={20} className={iconColor} />
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center gap-2">
          <Icon name={getTrendIcon()} size={16} className={getTrendColor()} />
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {trendValue}
          </span>
          <span className="text-sm text-muted-foreground">vs yesterday</span>
        </div>
      )}
    </div>
  );
};

export default KPIWidget;