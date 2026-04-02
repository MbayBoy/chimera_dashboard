import Icon from '../../../components/AppIcon';

const timezoneRegions = [
  { id: 'na-east', label: 'North America East', timezone: 'EST/CST', contacts: 28340, optimalHour: 9, color: '#a855f7', x: 18, y: 35, width: 12, height: 20 },
  { id: 'na-west', label: 'North America West', timezone: 'MST/PST', contacts: 14220, optimalHour: 10, color: '#eab308', x: 8, y: 30, width: 10, height: 22 },
  { id: 'europe', label: 'Europe', timezone: 'GMT/CET', contacts: 18450, optimalHour: 10, color: '#3b82f6', x: 44, y: 25, width: 12, height: 18 },
  { id: 'asia-south', label: 'South Asia', timezone: 'IST', contacts: 9870, optimalHour: 11, color: '#10b981', x: 62, y: 38, width: 8, height: 14 },
  { id: 'asia-east', label: 'East Asia', timezone: 'JST/CST', contacts: 7650, optimalHour: 9, color: '#f97316', x: 74, y: 30, width: 10, height: 16 },
  { id: 'latam', label: 'Latin America', timezone: 'BRT/ART', contacts: 5430, optimalHour: 14, color: '#ec4899', x: 22, y: 55, width: 10, height: 20 },
  { id: 'africa', label: 'Africa', timezone: 'WAT/EAT', contacts: 3210, optimalHour: 12, color: '#84cc16', x: 46, y: 45, width: 10, height: 22 },
  { id: 'oceania', label: 'Oceania', timezone: 'AEST', contacts: 2890, optimalHour: 8, color: '#06b6d4', x: 78, y: 58, width: 10, height: 12 },
];

const TimezoneMap = () => {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Globe" size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Global Timezone Distribution</h2>
        <span className="ml-auto text-xs text-muted-foreground">Optimal_Send_Time_Hour by region</span>
      </div>
      {/* SVG World Map Representation */}
      <div className="relative bg-muted/30 rounded-lg overflow-hidden" style={{ paddingBottom: '50%' }}>
        <svg
          viewBox="0 0 100 50"
          className="absolute inset-0 w-full h-full"
          style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
        >
          {/* Ocean background */}
          <rect x="0" y="0" width="100" height="50" fill="#0f172a" />
          {/* Grid lines */}
          {[10,20,30,40,50,60,70,80,90]?.map(x => (
            <line key={`vl-${x}`} x1={x} y1="0" x2={x} y2="50" stroke="#1e293b" strokeWidth="0.2" />
          ))}
          {[10,20,30,40]?.map(y => (
            <line key={`hl-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="#1e293b" strokeWidth="0.2" />
          ))}
          {/* Equator */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="#334155" strokeWidth="0.3" strokeDasharray="1,1" />

          {/* Continent blobs */}
          {timezoneRegions?.map(region => (
            <g key={region?.id}>
              <rect
                x={region?.x}
                y={region?.y}
                width={region?.width}
                height={region?.height}
                rx="1.5"
                fill={region?.color}
                fillOpacity="0.25"
                stroke={region?.color}
                strokeWidth="0.4"
              />
              {/* Contact density dot */}
              <circle
                cx={region?.x + region?.width / 2}
                cy={region?.y + region?.height / 2}
                r={Math.sqrt(region?.contacts / 5000) * 1.2}
                fill={region?.color}
                fillOpacity="0.7"
              />
              {/* Optimal hour label */}
              <text
                x={region?.x + region?.width / 2}
                y={region?.y + region?.height / 2 + 0.5}
                textAnchor="middle"
                fontSize="1.8"
                fill="white"
                fontWeight="bold"
              >
                {region?.optimalHour}h
              </text>
            </g>
          ))}
        </svg>
      </div>
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {timezoneRegions?.map(region => (
          <div key={region?.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: region?.color }} />
            <div className="min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{region?.label}</div>
              <div className="text-xs text-muted-foreground">{region?.timezone} · {region?.optimalHour}:00</div>
            </div>
          </div>
        ))}
      </div>
      {/* Contact density scale */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>Contact density:</span>
        {[2890, 9870, 18450, 28340]?.map((n, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="rounded-full bg-primary/60" style={{ width: `${6 + i * 4}px`, height: `${6 + i * 4}px` }} />
            <span>{(n / 1000)?.toFixed(0)}K</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimezoneMap;
