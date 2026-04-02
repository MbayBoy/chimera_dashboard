import { useState } from 'react';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const AudienceSelector = ({ contactLists, selectedList, onSelectList }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const listOptions = contactLists?.map(list => ({
    value: list?.id,
    label: list?.name,
    description: `${list?.subscriberCount?.toLocaleString()} subscribers • ${list?.tier} Tier`
  }));

  const selectedListData = contactLists?.find(list => list?.id === selectedList);

  const getEngagementColor = (score) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-error';
  };

  const getEngagementLabel = (score) => {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'Platinum':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'Gold':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Silver':
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
      case 'Bronze':
        return 'bg-orange-600/10 text-orange-600 border-orange-600/20';
      case 'Lead':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Select
          label="Select Contact List"
          description="Choose the audience for this campaign"
          options={listOptions}
          value={selectedList}
          onChange={onSelectList}
          searchable
          required
          placeholder="Search contact lists..."
        />
      </div>
      {selectedListData && (
        <div className="bg-card rounded-lg border border-border p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
                Audience Insights
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
                getTierColor(selectedListData?.tier)
              }`}>
                {selectedListData?.tier} Tier
              </span>
              {selectedListData?.isGoldenList && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border bg-primary/10 text-primary border-primary/20">
                  <Icon name="Star" size={12} className="fill-current" />
                  Golden List
                </span>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Users" size={20} className="text-primary" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Users" size={16} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Subscribers</span>
              </div>
              <div className="text-2xl font-heading font-bold text-foreground">
                {selectedListData?.subscriberCount?.toLocaleString()}
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="TrendingUp" size={16} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Avg Engagement</span>
              </div>
              <div className={`text-2xl font-heading font-bold ${getEngagementColor(selectedListData?.averageEngagement)}`}>
                {selectedListData?.averageEngagement}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {getEngagementLabel(selectedListData?.averageEngagement)} engagement
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Mail" size={16} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Open Rate</span>
              </div>
              <div className="text-2xl font-heading font-bold text-foreground">
                {selectedListData?.openRate}%
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="MousePointer" size={16} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Click Rate</span>
              </div>
              <div className="text-2xl font-heading font-bold text-foreground">
                {selectedListData?.clickRate}%
              </div>
            </div>
          </div>

          <div className={`mt-4 p-4 rounded-lg border ${
            selectedListData?.tier === 'Platinum' || selectedListData?.tier === 'Gold' ?'bg-success/5 border-success/20'
              : selectedListData?.tier === 'Silver' ?'bg-warning/5 border-warning/20' :'bg-error/5 border-error/20'
          }`}>
            <div className="flex items-start gap-3">
              <Icon name="Lightbulb" size={16} className={`mt-0.5 flex-shrink-0 ${
                selectedListData?.tier === 'Platinum' || selectedListData?.tier === 'Gold' ?'text-success'
                  : selectedListData?.tier === 'Silver' ?'text-warning' :'text-error'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground mb-1">
                  Risk Assessment
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedListData?.tier === 'Platinum' ?'Golden List - Excellent choice! This list has the highest engagement and will be assigned to Production servers with priority routing.'
                    : selectedListData?.tier === 'Gold' ?'High-quality list with strong engagement. Safe for Production servers with standard monitoring.'
                    : selectedListData?.tier === 'Silver' ?'Moderate engagement list. Campaign will be monitored closely. Consider Canary testing for high-risk content.'
                    : selectedListData?.tier === 'Bronze' ?'Low engagement list. Campaign will be assigned to Canary servers for testing. Re-engagement recommended before large sends.' :'New leads with unproven engagement. Mandatory Canary testing. Consider warming up this list with smaller sends first.'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-caption font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Tier Breakdown
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(selectedListData?.tiers || {})?.map(([tier, count]) => (
                <div key={tier} className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-xs text-muted-foreground capitalize mb-1">{tier}</div>
                  <div className="text-lg font-heading font-bold text-foreground">
                    {count?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-caption font-medium text-muted-foreground uppercase tracking-wide mb-3">
              List Segments
            </div>
            <div className="space-y-2">
              {selectedListData?.segments?.map((segment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-smooth"
                >
                  <div className="flex items-center gap-3">
                    <Icon name="Tag" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {segment?.name}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {segment?.count?.toLocaleString()} contacts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudienceSelector;