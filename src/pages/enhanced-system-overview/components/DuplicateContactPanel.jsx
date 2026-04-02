import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const DuplicateContactPanel = () => {
  const [deduplicating, setDeduplicating] = useState(false);
  const [deduped, setDeduped] = useState(false);
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);

  const campaigns = [
    { id: 'c1', name: 'Spring Promo 2026', list: 'Gold List', recipients: 24300, status: 'Scheduled' },
    { id: 'c2', name: 'Re-engagement Q2', list: 'Bronze List', recipients: 15600, status: 'Draft' },
    { id: 'c3', name: 'Product Launch', list: 'Platinum List', recipients: 8920, status: 'Running' },
    { id: 'c4', name: 'Newsletter April', list: 'Silver List', recipients: 41200, status: 'Scheduled' }
  ];

  const overlapData = [
    { campaign1: 'Spring Promo 2026', campaign2: 'Newsletter April', overlapping: 3420, percentage: 14.1, risk: 'HIGH' },
    { campaign1: 'Re-engagement Q2', campaign2: 'Spring Promo 2026', overlapping: 892, percentage: 5.7, risk: 'MEDIUM' },
    { campaign1: 'Product Launch', campaign2: 'Newsletter April', overlapping: 234, percentage: 2.6, risk: 'LOW' }
  ];

  const deduplicationRules = [
    { rule: 'Same contact cannot receive 2 campaigns within 24 hours', enabled: true },
    { rule: 'Same contact cannot appear in 2 active campaigns simultaneously', enabled: true },
    { rule: 'Bounced contacts are excluded from all campaigns automatically', enabled: true },
    { rule: 'Unsubscribed contacts are globally suppressed', enabled: true },
    { rule: 'Complained contacts are permanently excluded', enabled: true },
    { rule: 'Contacts with Churn_Probability > 0.8 are auto-enrolled in win-back only', enabled: false }
  ];

  const [rules, setRules] = useState(deduplicationRules);

  const toggleRule = (index) => {
    setRules(prev => prev?.map((r, i) => i === index ? { ...r, enabled: !r?.enabled } : r));
  };

  const handleDeduplicate = () => {
    setDeduplicating(true);
    setTimeout(() => {
      setDeduplicating(false);
      setDeduped(true);
    }, 2000);
  };

  const toggleCampaign = (id) => {
    setSelectedCampaigns(prev =>
      prev?.includes(id) ? prev?.filter(c => c !== id) : [...prev, id]
    );
  };

  const getRiskColor = (risk) => {
    if (risk === 'HIGH') return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (risk === 'MEDIUM') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/10 text-green-400 border-green-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="UserCheck" size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">Contact Deduplication</h2>
            <p className="text-sm text-muted-foreground">Ensure no contact is emailed twice in the same campaign cycle</p>
          </div>
        </div>

        {deduped && (
          <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
            <Icon name="CheckCircle2" size={16} className="text-green-400" />
            <p className="text-sm text-green-400">Deduplication complete. 4,546 duplicate entries removed across all active campaigns.</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Contacts', value: '89,200', icon: 'Users', color: 'text-blue-400' },
            { label: 'Duplicates Found', value: '4,546', icon: 'Copy', color: 'text-yellow-400' },
            { label: 'Campaign Overlaps', value: overlapData?.length, icon: 'GitMerge', color: 'text-orange-400' },
            { label: 'Suppressed', value: '12,340', icon: 'UserX', color: 'text-red-400' }
          ]?.map((stat, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
              <Icon name={stat?.icon} size={18} className={`${stat?.color} mx-auto mb-2`} />
              <div className="text-xl font-bold text-foreground">{stat?.value}</div>
              <div className="text-xs text-muted-foreground">{stat?.label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Campaign Overlap Warnings */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Icon name="AlertTriangle" size={16} className="text-yellow-400" />
            Campaign Overlap Warnings
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {overlapData?.map((overlap, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{overlap?.campaign1}</span>
                  <Icon name="ArrowLeftRight" size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{overlap?.campaign2}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded border font-medium ${getRiskColor(overlap?.risk)}`}>{overlap?.risk}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${overlap?.risk === 'HIGH' ? 'bg-red-500' : overlap?.risk === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${overlap?.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground flex-shrink-0">
                  {overlap?.overlapping?.toLocaleString()} contacts ({overlap?.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Deduplication Rules */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Deduplication Rules</h3>
          <p className="text-sm text-muted-foreground mt-1">Configure global contact protection rules</p>
        </div>
        <div className="p-4 space-y-3">
          {rules?.map((rule, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon
                  name={rule?.enabled ? 'ShieldCheck' : 'ShieldOff'}
                  size={16}
                  className={rule?.enabled ? 'text-green-400' : 'text-muted-foreground'}
                />
                <span className="text-sm text-foreground">{rule?.rule}</span>
              </div>
              <button
                onClick={() => toggleRule(i)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                  rule?.enabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  rule?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Run Deduplication */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-foreground mb-3">Run Global Deduplication</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select campaigns to deduplicate against each other. Contacts appearing in multiple selected campaigns will be removed from lower-priority campaigns.
        </p>
        <div className="space-y-2 mb-4">
          {campaigns?.map(campaign => (
            <label key={campaign?.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={selectedCampaigns?.includes(campaign?.id)}
                onChange={() => toggleCampaign(campaign?.id)}
                className="w-4 h-4 rounded border-border text-primary"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{campaign?.name}</div>
                <div className="text-xs text-muted-foreground">{campaign?.list} • {campaign?.recipients?.toLocaleString()} recipients</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                campaign?.status === 'Running' ? 'bg-green-500/10 text-green-400' :
                campaign?.status === 'Scheduled'? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground'
              }`}>{campaign?.status}</span>
            </label>
          ))}
        </div>
        <button
          onClick={handleDeduplicate}
          disabled={deduplicating || selectedCampaigns?.length < 2}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deduplicating ? (
            <><Icon name="Loader2" size={16} className="animate-spin" /> Running Deduplication...</>
          ) : (
            <><Icon name="UserCheck" size={16} /> Run Deduplication ({selectedCampaigns?.length} campaigns)</>  
          )}
        </button>
        {selectedCampaigns?.length < 2 && (
          <p className="text-xs text-muted-foreground mt-2">Select at least 2 campaigns to run deduplication</p>
        )}
      </div>
    </div>
  );
};

export default DuplicateContactPanel;
