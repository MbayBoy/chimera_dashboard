import { useState } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { Link } from 'react-router-dom';

const ZeroClickCampaign = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [goal, setGoal] = useState('');
  const [product, setProduct] = useState('');
  const [targetLift, setTargetLift] = useState('10');
  const [timeframe, setTimeframe] = useState('30');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [proposal, setProposal] = useState(null);
  const [approved, setApproved] = useState(false);

  const analysisSteps = [
    'Analyzing contact database for best audience...',
    'Querying Market Intelligence for content strategy...',
    'Generating 5 subject line variants for A/B testing...',
    'Calculating optimal send times via STO...',
    'Assembling campaign proposal...',
  ];

  const handleAnalyze = async () => {
    if (!goal || !product) return;
    setAnalyzing(true);
    setAnalysisStep(0);
    setProposal(null);
    for (let i = 0; i < analysisSteps?.length; i++) {
      await new Promise(r => setTimeout(r, 900));
      setAnalysisStep(i + 1);
    }
    setProposal({
      audience: {
        size: 5240,
        tier: 'Platinum + Gold',
        avgLTV: '$847',
        avgEngagement: 88.4,
        filter: `Contacts who clicked on ${product} but did not purchase, Tier >= Gold`,
      },
      contentStrategy: {
        type: 'Video Testimonial',
        reasoning: 'Market Intel shows 0 competitors using video. Industry data: 3.2x higher conversion.',
        contentBlocks: [
          { name: 'Hero Video', rule: 'All recipients', version: 'Customer testimonial video' },
          { name: 'Product CTA', rule: 'Tier = Platinum', version: 'Exclusive early access offer' },
          { name: 'Product CTA', rule: 'Tier = Gold', version: 'Standard product page link' },
        ],
      },
      subjectVariants: [
        'See Why 10,000 Customers Love [Product]',
        '[Name], This Changed Everything for Our Customers',
        'Real Results: How [Product] Delivered 200% ROI',
        'Watch: The [Product] Story You Need to See',
        'Your Peers Are Getting Results — Here\'s How',
      ],
      sendSchedule: {
        method: 'STO (Individual Optimal Times)',
        window: '6:00 AM – 9:00 PM (contact local time)',
        estimatedDelivery: '48 hours (staggered)',
      },
      projections: {
        expectedOpenRate: '38%',
        expectedClickRate: '12%',
        expectedConversions: '628',
        estimatedRevenue: `$${(628 * 127)?.toLocaleString()}`,
        probabilityOfGoal: '73%',
      },
    });
    setAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8 max-w-5xl">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Icon name="Zap" size={22} className="text-yellow-400" />
              </div>
              <div>
                <h1 className="text-3xl font-heading font-semibold text-foreground">Zero-Click Campaign</h1>
                <p className="text-muted-foreground text-sm">The Strategist — AI creates, targets, and schedules campaigns from your business goal</p>
              </div>
            </div>
          </div>

          {/* Goal Input */}
          {!proposal && (
            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Define Your Business Goal</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Product / Service</label>
                  <input
                    type="text"
                    value={product}
                    onChange={e => setProduct(e?.target?.value)}
                    placeholder="e.g. Premium Subscription, Product X"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Target Lift</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={targetLift}
                      onChange={e => setTargetLift(e?.target?.value)}
                      className="w-24 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary font-mono"
                    />
                    <span className="text-sm text-muted-foreground">% increase in</span>
                    <input
                      type="number"
                      value={timeframe}
                      onChange={e => setTimeframe(e?.target?.value)}
                      className="w-20 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary font-mono"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Business Goal (optional detail)</label>
                <textarea
                  value={goal}
                  onChange={e => setGoal(e?.target?.value)}
                  placeholder={`e.g. Increase sales of ${product || 'Product X'} by ${targetLift}% this month by targeting high-value contacts who showed interest but didn't convert.`}
                  rows={3}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary resize-none"
                />
              </div>
              <Button
                variant="default"
                iconName="Brain"
                iconPosition="left"
                onClick={handleAnalyze}
                disabled={!product}
              >
                Analyze & Generate Campaign
              </Button>
            </div>
          )}

          {/* Analysis Progress */}
          {analyzing && (
            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon name="Brain" size={18} className="text-primary animate-pulse" />
                </div>
                <h2 className="font-semibold text-foreground">The Strategist is analyzing...</h2>
              </div>
              <div className="space-y-3">
                {analysisSteps?.map((step, i) => (
                  <div key={i} className={`flex items-center gap-3 transition-opacity ${
                    i < analysisStep ? 'opacity-100' : 'opacity-30'
                  }`}>
                    {i < analysisStep ? (
                      <Icon name="CheckCircle" size={16} className="text-success flex-shrink-0" />
                    ) : i === analysisStep ? (
                      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />
                    )}
                    <span className="text-sm text-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposal */}
          {proposal && !approved && (
            <div className="space-y-6">
              <div className="p-4 bg-primary/5 border border-primary/30 rounded-xl flex items-start gap-3">
                <Icon name="Brain" size={20} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">The Strategist has created a campaign proposal</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    I have created a campaign to help you increase {product} sales by {targetLift}% in {timeframe} days.
                    I am targeting <strong className="text-foreground">{proposal?.audience?.size?.toLocaleString()} high-value contacts</strong> with
                    a <strong className="text-foreground">{proposal?.contentStrategy?.type}</strong> because our analysis shows
                    this has the highest probability of conversion ({proposal?.projections?.probabilityOfGoal}).
                    Do you approve?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Audience */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="Users" size={16} className="text-primary" />
                    Target Audience
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Audience Size</span><span className="font-mono font-bold text-foreground">{proposal?.audience?.size?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tier</span><span className="text-foreground">{proposal?.audience?.tier}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg LTV</span><span className="text-success font-mono">{proposal?.audience?.avgLTV}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg Engagement</span><span className="text-foreground">{proposal?.audience?.avgEngagement}%</span></div>
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Filter: {proposal?.audience?.filter}</span>
                    </div>
                  </div>
                </div>

                {/* Projections */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="TrendingUp" size={16} className="text-success" />
                    Projected Results
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Expected Open Rate</span><span className="text-success font-mono font-bold">{proposal?.projections?.expectedOpenRate}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expected Click Rate</span><span className="text-foreground font-mono">{proposal?.projections?.expectedClickRate}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Est. Conversions</span><span className="text-foreground font-mono">{proposal?.projections?.expectedConversions}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Est. Revenue</span><span className="text-success font-mono font-bold">{proposal?.projections?.estimatedRevenue}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Goal Probability</span><span className="text-primary font-mono font-bold">{proposal?.projections?.probabilityOfGoal}</span></div>
                  </div>
                </div>

                {/* Content Strategy */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="FileText" size={16} className="text-primary" />
                    Content Strategy
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">{proposal?.contentStrategy?.reasoning}</p>
                  <div className="space-y-2">
                    {proposal?.contentStrategy?.contentBlocks?.map((block, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs p-2 bg-muted rounded-lg">
                        <Icon name="Layers" size={12} className="text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium text-foreground">{block?.name}</span>
                          <span className="text-muted-foreground"> — IF {block?.rule}: </span>
                          <span className="text-foreground">{block?.version}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Send Schedule */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="Clock" size={16} className="text-primary" />
                    Send Schedule (STO)
                  </h3>
                  <div className="space-y-2 text-sm mb-3">
                    <div><span className="text-muted-foreground">Method: </span><span className="text-foreground">{proposal?.sendSchedule?.method}</span></div>
                    <div><span className="text-muted-foreground">Window: </span><span className="text-foreground">{proposal?.sendSchedule?.window}</span></div>
                    <div><span className="text-muted-foreground">Delivery: </span><span className="text-foreground">{proposal?.sendSchedule?.estimatedDelivery}</span></div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">A/B Test Subject Lines ({proposal?.subjectVariants?.length} variants):</p>
                    {proposal?.subjectVariants?.map((s, i) => (
                      <div key={i} className="text-xs text-foreground py-1 border-b border-border/50 last:border-0">
                        {i + 1}. {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant="default"
                  iconName="CheckCircle"
                  iconPosition="left"
                  onClick={() => setApproved(true)}
                >
                  Approve & Launch Campaign
                </Button>
                <Button
                  variant="outline"
                  iconName="RefreshCw"
                  iconPosition="left"
                  onClick={() => { setProposal(null); setAnalyzing(false); }}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          {approved && (
            <div className="bg-success/10 border border-success/30 rounded-2xl p-8 text-center">
              <Icon name="CheckCircle" size={48} className="text-success mx-auto mb-4" />
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-2">Campaign Launched!</h2>
              <p className="text-muted-foreground mb-6">The Strategist has queued your campaign. {proposal?.audience?.size?.toLocaleString()} emails will be sent at individually optimized times over the next 48 hours.</p>
              <div className="flex items-center justify-center gap-4">
                <Link to="/campaign-manager">
                  <Button variant="default" iconName="Send" iconPosition="left">View in Campaign Manager</Button>
                </Link>
                <Button variant="outline" onClick={() => { setProposal(null); setApproved(false); setProduct(''); setGoal(''); }}>
                  Create Another
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ZeroClickCampaign;
