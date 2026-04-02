import React from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';

const generateTrend = (base, variance) =>
  Array.from({ length: 20 }, (_, i) => ({
    i,
    v: Math.min(100, Math.max(0, base + (Math.random() - 0.5) * variance)),
  }));

const resources = [
  { name: 'CPU Usage', value: 67, trend: generateTrend(67, 20), color: '#3b82f6', unit: '%', warn: 80, crit: 95 },
  { name: 'Memory', value: 78, trend: generateTrend(78, 10), color: '#8b5cf6', unit: '%', warn: 75, crit: 90 },
  { name: 'Disk Usage', value: 54, trend: generateTrend(54, 5), color: '#06b6d4', unit: '%', warn: 80, crit: 90 },
  { name: 'Network I/O', value: 42, trend: generateTrend(42, 25), color: '#f59e0b', unit: 'Mbps', warn: 800, crit: 950 },
];

const getStatus = (value, warn, crit) => {
  if (value >= crit) return { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500' };
  if (value >= warn) return { label: 'Warning', color: 'text-yellow-400', bg: 'bg-yellow-500' };
  return { label: 'Normal', color: 'text-green-400', bg: 'bg-green-500' };
};

const ResourceCard = ({ resource }) => {
  const status = getStatus(resource?.value, resource?.warn, resource?.crit);
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-300 text-xs font-medium">{resource?.name}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${status?.color} bg-gray-700`}>{status?.label}</span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-white">{resource?.value}</span>
        <span className="text-gray-400 text-sm mb-0.5">{resource?.unit}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${status?.bg}`}
          style={{ width: `${Math.min(100, resource?.value)}%` }}
        />
      </div>
      <ResponsiveContainer width="100%" height={50}>
        <AreaChart data={resource?.trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${resource?.name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={resource?.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={resource?.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={resource?.color} fill={`url(#grad-${resource?.name})`} strokeWidth={1.5} dot={false} />
          <Tooltip contentStyle={{ display: 'none' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const SystemResourceMetrics = () => {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-sm">System Resource Metrics</h3>
        <p className="text-gray-400 text-xs mt-0.5">CPU · Memory · Disk · Network with historical trends</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {resources?.map((r) => <ResourceCard key={r?.name} resource={r} />)}
      </div>
    </div>
  );
};

export default SystemResourceMetrics;
