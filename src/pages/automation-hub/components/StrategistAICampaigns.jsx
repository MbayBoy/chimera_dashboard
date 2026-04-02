import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const aiCampaigns = [
  {
    id: 'ai-001',
    name: 'Platinum Win-Back: High LTV Churn Prevention',
    generatedAt: '2026-02-25T19:00:00Z',
    status: 'pending_approval',
    targetAudience: {
      segment: 'Platinum tier contacts with churn probability > 40%',
      size: 1240,
      avgLTV: '$1,850',
      avgEngagement: 62,
    },
    strategicReasoning: 'Analysis of 90-day engagement data reveals 1,240 Platinum contacts showing a 28% decline in open rates. Historical data shows win-back campaigns sent within 45 days of engagement drop recover 34% of at-risk contacts. The predicted revenue at risk is $2.3M in LTV. Deploying a personalized re-engagement sequence with exclusive offers is projected to recover $782K in LTV.',
    contentStrategy: 'Personalized video testimonial email with exclusive "Platinum Loyalty" offer. Subject line A/B test: "We miss you" vs "Your exclusive offer expires soon". Send time optimized per contact timezone.',
    predictedConversionRate: 34.2,
    predictedROI: 340,
    riskAssessment: { level: 'low', score: 18, notes: 'Platinum list — high deliverability, low complaint risk. Personalized content reduces unsubscribe probability.' },
    estimatedRevenue: 782000,
    executionStatus: null,
    approvedBy: null,
  },
  {
    id: 'ai-002',
    name: 'Spring Product Launch — Gold Tier Upsell',
    generatedAt: '2026-02-25T17:30:00Z',
    status: 'approved',
    targetAudience: {
      segment: 'Gold tier contacts who clicked Product X in last 60 days',
      size: 4820,
      avgLTV: '$420',
      avgEngagement: 81,
    },
    strategicReasoning: 'Market intelligence shows competitors are running discount-heavy campaigns. Differentiation opportunity: deploy a value-focused campaign highlighting product benefits over price. Gold tier contacts who previously engaged with Product X have a 3.2x higher conversion probability than cold audiences. Optimal send window: Tuesday-Thursday 10-11 AM local time.',
    contentStrategy: 'Multi-step email sequence (3 emails over 7 days). Email 1: Product value story. Email 2: Customer testimonial. Email 3: Limited-time upgrade offer. Dynamic content blocks based on previous purchase history.',
    predictedConversionRate: 12.8,
    predictedROI: 520,
    riskAssessment: { level: 'low', score: 22, notes: 'Gold list with recent engagement. Content is value-focused, low spam risk. Canary test recommended before full deployment.' },
    estimatedRevenue: 260000,
    executionStatus: 'deploying',
    approvedBy: 'Admin',
    approvedAt: '2026-02-25T18:00:00Z',
  },
  {
    id: 'ai-003',
    name: 'Lead Nurture Sequence — February Leads',
    generatedAt: '2026-02-25T14:00:00Z',
    status: 'pending_approval',
    targetAudience: {
      segment: 'Lead tier contacts uploaded in February 2026',
      size: 23450,
      avgLTV: '$12',
      avgEngagement: 0,
    },
    strategicReasoning: 'February leads have zero engagement history. Standard practice: deploy a 5-email welcome/nurture sequence to establish baseline engagement and identify high-potential contacts for tier promotion. Expected outcome: 8-12% will convert to Bronze tier within 30 days, 2-3% to Silver. This pipeline is critical for long-term LTV growth.',
    contentStrategy: 'Welcome sequence: Email 1 (Day 0): Brand introduction. Email 2 (Day 3): Value proposition. Email 3 (Day 7): Social proof/testimonials. Email 4 (Day 14): Product showcase. Email 5 (Day 21): Exclusive new subscriber offer.',
    predictedConversionRate: 8.5,
    predictedROI: 180,
    riskAssessment: { level: 'medium', score: 45, notes: 'Unverified lead list — recommend running List Cleaner before deployment. High volume increases complaint risk if list quality is low. Canary test on 1% sample mandatory.' },
    estimatedRevenue: 47000,
    executionStatus: null,
    approvedBy: null,
  },
  {
    id: 'ai-004',
    name: 'Re-engagement: 90-Day Inactive Contacts',
    generatedAt: '2026-02-24T22:00:00Z',
    status: 'rejected',
    targetAudience: {
      segment: 'All contacts with no activity in 90+ days',
      size: 8900,
      avgLTV: '$45',
      avgEngagement: 8,
    },
    strategicReasoning: 'Contacts inactive for 90+ days represent a significant churn risk. A targeted re-engagement campaign with a compelling incentive can recover 15-20% before they become permanent churners. Cost of inaction: estimated $400K in lost LTV over 12 months.',
    contentStrategy: 'Single high-impact email: "Are you still there?" with a 30% discount offer and clear unsubscribe option to clean the list.',
    predictedConversionRate: 15.0,
    predictedROI: 210,
    riskAssessment: { level: 'high', score: 68, notes: 'Highly inactive list — elevated complaint and bounce risk. Recommend Sanitizer server assignment. Strict suppression list required.' },
    estimatedRevenue: 60000,
    executionStatus: null,
    approvedBy: 'Admin',
    rejectedAt: '2026-02-24T23:00:00Z',
    rejectionReason: 'Risk score too high. Requires list verification before re-submission.',
  },
];

