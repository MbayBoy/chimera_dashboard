import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Icon from '../../../components/AppIcon';

const generateHourlyData = (segment) => {
  const baseRates = {
    all:      [2,1,1,1,2,4,8,14,22,28,32,26,18,15,16,18,20,22,18,14,10,8,5,3],
    platinum: [1,1,1,1,2,5,10,18,32,42,48,38,24,18,16,14,12,10,8,6,4,3,2,1],
    gold:     [2,1,1,1,2,4,9,16,26,36,40,32,22,16,15,16,18,20,16,12,8,6,4,2],
    silver:   [2,1,1,1,2,3,7,12,18,22,26,22,18,16,18,20,22,24,20,16,12,8,5,3],
    bronze:   [3,2,1,1,2,3,6,10,14,16,18,16,14,14,16,18,22,26,24,18,14,10,7,4],
    lead:     [2,1,1,1,2,3,6,10,16,20,24,22,18,16,14,14,14,14,12,10,8,6,4,2],
  };
  const rates = baseRates?.[segment] || baseRates?.all;
  return rates?.map((rate, hour) => ({
    hour: `${hour?.toString()?.padStart(2,'0')}:00`,
    openRate: rate + Math.round((Math.random() - 0.5) * 2),
    clickRate: Math.round(rate * 0.28 + (Math.random() - 0.5)),
    engagement: Math.round(rate * 1.15 + (Math.random() - 0.5) * 2),
  }));
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
      {payload?.map(p => (
        <div key={p?.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.color }} />
          <span className="text-muted-foreground capitalize">{p?.dataKey}:</span>
          <span className="font-medium text-foreground">{p?.value}%</span>
        </div>
      ))}
    </div>
  );
};

const DeliveryWindowChart = ({ selectedSegment = 'all' }) => {
  const data = generateHourlyData(selectedSegment);
  const peakHour = data?.reduce((max, d) => d?.openRate > max?.openRate ? d : max, data?.[0]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="BarChart3" size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Delivery Window Analytics</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Open & click rates by hour (0–23) · Segment: <span className="text-primary capitalize">{selectedSegment}</span></p>
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-primary/10 rounded-lg px-3 py-2">
          <div className="text-xs text-muted-foreground">Peak Hour</div>
          <div className="text-lg font-bold text-primary">{peakHour?.hour}</div>
        </div>
        <div className="bg-success/10 rounded-lg px-3 py-2">
          <div className="text-xs text-muted-foreground">Peak Open Rate</div>
          <div className="text-lg font-bold text-success">{peakHour?.openRate}%</div>
        </div>
        <div className="bg-warning/10 rounded-lg px-3 py-2">
          <div className="text-xs text-muted-foreground">Peak Click Rate</div>
          <div className="text-lg font-bold text-warning">{peakHour?.clickRate}%</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
            tickFormatter={v => v?.split(':')?.[0]}
            interval={2}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Bar dataKey="openRate" name="Open Rate %" fill="#6366f1" radius={[2,2,0,0]} />
          <Bar dataKey="clickRate" name="Click Rate %" fill="#10b981" radius={[2,2,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DeliveryWindowChart;
