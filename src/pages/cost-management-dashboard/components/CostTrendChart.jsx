import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
        {payload?.map((p, i) => (
          <p key={i} className="text-xs" style={{ color: p?.color }}>
            {p?.name}: ${p?.value?.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CostTrendChart = ({ data = [] }) => {
  const currentMonth = new Date()?.getMonth();

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">12-Month Cost Trend</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> Actual</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block border-dashed" /> Projected</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={data?.[currentMonth]?.month} stroke="#6366f1" strokeDasharray="4 4" label={{ value: 'Now', fill: '#6366f1', fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3, fill: '#6366f1' }}
            name="Actual"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: '#f59e0b' }}
            name="Projected"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-2">AI-generated projections based on seasonal patterns and usage trends</p>
    </div>
  );
};

export default CostTrendChart;
