import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const MAX_CONNECTIONS = 100;

const generatePoolData = () => {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now);
    t?.setMinutes(t?.getMinutes() - i * 2);
    const active = Math.round(45 + Math.random() * 40);
    data?.push({
      time: t?.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
      active,
      idle: Math.round(MAX_CONNECTIONS - active - Math.random() * 10),
      queued: Math.round(Math.random() * 8),
    });
  }
  return data;
};

const ConnectionPoolGraph = () => {
  const [data, setData] = useState(generatePoolData);
  const latest = data?.[data?.length - 1];
  const utilPct = Math.round((latest?.active / MAX_CONNECTIONS) * 100);

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const newPoint = {
          time: new Date()?.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
          active: Math.round(45 + Math.random() * 40),
          idle: Math.round(15 + Math.random() * 20),
          queued: Math.round(Math.random() * 8),
        };
        return [...prev?.slice(1), newPoint];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = utilPct >= 90 ? 'text-red-400' : utilPct >= 70 ? 'text-yellow-400' : 'text-green-400';
  const bgColor = utilPct >= 90 ? 'bg-red-900/30 border-red-700' : utilPct >= 70 ? 'bg-yellow-900/30 border-yellow-700' : 'bg-green-900/30 border-green-700';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Connection Pool Utilization</h3>
          <p className="text-gray-400 text-xs mt-0.5">Active / Max connections over time</p>
        </div>
        <div className={`border rounded-lg px-3 py-1.5 ${bgColor}`}>
          <span className={`text-sm font-bold ${statusColor}`}>{utilPct}%</span>
          <span className="text-gray-400 text-xs ml-1">utilized</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Active', value: latest?.active, color: 'text-blue-400' },
          { label: 'Idle', value: latest?.idle, color: 'text-green-400' },
          { label: 'Queued', value: latest?.queued, color: 'text-yellow-400' },
        ]?.map((m) => (
          <div key={m?.label} className="bg-gray-800 rounded-lg p-2.5 text-center">
            <div className={`text-lg font-bold ${m?.color}`}>{m?.value}</div>
            <div className="text-gray-400 text-xs">{m?.label}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} tickLine={false} interval={4} />
          <YAxis domain={[0, MAX_CONNECTIONS]} tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
          <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="active" stroke="#3b82f6" fill="url(#activeGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-gray-500 text-xs mt-2 text-center">Max capacity: {MAX_CONNECTIONS} connections · Red line: 90% warning threshold</p>
    </div>
  );
};

export default ConnectionPoolGraph;
