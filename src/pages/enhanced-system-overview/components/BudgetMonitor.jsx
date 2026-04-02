import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const BudgetMonitor = () => {
  const [monthlyBudget] = useState(2000);
  const [showFinancialReport, setShowFinancialReport] = useState(false);

  const costs = [
    { service: 'Mail Servers (6x)', category: 'Infrastructure', spent: 580, budget: 720, trend: 'stable', provider: 'DigitalOcean' },
    { service: 'Domain Registrations', category: 'Domains', spent: 124, budget: 150, trend: 'stable', provider: 'Namecheap' },
    { service: 'MXToolbox API', category: 'Monitoring', spent: 89, budget: 75, trend: 'over', provider: 'MXToolbox', alternative: 'MultiRBL.valli.org (Free)' },
    { service: 'Blacklist Monitoring', category: 'Security', spent: 45, budget: 60, trend: 'under', provider: 'Spamhaus' },
    { service: 'DNS Management', category: 'Infrastructure', spent: 32, budget: 40, trend: 'stable', provider: 'Cloudflare' },
    { service: 'Email Verification API', category: 'Data', spent: 156, budget: 200, trend: 'stable', provider: 'ZeroBounce' },
    { service: 'CDN & Storage', category: 'Infrastructure', spent: 28, budget: 50, trend: 'under', provider: 'Cloudflare R2' },
    { service: 'Backup & Monitoring', category: 'Operations', spent: 310, budget: 705, trend: 'under', provider: 'Various' }
  ];

  const totalSpent = costs?.reduce((sum, c) => sum + c?.spent, 0);
  const totalBudget = costs?.reduce((sum, c) => sum + c?.budget, 0);
  const utilizationPct = Math.round((totalSpent / monthlyBudget) * 100);

  const overBudgetItems = costs?.filter(c => c?.trend === 'over');

  const getTrendIcon = (trend) => {
    if (trend === 'over') return { icon: 'TrendingUp', color: 'text-red-400' };
    if (trend === 'under') return { icon: 'TrendingDown', color: 'text-green-400' };
    return { icon: 'Minus', color: 'text-muted-foreground' };
  };

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Monthly Budget</span>
            <Icon name="DollarSign" size={16} className="text-primary" />
          </div>
          <div className="text-3xl font-bold text-foreground">${monthlyBudget?.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Operational budget</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Spent This Month</span>
            <Icon name="CreditCard" size={16} className="text-yellow-400" />
          </div>
          <div className="text-3xl font-bold text-foreground">${totalSpent?.toLocaleString()}</div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{utilizationPct}% utilized</span>
              <span>${(monthlyBudget - totalSpent)?.toLocaleString()} remaining</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${utilizationPct >= 90 ? 'bg-red-500' : utilizationPct >= 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, utilizationPct)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Projected Month-End</span>
            <Icon name="TrendingUp" size={16} className="text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-foreground">${Math.round(totalSpent * 1.15)?.toLocaleString()}</div>
          <div className="text-xs text-green-400 mt-1">✓ Within budget projection</div>
        </div>
      </div>
      {/* Cost Optimization Alert */}
      {overBudgetItems?.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="Lightbulb" size={18} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-orange-400 mb-2">AI Cost Optimization Recommendations</h3>
              {overBudgetItems?.map((item, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{item?.service}</span> is ${item?.spent - item?.budget} over budget.
                    {item?.alternative && (
                      <span className="text-orange-400"> Suggested alternative: <strong>{item?.alternative}</strong></span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Cost Breakdown Table */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Cost Breakdown</h2>
          <button
            onClick={() => setShowFinancialReport(!showFinancialReport)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
          >
            <Icon name="FileBarChart" size={14} />
            Monthly Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {['Service', 'Category', 'Provider', 'Spent', 'Budget', 'Trend']?.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costs?.map((cost, i) => {
                const trend = getTrendIcon(cost?.trend);
                return (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{cost?.service}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground">{cost?.category}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{cost?.provider}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">${cost?.spent}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">${cost?.budget}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Icon name={trend?.icon} size={14} className={trend?.color} />
                        <span className={`text-xs font-medium ${trend?.color}`}>
                          {cost?.trend === 'over' ? `+$${cost?.spent - cost?.budget}` : cost?.trend === 'under' ? `-$${cost?.budget - cost?.spent}` : 'On track'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Financial Report Modal */}
      {showFinancialReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Monthly Financial Report</h3>
              <button onClick={() => setShowFinancialReport(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Total Budget</span>
                <span className="text-sm font-medium text-foreground">${monthlyBudget?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Total Spent</span>
                <span className="text-sm font-medium text-foreground">${totalSpent?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Remaining</span>
                <span className="text-sm font-medium text-green-400">${(monthlyBudget - totalSpent)?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Utilization</span>
                <span className="text-sm font-medium text-foreground">{utilizationPct}%</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-muted-foreground">Projected Month-End</span>
                <span className="text-sm font-medium text-foreground">${Math.round(totalSpent * 1.15)?.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => setShowFinancialReport(false)}
              className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Close Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetMonitor;
