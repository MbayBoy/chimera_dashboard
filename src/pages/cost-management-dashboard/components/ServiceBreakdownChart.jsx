import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const item = payload?.[0];
    return (
      <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-foreground">{item?.name}</p>
        <p className="text-sm text-primary">${item?.value?.toLocaleString()}/mo</p>
        <p className="text-xs text-muted-foreground">{item?.payload?.percentage}% of total</p>
      </div>
    );
  }
  return null;
};

const ServiceBreakdownChart = ({ data = [] }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const total = data?.reduce((sum, d) => sum + (d?.value || 0), 0);
  const enriched = data?.map(d => ({
    ...d,
    percentage: total > 0 ? ((d?.value / total) * 100)?.toFixed(1) : '0.0',
  }));

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">Monthly Service Breakdown</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={enriched}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {enriched?.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS?.[index % COLORS?.length]}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                stroke={activeIndex === index ? '#fff' : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {enriched?.map((item, i) => (
          <div key={item?.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS?.[i % COLORS?.length] }} />
            <span className="text-xs text-muted-foreground truncate">{item?.name}</span>
            <span className="text-xs font-medium text-foreground ml-auto">${item?.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServiceBreakdownChart;
