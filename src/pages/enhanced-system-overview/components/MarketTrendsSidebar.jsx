import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const MarketTrendsSidebar = () => {
  const [activeView, setActiveView] = useState('competitors');

  const competitors = [
    {
      name: 'Competitor A',
      email: 'newsletter@competitora.com',
      sendFrequency: '3x/week',
      lastSeen: '2 days ago',
      dominantTheme: 'Discount/Promotional',
      subjectTrends: ['% OFF', 'Limited Time', 'Exclusive Deal'],
      contentType: 'Promotional',
      avgSubjectLength: 42,
      recommendation: 'Differentiate with educational content — they are over-promoting.'
    },
    {
      name: 'Competitor B',
      email: 'updates@competitorb.io',
      sendFrequency: '1x/week',
      lastSeen: '5 days ago',
      dominantTheme: 'Product Updates',
      subjectTrends: ['New Feature', 'Update', 'Changelog'],
      contentType: 'Informational',
      avgSubjectLength: 38,
      recommendation: 'They focus on product — consider customer success stories to stand out.'
    },
    {
      name: 'Competitor C',
      email: 'hello@competitorc.co',
      sendFrequency: '5x/week',
      lastSeen: '1 day ago',
      dominantTheme: 'Mixed',
      subjectTrends: ['Tips', 'How to', 'Guide'],
      contentType: 'Educational',
      avgSubjectLength: 55,
      recommendation: 'High frequency educational content — consider video email to differentiate.'
    }
  ];

  const industryTrends = [
    { trend: 'Personalized video content in emails', growth: '+50%', quarter: 'Q1 2026', impact: 'HIGH', action: 'Consider adding video thumbnails with play buttons in next campaign' },
    { trend: 'Interactive AMP emails', growth: '+32%', quarter: 'Q1 2026', impact: 'MEDIUM', action: 'Test AMP carousels for product showcase campaigns' },
    { trend: 'AI-generated subject lines', growth: '+78%', quarter: 'Q1 2026', impact: 'HIGH', action: 'Already implemented via A/B Engine — maintain advantage' },
    { trend: 'Dark mode optimized templates', growth: '+45%', quarter: 'Q1 2026', impact: 'MEDIUM', action: 'Audit current templates for dark mode compatibility' },
    { trend: 'Hyper-personalization beyond first name', growth: '+61%', quarter: 'Q1 2026', impact: 'HIGH', action: 'Deploy Dynamic Content Personalization Engine for next campaign' }
  ];

  const strategistRecommendations = [
    {
      id: 1,
      goal: 'Increase Product X Sales by 10%',
      audience: '5,000 Platinum contacts who clicked Product X but did not purchase',
      strategy: 'Customer testimonial video email (competitors not using video)',
      abPlan: '5 subject line variants, 10% test segment',
      sendTime: 'Tuesday 9:00 AM EST (STO-optimized)',
      confidence: 87,
      status: 'Awaiting Approval'
    }
  ];

  const views = [
    { id: 'competitors', label: 'Competitor Intel', icon: 'Eye' },
    { id: 'trends', label: 'Industry Trends', icon: 'TrendingUp' },
    { id: 'strategist', label: 'The Strategist', icon: 'Lightbulb' }
  ];

  const getImpactColor = (impact) => {
    if (impact === 'HIGH') return 'bg-red-500/10 text-red-400';
    if (impact === 'MEDIUM') return 'bg-yellow-500/10 text-yellow-400';
    return 'bg-green-500/10 text-green-400';
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
            <Icon name="Globe" size={20} className="text-primary" />
            Market Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Competitor monitoring, industry trends & strategic recommendations</p>
        </div>

        <div className="flex items-center gap-1 p-4 border-b border-border">
          {views?.map(v => (
            <button
              key={v?.id}
              onClick={() => setActiveView(v?.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === v?.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon name={v?.icon} size={14} />
              {v?.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeView === 'competitors' && (
            <div className="space-y-4">
              {competitors?.map((comp, i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{comp?.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{comp?.email}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">{comp?.sendFrequency}</div>
                      <div className="text-xs text-muted-foreground">Last seen: {comp?.lastSeen}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-muted/50 rounded p-2">
                      <div className="text-xs text-muted-foreground">Content Type</div>
                      <div className="text-sm font-medium text-foreground">{comp?.contentType}</div>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <div className="text-xs text-muted-foreground">Avg Subject Length</div>
                      <div className="text-sm font-medium text-foreground">{comp?.avgSubjectLength} chars</div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground mb-1">Common Subject Keywords</div>
                    <div className="flex flex-wrap gap-1">
                      {comp?.subjectTrends?.map((kw, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-green-500/5 border border-green-500/20 rounded">
                    <Icon name="Lightbulb" size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-green-400">{comp?.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'trends' && (
            <div className="space-y-3">
              {industryTrends?.map((trend, i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-sm font-medium text-foreground">{trend?.trend}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-green-400">{trend?.growth}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${getImpactColor(trend?.impact)}`}>{trend?.impact}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{trend?.quarter}</p>
                  <div className="flex items-start gap-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded">
                    <Icon name="ArrowRight" size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-400">{trend?.action}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'strategist' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <Icon name="Brain" size={16} className="text-purple-400 flex-shrink-0" />
                <p className="text-sm text-purple-400">The Strategist analyzes your contacts, market intel, and A/B data to create zero-click campaigns. Define a goal and the AI handles the rest.</p>
              </div>
              {strategistRecommendations?.map((rec, i) => (
                <div key={i} className="border border-primary/30 bg-primary/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-foreground">AI-Generated Campaign Proposal</h3>
                    <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded font-medium">{rec?.status}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Icon name="Target" size={14} className="text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Goal</div>
                        <div className="text-sm text-foreground">{rec?.goal}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Icon name="Users" size={14} className="text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Target Audience</div>
                        <div className="text-sm text-foreground">{rec?.audience}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Icon name="Lightbulb" size={14} className="text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Content Strategy</div>
                        <div className="text-sm text-foreground">{rec?.strategy}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Icon name="Clock" size={14} className="text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Optimal Send Time</div>
                        <div className="text-sm text-foreground">{rec?.sendTime}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1">AI Confidence Score</div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${rec?.confidence}%` }} />
                        </div>
                      </div>
                      <span className="text-lg font-bold text-green-400">{rec?.confidence}%</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                      Approve & Deploy
                    </button>
                    <button className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
                      Modify
                    </button>
                  </div>
                </div>
              ))}
              <div className="border border-dashed border-border rounded-lg p-6 text-center">
                <Icon name="Plus" size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Define a new business goal for The Strategist</p>
                <input
                  type="text"
                  placeholder="e.g. Increase sales of Product X by 10% this month"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground mb-3 focus:outline-none focus:border-primary"
                />
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Generate Campaign Strategy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketTrendsSidebar;
