import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Link } from 'react-router-dom';

const insights = [
  {
    id: 1,
    priority: 'critical',
    title: 'Content Gap: Video Testimonials',
    category: 'Content Strategy',
    description: 'None of your tracked competitors are using video testimonials. Industry data shows 3.2x higher conversion rates for video content. This is a significant untapped opportunity.',
    evidence: ['CompetitorAlpha: 0 video campaigns in 30 days', 'CompetitorBeta: 0 video campaigns in 30 days', 'Industry avg open rate for video emails: 38% vs 24% standard'],
    recommendation: 'Launch a video testimonial campaign targeting Platinum tier contacts. Use the Zero-Click AI to auto-generate the campaign.',
    potentialLift: '+14% open rate',
    effort: 'Medium',
    zeroClickReady: true,
  },
  {
    id: 2,
    priority: 'high',
    title: 'Timing Opportunity: 6-8 PM Slot',
    category: 'Send Time Optimization',
    description: 'Analysis of competitor send patterns shows a gap in the 6-8 PM EST window. Your STO data shows 23% of your Platinum contacts are most active during this time.',
    evidence: ['CompetitorAlpha sends at 9 AM EST', 'CompetitorBeta sends at 10:30 AM EST', 'CompetitorGamma sends at 8 AM PST', 'Your Platinum contacts: 23% peak activity 6-8 PM'],
    recommendation: 'Enable STO for your next Platinum campaign to automatically target the 6-8 PM window for high-engagement contacts.',
    potentialLift: '+8% open rate',
    effort: 'Low',
    zeroClickReady: false,
  },
  {
    id: 3,
    priority: 'medium',
    title: 'Differentiation: Informational Content',
    category: 'Market Positioning',
    description: 'Competitors are heavily discount-focused (avg 68% of campaigns). Informational/educational content is underserved. Contacts experiencing discount fatigue will respond better to value-based content.',
    evidence: ['CompetitorAlpha: 80% promotional content', 'CompetitorGamma: 70% promotional content', 'Industry: Informational emails have 15% lower unsubscribe rate'],
    recommendation: 'Create a "Top 5 Tips" informational series to differentiate from competitors\' promotional noise.',
    potentialLift: '-15% unsubscribe rate',
    effort: 'Low',
    zeroClickReady: true,
  },
];

const priorityConfig = {
  critical: { color: 'border-error/30 bg-error/5', badge: 'bg-error/10 text-error', icon: 'AlertCircle' },
  high: { color: 'border-warning/30 bg-warning/5', badge: 'bg-warning/10 text-warning', icon: 'AlertTriangle' },
  medium: { color: 'border-primary/30 bg-primary/5', badge: 'bg-primary/10 text-primary', icon: 'Info' },
};

const StrategicInsights = () => {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">AI-generated insights based on competitor analysis and market trends</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="Brain" size={14} className="text-primary" />
          <span>Powered by Chimera AI</span>
        </div>
      </div>
      {insights?.map(insight => {
        const config = priorityConfig?.[insight?.priority];
        const isExpanded = expanded === insight?.id;
        return (
          <div key={insight?.id} className={`border rounded-xl overflow-hidden ${config?.color}`}>
            <button
              className="w-full p-5 text-left"
              onClick={() => setExpanded(isExpanded ? null : insight?.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Icon name={config?.icon} size={18} className={`mt-0.5 flex-shrink-0 ${config?.badge?.split(' ')?.[1]}`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{insight?.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config?.badge}`}>
                        {insight?.priority?.toUpperCase()}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {insight?.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{insight?.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-success">{insight?.potentialLift}</div>
                    <div className="text-xs text-muted-foreground">Potential Lift</div>
                  </div>
                  <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-border/50">
                <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Supporting Evidence</h4>
                    <ul className="space-y-2">
                      {insight?.evidence?.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Icon name="CheckCircle" size={14} className="text-success mt-0.5 flex-shrink-0" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Recommended Action</h4>
                    <p className="text-sm text-foreground mb-4">{insight?.recommendation}</p>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground">Effort: <span className="text-foreground font-medium">{insight?.effort}</span></div>
                      {insight?.zeroClickReady && (
                        <Link to="/zero-click-campaign">
                          <Button variant="default" size="sm" iconName="Zap" iconPosition="left">
                            Launch with Zero-Click AI
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StrategicInsights;
