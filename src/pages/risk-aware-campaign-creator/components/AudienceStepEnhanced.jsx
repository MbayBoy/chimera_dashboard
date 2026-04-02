
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';

const AudienceStepEnhanced = ({ contactLists, formData, setFormData }) => {
  const selectedListData = contactLists?.find(list => list?.id === formData?.selectedList);

  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum':
        return 'text-purple-600';
      case 'gold':
        return 'text-yellow-600';
      case 'silver':
        return 'text-slate-500';
      case 'bronze':
        return 'text-orange-600';
      case 'lead':
        return 'text-slate-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getRiskBadge = (riskLevel) => {
    switch (riskLevel) {
      case 'Low':
        return 'bg-success/10 text-success border-success/20';
      case 'Medium':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'High':
        return 'bg-error/10 text-error border-error/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const listOptions = contactLists?.map(list => ({
    value: list?.id,
    label: list?.name,
    description: `${list?.subscriberCount?.toLocaleString()} subscribers • ${list?.averageEngagement}% engagement • ${list?.riskLevel} Risk`
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
          Step 1: Select Audience
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Choose your contact list and configure sender details. Tier composition affects campaign risk score.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Select
            label="Contact List"
            description="Select the audience for this campaign"
            options={listOptions}
            value={formData?.selectedList}
            onChange={(value) => setFormData({ ...formData, selectedList: value })}
            searchable
            required
            placeholder="Search contact lists..."
          />
        </div>
        <div>
          <Input
            label="From Address"
            type="email"
            placeholder="sender@example.com"
            value={formData?.fromAddress}
            onChange={(e) => setFormData({ ...formData, fromAddress: e?.target?.value })}
            required
            description="Sender email address"
          />
        </div>
      </div>

      {selectedListData && (
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-heading font-semibold text-foreground">
              List Analysis
            </h4>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getRiskBadge(selectedListData?.riskLevel)}`}>
              <Icon name="Shield" size={12} />
              {selectedListData?.riskLevel} Risk
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="Users" size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <div className="text-xl font-heading font-semibold text-foreground">
                {selectedListData?.subscriberCount?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="TrendingUp" size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Engagement</span>
              </div>
              <div className="text-xl font-heading font-semibold text-foreground">
                {selectedListData?.averageEngagement}%
              </div>
            </div>
            <div className="col-span-2 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="Layers" size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tier Breakdown</span>
              </div>
              <div className="text-sm font-medium text-foreground">
                {selectedListData?.tierBreakdown}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-caption font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Tier Distribution
            </div>
            <div className="space-y-2">
              {Object.entries(selectedListData?.tiers)?.map(([tier, count]) => {
                if (count === 0) return null;
                const percentage = ((count / selectedListData?.subscriberCount) * 100)?.toFixed(1);
                const color = getTierColor(tier);
                
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium text-foreground capitalize">
                      {tier}
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${color?.replace('text-', 'bg-')}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-32 text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {count?.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Icon name="Lightbulb" size={16} className="text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground mb-1">
                  Recommendation
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedListData?.riskLevel === 'Low' ?'This list has excellent engagement and tier quality. Ideal for Production infrastructure.'
                    : selectedListData?.riskLevel === 'Medium' ?'This list has moderate engagement. Consider using Canary infrastructure for initial testing.' :'This list has low engagement or high-risk tiers. Strongly recommend Canary simulation before full deployment.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudienceStepEnhanced;