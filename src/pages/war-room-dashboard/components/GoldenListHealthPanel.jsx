import Icon from '../../../components/AppIcon';

const GoldenListHealthPanel = ({ data }) => {
  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum':
        return { bg: 'bg-purple-500', text: 'text-purple-400', ring: 'ring-purple-400' };
      case 'gold':
        return { bg: 'bg-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-400' };
      case 'silver':
        return { bg: 'bg-slate-400', text: 'text-slate-300', ring: 'ring-slate-400' };
      case 'bronze':
        return { bg: 'bg-orange-600', text: 'text-orange-400', ring: 'ring-orange-400' };
      case 'lead':
        return { bg: 'bg-slate-600', text: 'text-slate-400', ring: 'ring-slate-500' };
      default:
        return { bg: 'bg-slate-500', text: 'text-slate-400', ring: 'ring-slate-400' };
    }
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'platinum':
        return 'Crown';
      case 'gold':
        return 'Award';
      case 'silver':
        return 'Medal';
      case 'bronze':
        return 'Star';
      case 'lead':
        return 'Users';
      default:
        return 'Circle';
    }
  };

  const goldenListCount = data?.tiers?.platinum?.count + data?.tiers?.gold?.count;
  const goldenListPercentage = ((goldenListCount / data?.totalContacts) * 100)?.toFixed(1);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl md:text-2xl font-heading font-semibold text-white">
            Golden List Health
          </h2>
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <Icon name="Crown" size={20} className="text-yellow-400" />
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Your most valuable contacts
        </p>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
            <div className="text-xs text-slate-400 mb-1">Total Contacts</div>
            <div className="text-2xl font-heading font-bold text-white">
              {data?.totalContacts?.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
            <div className="text-xs text-slate-400 mb-1">Avg Engagement</div>
            <div className="text-2xl font-heading font-bold text-green-400">
              {data?.avgEngagement}%
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/20 to-purple-900/20 rounded-lg p-4 border border-yellow-500/30">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Crown" size={20} className="text-yellow-400" />
            <div>
              <div className="text-sm font-medium text-white">Golden List</div>
              <div className="text-xs text-slate-400">Platinum + Gold Tiers</div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-heading font-bold text-yellow-400">
              {goldenListCount?.toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">
              ({goldenListPercentage}%)
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-caption font-medium text-slate-400 uppercase tracking-wide mb-3">
            Tier Distribution
          </div>
          <div className="space-y-3">
            {Object.entries(data?.tiers)?.map(([tier, tierData]) => {
              const colors = getTierColor(tier);
              const icon = getTierIcon(tier);
              
              return (
                <div key={tier} className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon name={icon} size={16} className={colors?.text} />
                      <span className="text-sm font-medium text-white capitalize">
                        {tier}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {tierData?.count?.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                    <div
                      className={`${colors?.bg} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${tierData?.percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {tierData?.percentage?.toFixed(1)}% of total
                    </span>
                    <span className={colors?.text}>
                      Engagement: {tierData?.engagementScore}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="TrendingUp" size={16} className="text-green-400" />
            <span className="text-sm font-medium text-green-400">List Quality Score</span>
          </div>
          <div className="text-3xl font-heading font-bold text-green-400">
            {data?.listQuality}/100
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Excellent - Continue current practices
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoldenListHealthPanel;