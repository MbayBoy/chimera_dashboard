import React from 'react';


const cacheBreakdown = [
  { name: 'Contact Lists', hitRate: 94, hits: 18420, misses: 1180 },
  { name: 'Server Status', hitRate: 88, hits: 7040, misses: 960 },
  { name: 'Campaign Data', hitRate: 76, hits: 3800, misses: 1200 },
  { name: 'Domain Lookup', hitRate: 91, hits: 9100, misses: 900 },
  { name: 'User Sessions', hitRate: 99, hits: 4950, misses: 50 },
];

const GaugeArc = ({ rate }) => {
  const radius = 70;
  const cx = 90;
  const cy = 90;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle + (startAngle - endAngle) * (rate / 100);
  const bgPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
  const fillAngle = Math.PI * (1 - rate / 100);
  const fx = cx + radius * Math.cos(Math.PI - fillAngle);
  const fy = cy - radius * Math.sin(Math.PI - fillAngle);
  const largeArc = fillAngle > Math.PI ? 1 : 0;
  const fillPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${largeArc} 1 ${fx} ${fy}`;
  const color = rate >= 80 ? '#22c55e' : rate >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="180" height="100" viewBox="0 0 180 100">
      <path d={bgPath} fill="none" stroke="#374151" strokeWidth="14" strokeLinecap="round" />
      <path d={fillPath} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">{rate}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#9ca3af" fontSize="10">Hit Rate</text>
      <text x={cx - radius + 4} y={cy + 18} fill="#9ca3af" fontSize="9">0%</text>
      <text x={cx + radius - 18} y={cy + 18} fill="#9ca3af" fontSize="9">100%</text>
    </svg>
  );
};

const CacheHitRateGauge = ({ cacheStats }) => {
  const overallRate = cacheStats?.overall || 87;
  const breakdown = cacheStats?.breakdown || cacheBreakdown;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="mb-3">
        <h3 className="text-white font-semibold text-sm">Cache Hit Rate</h3>
        <p className="text-gray-400 text-xs mt-0.5">Overall & by cache key type</p>
      </div>
      <div className="flex items-center justify-center mb-4">
        <GaugeArc rate={overallRate} />
      </div>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-xs px-2 py-0.5 rounded-full ${overallRate >= 80 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
          {overallRate >= 80 ? '✓ Above threshold' : '⚠ Below 80% threshold'}
        </span>
        <span className="text-gray-400 text-xs">Target: 80%</span>
      </div>
      <div className="space-y-2">
        {breakdown?.map((c) => (
          <div key={c?.name}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-400">{c?.name}</span>
              <span className={c?.hitRate >= 80 ? 'text-green-400' : 'text-yellow-400'}>{c?.hitRate}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${c?.hitRate >= 80 ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${c?.hitRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CacheHitRateGauge;
