import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:3001';

const mockABTests = [
  {
    id: 'ab-001',
    campaignId: null, // real campaign ID would come from DB
    name: 'Spring Promo Subject Line Test',
    campaign: 'Spring Promo 2026',
    status: 'running',
    startDate: '2026-02-20',
    totalRecipients: 12000,
    significanceThreshold: 95,
    variants: [
      { id: 'A', name: 'Control', subject: 'Your Exclusive Spring Offer Inside', sent: 3000, opens: 720, clicks: 144, openRate: 24.0, clickRate: 4.8, conversionRate: 2.1 },
      { id: 'B', name: 'Variant B', subject: '🌸 Spring Sale — 40% Off Ends Tonight', sent: 3000, opens: 870, clicks: 209, openRate: 29.0, clickRate: 6.97, conversionRate: 3.4 },
      { id: 'C', name: 'Variant C', subject: 'Limited Time: Spring Collection Now Live', sent: 3000, opens: 660, clicks: 132, openRate: 22.0, clickRate: 4.4, conversionRate: 1.9 },
    ],
    winner: 'B',
    confidence: 97.3,
    autoDeployEnabled: true,
    autoDeployStatus: 'pending_threshold',
    remainingRecipients: 3000,
  },
  {
    id: 'ab-002',
    campaignId: null,
    name: 'From Name Personalization Test',
    campaign: 'Newsletter March',
    status: 'running',
    startDate: '2026-02-22',
    totalRecipients: 8000,
    significanceThreshold: 95,
    variants: [
      { id: 'A', name: 'Control', subject: 'From: Chimera Team', sent: 2000, opens: 380, clicks: 57, openRate: 19.0, clickRate: 2.85, conversionRate: 1.2 },
      { id: 'B', name: 'Variant B', subject: 'From: Alex at Chimera', sent: 2000, opens: 520, clicks: 94, openRate: 26.0, clickRate: 4.7, conversionRate: 2.3 },
    ],
    winner: 'B',
    confidence: 91.2,
    autoDeployEnabled: false,
    autoDeployStatus: 'manual_review',
    remainingRecipients: 4000,
  },
  {
    id: 'ab-003',
    campaignId: null,
    name: 'CTA Button Color Test',
    campaign: 'Product Launch Q2',
    status: 'completed',
    startDate: '2026-02-15',
    totalRecipients: 20000,
    significanceThreshold: 95,
    variants: [
      { id: 'A', name: 'Control (Blue)', subject: 'Blue CTA Button', sent: 10000, opens: 2800, clicks: 504, openRate: 28.0, clickRate: 5.04, conversionRate: 2.8 },
      { id: 'B', name: 'Variant B (Green)', subject: 'Green CTA Button', sent: 10000, opens: 2900, clicks: 609, openRate: 29.0, clickRate: 6.09, conversionRate: 3.5 },
    ],
    winner: 'B',
    confidence: 99.1,
    autoDeployEnabled: true,
    autoDeployStatus: 'deployed',
    remainingRecipients: 0,
  },
];

const ABTestsPanel = () => {
  const [tests, setTests] = useState(mockABTests);
  const [expandedTest, setExpandedTest] = useState('ab-001');
  const [thresholds, setThresholds] = useState({ 'ab-001': 95, 'ab-002': 95 });
  const [promotingId, setPromotingId] = useState(null);
  const [promotionResults, setPromotionResults] = useState({});

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running': return 'bg-success/10 text-success border-success/30';
      case 'completed': return 'bg-primary/10 text-primary border-primary/30';
      case 'paused': return 'bg-warning/10 text-warning border-warning/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDeployStatusBadge = (status) => {
    switch (status) {
      case 'deployed': return { color: 'text-success', icon: 'CheckCircle', label: 'Auto-Deployed' };
      case 'pending_threshold': return { color: 'text-warning', icon: 'Clock', label: 'Awaiting Threshold' };
      case 'manual_review': return { color: 'text-primary', icon: 'Eye', label: 'Manual Review' };
      case 'promoted': return { color: 'text-success', icon: 'Rocket', label: 'Winner Promoted' };
      default: return { color: 'text-muted-foreground', icon: 'Minus', label: 'N/A' };
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 95) return 'text-success';
    if (confidence >= 80) return 'text-warning';
    return 'text-error';
  };

  const handlePromoteWinner = async (test) => {
    const winnerVariant = test?.variants?.find(v => v?.id === test?.winner);
    if (!winnerVariant) return;

    setPromotingId(test?.id);
    try {
      const token = localStorage?.getItem('auth_token');

      if (test?.campaignId) {
        // Use Supabase direct update instead of backend
        const { supabase } = await import('../../../lib/supabase');
        const { error } = await supabase
          ?.from('campaigns')
          ?.update({ campaign_status: 'Running', subject: winnerVariant?.subject })
          ?.eq('id', test?.campaignId);
        if (error) throw error;
      } else {
        // Simulate for demo (no real campaign ID)
        await new Promise(r => setTimeout(r, 1200));
      }

      setTests(prev => prev?.map(t => t?.id === test?.id
        ? { ...t, autoDeployStatus: 'promoted', status: 'completed' }
        : t
      ));
    } catch (err) {
      setPromotionResults(prev => ({ ...prev, [test?.id]: { success: false, message: err?.message } }));
    } finally {
      setPromotingId(null);
    }
  };

  const handleDeploy = (testId) => {
    setTests(prev => prev?.map(t => t?.id === testId
      ? { ...t, autoDeployStatus: 'deployed', status: 'completed' }
      : t
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold text-foreground">Active A/B Tests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tests?.filter(t => t?.status === 'running')?.length} running · {tests?.filter(t => t?.status === 'completed')?.length} completed</p>
        </div>
        <Button variant="primary" size="sm" iconName="Plus" iconPosition="left">
          New Test
        </Button>
      </div>
      {tests?.map(test => {
        const isExpanded = expandedTest === test?.id;
        const deployStatus = getDeployStatusBadge(test?.autoDeployStatus);
        const isStatSig = test?.confidence >= (thresholds?.[test?.id] || 95);
        const promotionResult = promotionResults?.[test?.id];

        return (
          <div key={test?.id} className="bg-card rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setExpandedTest(isExpanded ? null : test?.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{test?.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusBadge(test?.status)}`}>
                      {test?.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Campaign: {test?.campaign} · {test?.totalRecipients?.toLocaleString()} recipients · Started {test?.startDate}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <div className={`text-sm font-semibold ${getConfidenceColor(test?.confidence)}`}>
                    {test?.confidence}% confidence
                  </div>
                  <div className="text-xs text-muted-foreground">Winner: Variant {test?.winner}</div>
                </div>
                <div className={`flex items-center gap-1 text-xs ${deployStatus?.color}`}>
                  <Icon name={deployStatus?.icon} size={14} />
                  <span>{deployStatus?.label}</span>
                </div>
                <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border">
                <div className="p-4">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Variant Performance</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs text-muted-foreground pb-2 pr-4">Variant</th>
                          <th className="text-right text-xs text-muted-foreground pb-2 px-3">Sent</th>
                          <th className="text-right text-xs text-muted-foreground pb-2 px-3">Open Rate</th>
                          <th className="text-right text-xs text-muted-foreground pb-2 px-3">Click Rate</th>
                          <th className="text-right text-xs text-muted-foreground pb-2 px-3">Conversion</th>
                          <th className="text-right text-xs text-muted-foreground pb-2 pl-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {test?.variants?.map(variant => {
                          const isWinner = variant?.id === test?.winner;
                          return (
                            <tr key={variant?.id} className={isWinner ? 'bg-success/5' : ''}>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-bold text-foreground">{variant?.id}</span>
                                  <div>
                                    <div className="text-sm font-medium text-foreground">{variant?.name}</div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{variant?.subject}</div>
                                  </div>
                                  {isWinner && <Icon name="Trophy" size={14} className="text-warning" />}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right text-sm text-foreground">{variant?.sent?.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right">
                                <span className={`text-sm font-medium ${isWinner ? 'text-success' : 'text-foreground'}`}>{variant?.openRate}%</span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className={`text-sm font-medium ${isWinner ? 'text-success' : 'text-foreground'}`}>{variant?.clickRate}%</span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className={`text-sm font-medium ${isWinner ? 'text-success' : 'text-foreground'}`}>{variant?.conversionRate}%</span>
                              </td>
                              <td className="py-3 pl-3 text-right">
                                {isWinner ? (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">Winner</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Statistical Significance Bar */}
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Statistical Significance</span>
                      <span className={`text-xs font-semibold ${getConfidenceColor(test?.confidence)}`}>{test?.confidence}%</span>
                    </div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          test?.confidence >= 95 ? 'bg-success' : test?.confidence >= 80 ? 'bg-warning' : 'bg-error'
                        }`}
                        style={{ width: `${test?.confidence}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-muted-foreground">0%</span>
                      <span className="text-xs text-muted-foreground">Threshold: {test?.significanceThreshold}%</span>
                      <span className="text-xs text-muted-foreground">100%</span>
                    </div>
                  </div>

                  {/* Promotion Result Banner */}
                  {promotionResult && (
                    <div className={`mt-4 flex items-start gap-3 p-3 rounded-lg border ${
                      promotionResult?.success
                        ? 'bg-success/10 border-success/20' :'bg-error/10 border-error/20'
                    }`}>
                      <Icon
                        name={promotionResult?.success ? 'CheckCircle' : 'AlertCircle'}
                        size={16}
                        className={promotionResult?.success ? 'text-success mt-0.5' : 'text-error mt-0.5'}
                      />
                      <div>
                        <p className={`text-sm font-medium ${promotionResult?.success ? 'text-success' : 'text-error'}`}>
                          {promotionResult?.success ? 'Winner Promoted Successfully' : 'Promotion Failed'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{promotionResult?.message}</p>
                        {promotionResult?.queued > 0 && (
                          <p className="text-xs text-success mt-1">
                            <Icon name="Send" size={11} className="inline mr-1" />
                            {promotionResult?.queued?.toLocaleString()} contacts queued for delivery
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Auto-Deploy Controls */}
                  {test?.status === 'running' && test?.autoDeployStatus !== 'promoted' && (
                    <div className="mt-4 p-3 bg-card border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon name="Rocket" size={14} className="text-primary" />
                          <span className="text-xs font-medium text-foreground">Deploy Controls</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Significance threshold:</span>
                          <input
                            type="number"
                            min="80"
                            max="99"
                            value={thresholds?.[test?.id] || 95}
                            onChange={e => setThresholds(prev => ({ ...prev, [test?.id]: Number(e?.target?.value) }))}
                            className="w-16 text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Promote Winner Button — shown when statistically significant */}
                        {isStatSig && (
                          <Button
                            variant="primary"
                            size="sm"
                            iconName={promotingId === test?.id ? 'Loader2' : 'Trophy'}
                            iconPosition="left"
                            onClick={() => handlePromoteWinner(test)}
                            disabled={promotingId === test?.id}
                            className="bg-success hover:bg-success/90 text-white border-success"
                          >
                            {promotingId === test?.id ? 'Promoting...' : `Promote Winner (Variant ${test?.winner})`}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          iconName="Rocket"
                          iconPosition="left"
                          onClick={() => handleDeploy(test?.id)}
                          disabled={test?.confidence < (thresholds?.[test?.id] || 95) || promotingId === test?.id}
                        >
                          Deploy Winner
                        </Button>
                        <Button variant="outline" size="sm" iconName="Pause" iconPosition="left">
                          Pause Test
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {test?.remainingRecipients?.toLocaleString()} recipients remaining
                        </span>
                      </div>
                      {!isStatSig && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <Icon name="Info" size={11} className="inline mr-1" />
                          Promote Winner requires ≥{thresholds?.[test?.id] || 95}% confidence (currently {test?.confidence}%)
                        </p>
                      )}
                    </div>
                  )}

                  {(test?.autoDeployStatus === 'deployed' || test?.autoDeployStatus === 'promoted') && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
                      <Icon name="CheckCircle" size={14} className="text-success" />
                      <p className="text-xs text-success">
                        Variant {test?.winner} {test?.autoDeployStatus === 'promoted' ? 'promoted to full delivery' : 'auto-deployed to all recipients'}. Test complete.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ABTestsPanel;
