const BudgetGauge = ({ budget = 0, actual = 0 }) => {
  const percentage = budget > 0 ? Math.min(150, (actual / budget) * 100) : 0;
  const displayPct = budget > 0 ? ((actual / budget) * 100)?.toFixed(1) : '0.0';

  const getColor = () => {
    if (percentage <= 80) return { stroke: '#10b981', text: 'text-emerald-400', label: 'Under Budget', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (percentage <= 100) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'Near Budget', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { stroke: '#f43f5e', text: 'text-rose-400', label: 'Over Budget', bg: 'bg-rose-500/10 border-rose-500/30' };
  };

  const colors = getColor();

  // SVG arc calculation
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const dashOffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">Budget vs Actual</h3>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: 200, height: 110 }}>
          <svg width="200" height="110" viewBox="0 0 200 110">
            {/* Background arc */}
            <path
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke="#1e293b"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Value arc */}
            <path
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke={colors?.stroke}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${dashOffset}`}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className={`text-2xl font-bold ${colors?.text}`}>{displayPct}%</span>
            <span className="text-xs text-muted-foreground">of budget used</span>
          </div>
        </div>

        <div className={`mt-3 px-3 py-1.5 rounded-full border text-xs font-medium ${colors?.bg} ${colors?.text}`}>
          {colors?.label}
        </div>

        <div className="mt-4 w-full grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="text-lg font-bold text-foreground">${budget?.toLocaleString()}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className={`text-lg font-bold ${colors?.text}`}>${actual?.toLocaleString()}</p>
          </div>
        </div>

        {percentage > 110 && (
          <div className="mt-3 w-full bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 text-center">
            <p className="text-xs text-rose-400 font-medium">⚠ Spending exceeds budget by {(percentage - 100)?.toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetGauge;
