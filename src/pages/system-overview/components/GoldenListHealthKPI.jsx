import Icon from '../../../components/AppIcon';

const GoldenListHealthKPI = ({ goldenListData }) => {
  const getTrendIcon = () => {
    if (!goldenListData?.trend) return 'Minus';
    const trendValue = parseFloat(goldenListData?.trend);
    return trendValue >= 0 ? 'TrendingUp' : 'TrendingDown';
  };

  const getTrendColor = () => {
    if (!goldenListData?.trend) return 'text-muted-foreground';
    const trendValue = parseFloat(goldenListData?.trend);
    return trendValue >= 0 ? 'text-success' : 'text-error';
  };

  return (
    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-lg p-6 hover-lift transition-smooth">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="Star" size={20} className="text-primary fill-current" />
            <p className="text-sm font-medium text-foreground">Golden List Health</p>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-heading font-bold text-foreground">
              {goldenListData?.size?.toLocaleString()}
            </h3>
            <span className="text-sm text-muted-foreground">contacts</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Icon name="Award" size={24} className="text-primary" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-card rounded-lg border border-border">
          <div className="text-xs text-muted-foreground mb-1">Engagement</div>
          <div className="text-xl font-heading font-bold text-success">
            {goldenListData?.engagement}%
          </div>
        </div>
        <div className="p-3 bg-card rounded-lg border border-border">
          <div className="text-xs text-muted-foreground mb-1">Growth</div>
          <div className="flex items-center gap-1">
            <Icon name={getTrendIcon()} size={16} className={getTrendColor()} />
            <span className={`text-xl font-heading font-bold ${getTrendColor()}`}>
              {goldenListData?.trend}
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Icon name="CheckCircle2" size={16} className="text-success mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground mb-1">
              Premium Asset Protected
            </div>
            <div className="text-xs text-muted-foreground">
              Your most valuable contacts with 90%+ engagement, active in last 14 days, and zero complaints.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoldenListHealthKPI;