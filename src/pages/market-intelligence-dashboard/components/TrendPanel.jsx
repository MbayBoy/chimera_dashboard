import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const trendData = [
  { week: 'W1', videoEmails: 12, personalizedContent: 45, discountCampaigns: 78, interactiveEmails: 8 },
  { week: 'W2', videoEmails: 18, personalizedContent: 52, discountCampaigns: 72, interactiveEmails: 12 },
  { week: 'W3', videoEmails: 25, personalizedContent: 58, discountCampaigns: 68, interactiveEmails: 15 },
  { week: 'W4', videoEmails: 34, personalizedContent: 65, discountCampaigns: 61, interactiveEmails: 22 },
  { week: 'W5', videoEmails: 42, personalizedContent: 71, discountCampaigns: 55, interactiveEmails: 28 },
  { week: 'W6', videoEmails: 51, personalizedContent: 78, discountCampaigns: 50, interactiveEmails: 35 },
];

const alerts = [
  { id: 1, severity: 'high', title: 'Video Email Adoption Surging', desc: 'Personalized video content in emails up 50% this quarter. Competitors not using video are losing engagement.', impact: 'High', action: 'Consider adding video testimonials to next campaign' },
  { id: 2, severity: 'medium', title: 'Discount Fatigue Detected', desc: 'Discount-focused campaigns showing declining open rates across industry. Informational content outperforming.', impact: 'Medium', action: 'Shift to value-based content strategy' },
  { id: 3, severity: 'low', title: 'Interactive Email Elements Growing', desc: 'AMP emails with polls, carousels, and forms seeing 3x higher engagement than static emails.', impact: 'Low', action: 'Test interactive elements in next A/B test' },
];

const TrendPanel = () => {
  const [selectedTrend, setSelectedTrend] = useState('all');

  const severityColor = { high: 'text-error bg-error/10 border-error/30', medium: 'text-warning bg-warning/10 border-warning/30', low: 'text-primary bg-primary/10 border-primary/30' };

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Industry Email Trends (6 Weeks)</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="TrendingUp" size={14} className="text-success" />
            <span>NLP-extracted from 247 campaigns</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Line type="monotone" dataKey="videoEmails" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Video Emails" />
            <Line type="monotone" dataKey="personalizedContent" stroke="#10b981" strokeWidth={2} dot={false} name="Personalized" />
            <Line type="monotone" dataKey="discountCampaigns" stroke="#f59e0b" strokeWidth={2} dot={false} name="Discount" />
            <Line type="monotone" dataKey="interactiveEmails" stroke="#3b82f6" strokeWidth={2} dot={false} name="Interactive" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-3">
          {[
            { label: 'Video Emails', color: '#8b5cf6' },
            { label: 'Personalized', color: '#10b981' },
            { label: 'Discount', color: '#f59e0b' },
            { label: 'Interactive', color: '#3b82f6' },
          ]?.map(item => (
            <div key={item?.label} className="flex items-center gap-2">
              <div className="w-3 h-0.5" style={{ backgroundColor: item?.color }} />
              <span className="text-xs text-muted-foreground">{item?.label}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Trend Alerts */}
      <div>
        <h3 className="font-semibold text-foreground mb-4">Trend Alerts & Recommendations</h3>
        <div className="space-y-4">
          {alerts?.map(alert => (
            <div key={alert?.id} className={`border rounded-xl p-5 ${severityColor?.[alert?.severity]}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Icon name={alert?.severity === 'high' ? 'AlertCircle' : alert?.severity === 'medium' ? 'AlertTriangle' : 'Info'} size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground">{alert?.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{alert?.desc}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Icon name="Lightbulb" size={14} />
                      <span className="text-sm font-medium">{alert?.action}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-card border border-current flex-shrink-0">
                  {alert?.impact} Impact
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrendPanel;
