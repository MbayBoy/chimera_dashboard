import { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';

const LiveScoreGauge = ({ scoreData }) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (scoreData?.score) {
      const target = parseFloat(scoreData?.score);
      const duration = 1000;
      const steps = 60;
      const increment = target / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setAnimatedScore(target);
          clearInterval(timer);
        } else {
          setAnimatedScore(current);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [scoreData?.score]);

  const getScoreColor = (score) => {
    if (score >= 8) return { color: 'text-success', bg: 'bg-success', ring: 'ring-success' };
    if (score >= 5) return { color: 'text-warning', bg: 'bg-warning', ring: 'ring-warning' };
    return { color: 'text-error', bg: 'bg-error', ring: 'ring-error' };
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  const score = parseFloat(scoreData?.score || 0);
  const colors = getScoreColor(score);
  const percentage = (animatedScore / 10) * 100;
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-card rounded-lg border border-border p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
            Content Score
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time deliverability analysis
          </p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${colors?.bg}/10 flex items-center justify-center`}>
          <Icon name="Gauge" size={20} className={colors?.color} />
        </div>
      </div>
      <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-8">
        <div className="relative w-48 h-48 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-muted"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`${colors?.color} transition-all duration-1000 ease-out`}
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-4xl md:text-5xl font-heading font-bold ${colors?.color}`}>
              {animatedScore?.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">out of 10</div>
            <div className={`text-xs font-medium mt-2 px-3 py-1 rounded-full ${colors?.bg}/10 ${colors?.color}`}>
              {getScoreLabel(score)}
            </div>
          </div>
        </div>

        <div className="flex-1 w-full space-y-4">
          {scoreData?.details && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="Info" size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground mb-1">
                    SpamAssassin Analysis
                  </div>
                  <div className="text-sm text-muted-foreground break-words">
                    {scoreData?.details}
                  </div>
                </div>
              </div>
            </div>
          )}

          {scoreData?.triggers && scoreData?.triggers?.length > 0 && (
            <div>
              <div className="text-xs font-caption font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Detected Triggers
              </div>
              <div className="flex flex-wrap gap-2">
                {scoreData?.triggers?.map((trigger, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-lg text-xs font-mono text-foreground"
                  >
                    <Icon name="AlertCircle" size={12} className="text-muted-foreground" />
                    {trigger}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Spam Risk</div>
              <div className={`text-lg font-heading font-semibold ${colors?.color}`}>
                {score >= 8 ? 'Low' : score >= 5 ? 'Medium' : 'High'}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Inbox Rate</div>
              <div className="text-lg font-heading font-semibold text-foreground">
                {(score * 10)?.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveScoreGauge;