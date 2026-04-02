import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const trendData = [
  { day: 'Mon', apiP95: 720, cacheHit: 89, poolUtil: 62, queryAvg: 340 },
  { day: 'Tue', apiP95: 680, cacheHit: 91, poolUtil: 58, queryAvg: 290 },
  { day: 'Wed', apiP95: 950, cacheHit: 84, poolUtil: 78, queryAvg: 520 },
  { day: 'Thu', apiP95: 820, cacheHit: 87, poolUtil: 71, queryAvg: 410 },
  { day: 'Fri', apiP95: 1240, cacheHit: 79, poolUtil: 88, queryAvg: 680 },
  { day: 'Sat', apiP95: 540, cacheHit: 93, poolUtil: 45, queryAvg: 220 },
  { day: 'Sun (Today)', apiP95: 820, cacheHit: 87, poolUtil: 67, queryAvg: 380 },
];

const metrics = [
  { key: 'apiP95', label: 'API p95 (ms)', color: '#f59e0b', change: '+14%', anomaly: true },
  { key: 'cacheHit', label: 'Cache Hit (%)', color: '#22c55e', change: '-2%', anomaly: false },
  { key: 'poolUtil', label: 'Pool Util (%)', color: '#3b82f6', change: '+8%', anomaly: false },
  { key: 'queryAvg', label: 'Query Avg (ms)', color: '#8b5cf6', change: '+11%', anomaly: true },
];

const PerformanceTrends = () => {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">7-Day Performance Trends</h3>
          <p className="text-gray-400 text-xs mt-0.5">Week-over-week comparison with anomaly detection</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {metrics?.map((m) => (
          <div key={m?.key} className={`rounded-lg p-3 border ${m?.anomaly ? 'bg-yellow-900/20 border-yellow-700' : 'bg-gray-800 border-gray-700'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-400 text-xs">{m?.label}</span>
              {m?.anomaly && <span className="text-yellow-400 text-xs">⚠</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m?.color }} />
              <span className={`text-sm font-semibold ${m?.change?.startsWith('+') ? (m?.anomaly ? 'text-red-400' : 'text-yellow-400') : 'text-green-400'}`}>
                {m?.change}
              </span>
              <span className="text-gray-500 text-xs">vs last week</span>
            </div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
          <Bar dataKey="apiP95" name="API p95 (ms)" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          <Bar dataKey="queryAvg" name="Query Avg (ms)" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceTrends;
