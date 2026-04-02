import Icon from '../../../components/AppIcon';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = Array.from({ length: 24 }, (_, i) => i);

// Generate realistic engagement data
const generateHeatmapData = () => {
  const data = {};
  days?.forEach((day, di) => {
    data[day] = {};
    hours?.forEach(h => {
      let base = 5;
      // Weekday morning/afternoon peaks
      if (di < 5) {
        if (h >= 8 && h <= 11) base = 25 + Math.random() * 30;
        else if (h >= 13 && h <= 16) base = 18 + Math.random() * 20;
        else if (h >= 18 && h <= 20) base = 12 + Math.random() * 15;
        else if (h < 6 || h > 22) base = 1 + Math.random() * 3;
        else base = 5 + Math.random() * 10;
      } else {
        // Weekend
        if (h >= 10 && h <= 14) base = 15 + Math.random() * 20;
        else if (h < 8 || h > 21) base = 1 + Math.random() * 3;
        else base = 5 + Math.random() * 12;
      }
      data[day][h] = Math.round(base);
    });
  });
  return data;
};

const heatmapData = generateHeatmapData();

const getColor = (value) => {
  if (value >= 45) return 'bg-purple-600';
  if (value >= 35) return 'bg-purple-500';
  if (value >= 25) return 'bg-indigo-500';
  if (value >= 18) return 'bg-blue-500';
  if (value >= 12) return 'bg-cyan-500';
  if (value >= 8) return 'bg-teal-600';
  if (value >= 4) return 'bg-slate-600';
  return 'bg-slate-800';
};

const getOpacity = (value) => {
  return Math.max(0.15, Math.min(1, value / 55));
};

const EngagementHeatmap = () => {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="Grid3X3" size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Engagement Heatmap</h2>
        <span className="ml-auto text-xs text-muted-foreground">Open rate intensity by hour × day</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Darker = higher engagement. Identify peak performance windows for scheduling.</p>
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Hour labels */}
          <div className="flex mb-1">
            <div className="w-10 flex-shrink-0" />
            {hours?.map(h => (
              <div key={h} className="flex-1 text-center text-xs text-muted-foreground" style={{ minWidth: '24px' }}>
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>

          {/* Heatmap rows */}
          {days?.map(day => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-10 flex-shrink-0 text-xs font-medium text-muted-foreground">{day}</div>
              {hours?.map(h => {
                const val = heatmapData?.[day]?.[h] || 0;
                return (
                  <div
                    key={h}
                    className={`flex-1 rounded-sm mx-px cursor-pointer hover:ring-1 hover:ring-primary transition-all group relative`}
                    style={{ minWidth: '22px', height: '28px', backgroundColor: `rgba(99,102,241,${getOpacity(val)})` }}
                    title={`${day} ${h}:00 — ${val}% engagement`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-lg">
                      {day} {h?.toString()?.padStart(2,'0')}:00 — <strong>{val}%</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Color scale legend */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Low</span>
        <div className="flex gap-0.5">
          {[0.15, 0.25, 0.38, 0.52, 0.65, 0.78, 0.9, 1.0]?.map((op, i) => (
            <div key={i} className="w-6 h-3 rounded-sm" style={{ backgroundColor: `rgba(99,102,241,${op})` }} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">High</span>
        <span className="ml-4 text-xs text-muted-foreground">Hover cells for exact values</span>
      </div>
    </div>
  );
};

export default EngagementHeatmap;
