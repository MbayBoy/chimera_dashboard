import { useState } from 'react';
import Icon from '../../../components/AppIcon';


const competitors = [
  {
    id: 1, name: 'CompetitorAlpha', domain: 'alpha-mail.com', industry: 'SaaS',
    campaignsLastWeek: 5, avgFrequency: 'Daily', primaryTheme: 'Discount/Promotional',
    subjectTrend: 'Urgency-based ("Last chance", "Expires today")',
    contentTypes: ['Promotional', 'Flash Sale', 'Discount'],
    engagementEst: 'High', sendTime: '9:00 AM EST',
    keywords: ['exclusive', 'limited time', 'save', 'deal', 'off'],
    sentiment: 'Aggressive',
    recentSubjects: [
      'Last Chance: 40% Off Ends Tonight!',
      'Your Exclusive Deal Expires in 3 Hours',
      'Flash Sale: Save Big on Everything',
    ],
  },
  {
    id: 2, name: 'CompetitorBeta', domain: 'beta-solutions.io', industry: 'SaaS',
    campaignsLastWeek: 2, avgFrequency: '2x/week', primaryTheme: 'Educational/Value',
    subjectTrend: 'Question-based ("Did you know?", "How to...")',
    contentTypes: ['Newsletter', 'Tips', 'Case Study'],
    engagementEst: 'Medium', sendTime: '10:30 AM EST',
    keywords: ['tips', 'guide', 'how to', 'learn', 'improve'],
    sentiment: 'Informational',
    recentSubjects: [
      'How to 10x Your Email Open Rates',
      '5 Tips for Better Deliverability',
      'Case Study: How We Grew 200%',
    ],
  },
  {
    id: 3, name: 'CompetitorGamma', domain: 'gamma-tech.com', industry: 'E-commerce',
    campaignsLastWeek: 7, avgFrequency: 'Daily+', primaryTheme: 'Product Launch',
    subjectTrend: 'Personalized ("[Name], your...")',
    contentTypes: ['Product Launch', 'Announcement', 'Testimonial'],
    engagementEst: 'Very High', sendTime: '8:00 AM PST',
    keywords: ['new', 'launch', 'introducing', 'exclusive', 'first'],
    sentiment: 'Exciting',
    recentSubjects: [
      'Introducing Our Most Powerful Feature Yet',
      '[Name], You\'re Getting Early Access',
      'New: The Tool That Changes Everything',
    ],
  },
];

const sentimentColor = { Aggressive: 'text-error', Informational: 'text-primary', Exciting: 'text-success' };
const freqColor = { 'Daily+': 'bg-error/10 text-error', 'Daily': 'bg-warning/10 text-warning', '2x/week': 'bg-success/10 text-success' };

const CompetitorGrid = () => {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {competitors?.map(comp => (
          <div
            key={comp?.id}
            className={`bg-card border rounded-xl p-5 cursor-pointer transition-colors ${
              selected?.id === comp?.id ? 'border-primary' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setSelected(selected?.id === comp?.id ? null : comp)}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">{comp?.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{comp?.domain}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                freqColor?.[comp?.avgFrequency] || 'bg-muted text-muted-foreground'
              }`}>
                {comp?.avgFrequency}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted rounded-lg p-3">
                <div className="text-2xl font-mono font-bold text-foreground">{comp?.campaignsLastWeek}</div>
                <div className="text-xs text-muted-foreground">Campaigns/Week</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className={`text-sm font-bold ${sentimentColor?.[comp?.sentiment] || 'text-foreground'}`}>
                  {comp?.sentiment}
                </div>
                <div className="text-xs text-muted-foreground">Tone</div>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Primary Theme</p>
              <p className="text-sm text-foreground font-medium">{comp?.primaryTheme}</p>
            </div>

            <div className="flex flex-wrap gap-1">
              {comp?.keywords?.slice(0, 4)?.map(kw => (
                <span key={kw} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Detail Panel */}
      {selected && (
        <div className="bg-card border border-primary/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground text-lg">{selected?.name} — Detailed Analysis</h3>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded">
              <Icon name="X" size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Recent Subject Lines</h4>
              <div className="space-y-2">
                {selected?.recentSubjects?.map((subj, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                    <Icon name="Mail" size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{subj}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Campaign Intelligence</h4>
              <div className="space-y-3">
                {[
                  { label: 'Send Time', value: selected?.sendTime, icon: 'Clock' },
                  { label: 'Content Types', value: selected?.contentTypes?.join(', '), icon: 'FileText' },
                  { label: 'Subject Trend', value: selected?.subjectTrend, icon: 'TrendingUp' },
                  { label: 'Est. Engagement', value: selected?.engagementEst, icon: 'BarChart2' },
                ]?.map(item => (
                  <div key={item?.label} className="flex items-start gap-3">
                    <Icon name={item?.icon} size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground">{item?.label}: </span>
                      <span className="text-sm text-foreground">{item?.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitorGrid;
