import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const generateData = (range) => {
  const points = range === '1h' ? 12 : range === '6h' ? 24 : range === '24h' ? 48 : 14;
  const labels = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    if (range === '7d') d?.setDate(d?.getDate() - i);
    else if (range === '24h') d?.setHours(d?.getHours() - i * 0.5);
    else if (range === '6h') d?.setMinutes(d?.getMinutes() - i * 15);
    else d?.setMinutes(d?.getMinutes() - i * 5);
    const label = range === '7d' ? d?.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : d?.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    labels?.push({
      time: label,
      p50: Math.round(180 + Math.random() * 120),
      p95: Math.round(600 + Math.random() * 400),
      p99: Math.round(1200 + Math.random() * 800),
    });
  }
  return labels;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
      <p className="text-gray-400 mb-2">{label}</p>
      {payload?.map((p) => (
        <div key={p?.dataKey} className="flex items-center gap-2 mb-1">
          <span style={{ color: p?.color }}>●</span>
          <span className="text-gray-300">{p?.dataKey?.toUpperCase()}: <span className="text-white font-semibold">{p?.value}ms</span></span>
        </div>
      ))}
    </div>
  );
};

const APIResponseChart = ({ latencyData, range: externalRange, onRangeChange }) => {
  const [range, setRange] = useState(externalRange || '1h');
  const data = generateData(range);
  const ranges = ['1h', '6h', '24h', '7d'];

  const handleRangeChange = (r) => {
    setRange(r);
    onRangeChange?.(r);
  };

  const p50 = latencyData?.p50 || 245;
  const p95 = latencyData?.p95 || 820;
  const p99 = latencyData?.p99 || 1800;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">API Response Times</h3>
          <p className="text-gray-400 text-xs mt-0.5">Latency percentiles (ms)</p>
        </div>
        <div className="flex gap-1">
          {ranges?.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                range === r ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mb-3">
        {[{ label: 'p50', color: '#22c55e', val: `${p50}ms` }, { label: 'p95', color: '#f59e0b', val: `${p95}ms` }, { label: 'p99', color: '#ef4444', val: `${p99 >= 1000 ? (p99 / 1000)?.toFixed(1) + 's' : p99 + 'ms'}` }]?.map((m) => (
          <div key={m?.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m?.color }} />
            <span className="text-gray-400 text-xs">{m?.label}</span>
            <span className="text-white text-xs font-semibold">{m?.val}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={2000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '2s threshold', fill: '#ef4444', fontSize: 10 }} />
          <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default APIResponseChart;
