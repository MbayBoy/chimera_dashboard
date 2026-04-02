import Icon from '../../../components/AppIcon';

const ThreatAssessmentMatrix = ({ riskLevels }) => {
  const getRiskColor = (level) => {
    if (level >= 70) return { bg: 'bg-red-500', text: 'text-red-400', label: 'Critical' };
    if (level >= 50) return { bg: 'bg-orange-500', text: 'text-orange-400', label: 'High' };
    if (level >= 30) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: 'Medium' };
    return { bg: 'bg-green-500', text: 'text-green-400', label: 'Low' };
  };

  const overallConfig = getRiskColor(riskLevels?.overall);

  const categories = [
    { key: 'production', label: 'Production Fleet', icon: 'Server' },
    { key: 'canary', label: 'Canary Servers', icon: 'TestTube' },
    { key: 'quarantine', label: 'Quarantine Zone', icon: 'ShieldAlert' },
    { key: 'sanitizer', label: 'Sanitizer Pool', icon: 'Trash2' }
  ];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl md:text-2xl font-heading font-semibold text-white">
            Threat Assessment
          </h2>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Icon name="Activity" size={20} className="text-red-400" />
          </div>
        </div>
        <p className="text-sm text-slate-400">
          System-wide risk analysis
        </p>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="bg-slate-950 rounded-lg p-6 border border-slate-800">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">
              Overall System Risk
            </div>
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-slate-800"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray={`${(riskLevels?.overall / 100) * 314} 314`}
                  strokeLinecap="round"
                  className={overallConfig?.text}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-3xl font-heading font-bold ${overallConfig?.text}`}>
                  {riskLevels?.overall}
                </div>
                <div className="text-xs text-slate-400">/ 100</div>
              </div>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${overallConfig?.bg}/20 ${overallConfig?.text} text-sm font-medium`}>
              <Icon name="AlertCircle" size={14} />
              {overallConfig?.label} Risk
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-caption font-medium text-slate-400 uppercase tracking-wide mb-3">
            Risk by Category
          </div>
          <div className="space-y-3">
            {categories?.map((category) => {
              const level = riskLevels?.[category?.key];
              const config = getRiskColor(level);
              
              return (
                <div key={category?.key} className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon name={category?.icon} size={16} className="text-slate-400" />
                      <span className="text-sm font-medium text-white">
                        {category?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-heading font-bold ${config?.text}`}>
                        {level}
                      </span>
                      <span className="text-xs text-slate-500">/ 100</span>
                    </div>
                  </div>
                  
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`${config?.bg} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${level}%` }}
                    />
                  </div>
                  
                  <div className="mt-2 text-xs text-slate-400">
                    {config?.label} Risk Level
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="Info" size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-blue-400 mb-1">
                Risk Assessment Info
              </div>
              <div className="text-xs text-slate-400">
                Risk scores are calculated based on reputation, blacklist status, bounce rates, and recent policy blocks. Scores update every 5 minutes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatAssessmentMatrix;