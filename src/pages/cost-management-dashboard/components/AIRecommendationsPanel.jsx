import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const RECOMMENDATIONS = [
  {
    id: 'rec-1',
    title: 'Switch MXToolbox to cheaper RBL API',
    description: 'Replace MXToolbox Pro with MultiRBL.valli.org free tier for blacklist checks. Same coverage, zero cost.',
    savings: 50,
    category: 'API',
    risk: 'Low',
    effort: 'Medium',
    icon: 'ArrowRightLeft',
  },
  {
    id: 'rec-2',
    title: 'Consolidate 3 low-traffic servers',
    description: 'Servers US-East-3, US-East-4, and EU-West-2 are under 20% utilization. Merge into 1 high-capacity server.',
    savings: 180,
    category: 'Infrastructure',
    risk: 'Medium',
    effort: 'High',
    icon: 'Server',
  },
  {
    id: 'rec-3',
    title: 'Downgrade verification API tier',
    description: 'Current usage is 45k verifications/month. Downgrade from 100k tier to 50k tier saves $35/month.',
    savings: 35,
    category: 'API',
    risk: 'Low',
    effort: 'Low',
    icon: 'TrendingDown',
  },
  {
    id: 'rec-4',
    title: 'Enable Supabase connection pooling',
    description: 'Reduce Supabase compute costs by enabling PgBouncer pooling. Estimated 15% reduction in DB costs.',
    savings: 22,
    category: 'Database',
    risk: 'Low',
    effort: 'Low',
    icon: 'Database',
  },
  {
    id: 'rec-5',
    title: 'Optimize domain renewal strategy',
    description: 'Retire 8 burnt domains and consolidate registrar to Namecheap bulk pricing. Save $12/domain/year.',
    savings: 96,
    category: 'Domains',
    risk: 'Low',
    effort: 'Medium',
    icon: 'Globe',
  },
];

const riskColor = { Low: 'text-emerald-400 bg-emerald-500/10', Medium: 'text-amber-400 bg-amber-500/10', High: 'text-rose-400 bg-rose-500/10' };
const categoryColor = { API: 'text-cyan-400 bg-cyan-500/10', Infrastructure: 'text-purple-400 bg-purple-500/10', Database: 'text-blue-400 bg-blue-500/10', Domains: 'text-orange-400 bg-orange-500/10' };

const AIRecommendationsPanel = ({ onApprove }) => {
  const [autoApprove, setAutoApprove] = useState({});
  const [applied, setApplied] = useState({});

  const totalSavings = RECOMMENDATIONS?.reduce((sum, r) => sum + r?.savings, 0);
  const autoApprovedSavings = RECOMMENDATIONS
    ?.filter(r => autoApprove?.[r?.id])
    ?.reduce((sum, r) => sum + r?.savings, 0);

  const handleToggleAuto = (id) => {
    setAutoApprove(prev => ({ ...prev, [id]: !prev?.[id] }));
  };

  const handleApplyNow = (rec) => {
    setApplied(prev => ({ ...prev, [rec?.id]: true }));
    if (onApprove) onApprove(rec);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">AI Governor Recommendations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Detected optimization opportunities</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-400">${totalSavings}/mo</p>
          <p className="text-xs text-muted-foreground">potential savings</p>
        </div>
      </div>
      {autoApprovedSavings > 0 && (
        <div className="mb-4 bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center gap-2">
          <Icon name="Cpu" size={14} className="text-primary" />
          <p className="text-xs text-primary">
            AI will auto-execute <strong>${autoApprovedSavings}/mo</strong> in savings when conditions are met
          </p>
        </div>
      )}
      <div className="space-y-3">
        {RECOMMENDATIONS?.map(rec => (
          <div
            key={rec?.id}
            className={`border rounded-lg p-3 transition-all ${
              applied?.[rec?.id]
                ? 'border-emerald-500/30 bg-emerald-500/5' :'border-border hover:border-primary/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon name={rec?.icon} size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{rec?.title}</p>
                  {applied?.[rec?.id] && (
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Applied</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{rec?.description}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor?.[rec?.category] || 'text-muted-foreground bg-muted'}`}>
                    {rec?.category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${riskColor?.[rec?.risk]}`}>
                    {rec?.risk} Risk
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold ml-auto">Save ${rec?.savings}/mo</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Auto-approve</span>
                <button
                  onClick={() => handleToggleAuto(rec?.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    autoApprove?.[rec?.id] ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      autoApprove?.[rec?.id] ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              {!applied?.[rec?.id] && (
                <button
                  onClick={() => handleApplyNow(rec)}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Apply Now →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIRecommendationsPanel;
