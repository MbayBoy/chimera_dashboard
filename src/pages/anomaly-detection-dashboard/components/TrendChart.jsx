import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';

const trendData = [
  { day: 'Feb 19', engagementDrops: 1, bounceSpikes: 0, costOverruns: 0, reputationChanges: 1 },
  { day: 'Feb 20', engagementDrops: 2, bounceSpikes: 1, costOverruns: 0, reputationChanges: 0 },
  { day: 'Feb 21', engagementDrops: 1, bounceSpikes: 0, costOverruns: 1, reputationChanges: 1 },
  { day: 'Feb 22', engagementDrops: 3, bounceSpikes: 2, costOverruns: 0, reputationChanges: 0 },
  { day: 'Feb 23', engagementDrops: 2, bounceSpikes: 1, costOverruns: 1, reputationChanges: 2 },
  { day: 'Feb 24', engagementDrops: 4, bounceSpikes: 1, costOverruns: 1, reputationChanges: 1 },
  { day: 'Feb 25', engagementDrops: 2, bounceSpikes: 2, costOverruns: 1, reputationChanges: 1 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
      {payload?.map(p => (
        <div key={p?.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.color }} />
          <span className="text-muted-foreground">{p?.name}:</span>
          <span className="font-medium text-foreground">{p?.value}</span>
        </div>
      ))}
    </div>
  );
};

const TrendChart = () => {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="TrendingUp" size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Anomaly Frequency Trends</h2>
        <span className="ml-auto text-xs text-muted-foreground">Last 7 days</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line type="monotone" dataKey="engagementDrops" name="Engagement Drops" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="bounceSpikes" name="Bounce Spikes" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="costOverruns" name="Cost Overruns" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="reputationChanges" name="Reputation Changes" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
