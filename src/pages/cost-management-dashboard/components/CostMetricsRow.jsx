import Icon from '../../../components/AppIcon';

const MetricCard = ({ icon, label, value, sub, trend, color = 'text-primary' }) => (
  <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon name={icon} size={16} className={color} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      {trend && (
        <p className={`text-xs mt-1 ${trend > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </p>
      )}
    </div>
  </div>
);

const CostMetricsRow = ({ totalSpend = 0, budget = 0, emailsSent = 0, costPerEmail = 0 }) => {
  const industryBenchmark = 0.0012; // $0.0012 per email industry standard
  const vsIndustry = costPerEmail > 0
    ? (((costPerEmail - industryBenchmark) / industryBenchmark) * 100)?.toFixed(1)
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        icon="DollarSign"
        label="Total Monthly Spend"
        value={`$${totalSpend?.toLocaleString()}`}
        sub={`Budget: $${budget?.toLocaleString()}`}
        trend={totalSpend > budget ? 5.2 : -2.1}
        color="text-primary"
      />
      <MetricCard
        icon="Mail"
        label="Emails Sent (Month)"
        value={emailsSent > 1000000 ? `${(emailsSent / 1000000)?.toFixed(1)}M` : emailsSent > 1000 ? `${(emailsSent / 1000)?.toFixed(0)}K` : emailsSent?.toString()}
        sub="This billing period"
        trend={null}
        color="text-cyan-400"
      />
      <MetricCard
        icon="Calculator"
        label="Cost Per Email"
        value={costPerEmail > 0 ? `$${costPerEmail?.toFixed(4)}` : '$0.0000'}
        sub={`Industry: $${industryBenchmark}`}
        trend={vsIndustry ? parseFloat(vsIndustry) : null}
        color={costPerEmail <= industryBenchmark ? 'text-emerald-400' : 'text-amber-400'}
      />
      <MetricCard
        icon="TrendingDown"
        label="Projected Savings"
        value="$383/mo"
        sub="From AI recommendations"
        trend={null}
        color="text-emerald-400"
      />
    </div>
  );
};

export default CostMetricsRow;