const StrategistAICampaigns = () => {
  const [campaigns, setCampaigns] = useState(aiCampaigns);
  const [expandedCampaign, setExpandedCampaign] = useState('ai-001');
  const [modifyingId, setModifyingId] = useState(null);
  const [modifyNote, setModifyNote] = useState('');

  const handleApprove = (id) => {
    setCampaigns(prev => prev?.map(c => c?.id === id
      ? { ...c, status: 'approved', executionStatus: 'deploying', approvedBy: 'Admin', approvedAt: new Date()?.toISOString() }
      : c
    ));
  };

  const handleReject = (id) => {
    setCampaigns(prev => prev?.map(c => c?.id === id
      ? { ...c, status: 'rejected', rejectedAt: new Date()?.toISOString() }
      : c
    ));
  };

  const handleModify = (id) => {
    if (modifyingId === id) {
      setCampaigns(prev => prev?.map(c => c?.id === id
        ? { ...c, strategicReasoning: c?.strategicReasoning + (modifyNote ? ` [Modified: ${modifyNote}]` : '') }
        : c
      ));
      setModifyingId(null);
      setModifyNote('');
    } else {
      setModifyingId(id);
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending_approval': return { color: 'text-warning', bg: 'bg-warning/10 border-warning/30', label: 'Pending Approval' };
      case 'approved': return { color: 'text-success', bg: 'bg-success/10 border-success/30', label: 'Approved' };
      case 'rejected': return { color: 'text-error', bg: 'bg-error/10 border-error/30', label: 'Rejected' };
      default: return { color: 'text-muted-foreground', bg: 'bg-muted border-border', label: status };
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'low': return 'text-success bg-success/10 border-success/30';
      case 'medium': return 'text-warning bg-warning/10 border-warning/30';
      case 'high': return 'text-error bg-error/10 border-error/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold text-foreground">Strategist AI Campaigns</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {campaigns?.filter(c => c?.status === 'pending_approval')?.length} awaiting approval · {campaigns?.filter(c => c?.status === 'approved')?.length} approved
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
          <Icon name="Brain" size={14} className="text-primary" />
          <span className="text-xs text-primary font-medium">Strategist AI Active</span>
        </div>
      </div>
      {campaigns?.map(campaign => {
        const isExpanded = expandedCampaign === campaign?.id;
        const statusConfig = getStatusConfig(campaign?.status);

        return (
          <div key={campaign?.id} className="bg-card rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setExpandedCampaign(isExpanded ? null : campaign?.id)}
              className="w-full p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon name="Brain" size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-foreground text-sm">{campaign?.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusConfig?.bg} ${statusConfig?.color}`}>
                    {statusConfig?.label}
                  </span>
                  {campaign?.executionStatus === 'deploying' && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Icon name="Loader" size={12} className="animate-spin" />
                      Deploying...
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: {campaign?.targetAudience?.segment} · {campaign?.targetAudience?.size?.toLocaleString()} contacts
                </div>
              </div>
              <div className="text-right flex-shrink-0 hidden md:block">
                <div className="text-sm font-semibold text-success">{campaign?.predictedConversionRate}% conv.</div>
                <div className="text-xs text-muted-foreground">ROI: {campaign?.predictedROI}%</div>
                <div className="text-xs text-success">${(campaign?.estimatedRevenue / 1000)?.toFixed(0)}K est.</div>
              </div>
              <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
            </button>
            {isExpanded && (
              <div className="border-t border-border p-5 space-y-5">
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Audience Size</div>
                    <div className="text-lg font-bold text-foreground">{campaign?.targetAudience?.size?.toLocaleString()}</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Avg LTV</div>
                    <div className="text-lg font-bold text-success">{campaign?.targetAudience?.avgLTV}</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Predicted Conv.</div>
                    <div className="text-lg font-bold text-primary">{campaign?.predictedConversionRate}%</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Est. Revenue</div>
                    <div className="text-lg font-bold text-success">${(campaign?.estimatedRevenue / 1000)?.toFixed(0)}K</div>
                  </div>
                </div>

                {/* Strategic Reasoning */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Lightbulb" size={14} className="text-warning" />
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Strategic Reasoning</h4>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed bg-muted rounded-lg p-3">{campaign?.strategicReasoning}</p>
                </div>

                {/* Content Strategy */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="FileText" size={14} className="text-primary" />
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content Strategy</h4>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed bg-muted rounded-lg p-3">{campaign?.contentStrategy}</p>
                </div>

                {/* Risk Assessment */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div className={`text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0 ${getRiskColor(campaign?.riskAssessment?.level)}`}>
                    Risk: {campaign?.riskAssessment?.level?.toUpperCase()} ({campaign?.riskAssessment?.score}/100)
                  </div>
                  <p className="text-xs text-muted-foreground">{campaign?.riskAssessment?.notes}</p>
                </div>

                {/* Rejection Reason */}
                {campaign?.status === 'rejected' && campaign?.rejectionReason && (
                  <div className="flex items-start gap-2 p-3 bg-error/10 rounded-lg border border-error/20">
                    <Icon name="XCircle" size={14} className="text-error flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-error"><strong>Rejection Reason:</strong> {campaign?.rejectionReason}</p>
                  </div>
                )}

                {/* Modify Input */}
                {modifyingId === campaign?.id && (
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <label className="text-xs text-muted-foreground mb-2 block">Modification Notes</label>
                    <textarea
                      value={modifyNote}
                      onChange={e => setModifyNote(e?.target?.value)}
                      placeholder="Describe the modifications needed..."
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none"
                      rows={3}
                    />
                  </div>
                )}

                {/* Approval Workflow */}
                {campaign?.status === 'pending_approval' && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <Button
                      variant="primary"
                      size="sm"
                      iconName="CheckCircle"
                      iconPosition="left"
                      onClick={() => handleApprove(campaign?.id)}
                    >
                      Approve & Deploy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      iconName="Edit"
                      iconPosition="left"
                      onClick={() => handleModify(campaign?.id)}
                    >
                      {modifyingId === campaign?.id ? 'Submit Modification' : 'Modify'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="XCircle"
                      iconPosition="left"
                      onClick={() => handleReject(campaign?.id)}
                      className="text-error hover:text-error"
                    >
                      Reject
                    </Button>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Generated {new Date(campaign.generatedAt)?.toLocaleString()}
                    </span>
                  </div>
                )}

                {campaign?.status === 'approved' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Icon name="CheckCircle" size={14} className="text-success" />
                    <span className="text-xs text-success">Approved by {campaign?.approvedBy} · {new Date(campaign.approvedAt)?.toLocaleString()}</span>
                    {campaign?.executionStatus === 'deploying' && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-primary">
                        <Icon name="Loader" size={12} className="animate-spin" />
                        Deploying campaign...
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StrategistAICampaigns;
