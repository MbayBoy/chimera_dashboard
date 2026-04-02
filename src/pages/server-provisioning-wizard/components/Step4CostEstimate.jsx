import Icon from '../../../components/AppIcon';

const Step4CostEstimate = ({ config, updateConfig }) => {
  const getCostByType = (type) => {
    switch (type) {
      case 'Production': return { server: 120, domain: 12, monitoring: 15, total: 147 };
      case 'Canary': return { server: 80, domain: 12, monitoring: 10, total: 102 };
      case 'Sanitizer': return { server: 60, domain: 12, monitoring: 8, total: 80 };
      case 'HotSpare': return { server: 80, domain: 0, monitoring: 5, total: 85 };
      case 'Verifier': return { server: 100, domain: 12, monitoring: 12, total: 124 };
      default: return { server: 80, domain: 12, monitoring: 10, total: 102 };
    }
  };

  const costs = getCostByType(config?.serverType);
  const currentBudget = 2000;
  const currentSpend = 1364;
  const newTotal = currentSpend + costs?.total;
  const budgetImpact = ((newTotal / currentBudget) * 100)?.toFixed(1);

  const alternatives = [
    { provider: 'DigitalOcean', price: costs?.server, recommended: config?.provider === 'DigitalOcean' },
    { provider: 'Hetzner', price: Math.round(costs?.server * 0.6), recommended: false, savings: Math.round(costs?.server * 0.4) },
    { provider: 'Vultr', price: Math.round(costs?.server * 0.85), recommended: false, savings: Math.round(costs?.server * 0.15) },
    { provider: 'Linode', price: Math.round(costs?.server * 0.9), recommended: false, savings: Math.round(costs?.server * 0.1) }
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-heading font-semibold text-foreground mb-1">Cost Estimation</h2>
        <p className="text-sm text-muted-foreground">Monthly cost projection and budget impact analysis for this server.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Cost Breakdown */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-medium text-foreground mb-4">Monthly Cost Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: 'Server Instance', value: costs?.server, icon: 'Server' },
                { label: 'Domain Registration', value: costs?.domain, icon: 'Globe' },
                { label: 'Monitoring & APIs', value: costs?.monitoring, icon: 'Activity' }
              ]?.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name={item?.icon} size={14} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">{item?.label}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">${item?.value}/mo</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="font-medium text-foreground">Total Monthly Cost</span>
                <span className="text-lg font-bold text-primary">${costs?.total}/mo</span>
              </div>
            </div>
          </div>

          {/* Budget Impact */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-medium text-foreground mb-4">Budget Impact</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Monthly Spend</span>
                <span className="text-foreground">${currentSpend?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">This Server</span>
                <span className="text-foreground">+${costs?.total}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
                <span className="text-foreground">New Total</span>
                <span className="text-foreground">${newTotal?.toLocaleString()}</span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Budget Utilization</span>
                  <span>{budgetImpact}% of $2,000</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${parseFloat(budgetImpact) >= 90 ? 'bg-red-500' : parseFloat(budgetImpact) >= 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, parseFloat(budgetImpact))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Provider Comparison */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Icon name="Lightbulb" size={16} className="text-yellow-400" />
              Cost Optimization Options
            </h3>
            <div className="space-y-2">
              {alternatives?.map((alt, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    alt?.recommended ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{alt?.provider}</span>
                      {alt?.recommended && <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">Current</span>}
                    </div>
                    {alt?.savings && (
                      <span className="text-xs text-green-400">Save ${alt?.savings}/mo</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-foreground">${alt?.price}/mo</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              AI Governor recommendation: Hetzner offers equivalent performance at 40% lower cost for Canary/Sanitizer servers.
            </p>
          </div>

          {/* Billing Cycle */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-medium text-foreground mb-3">Billing Cycle</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'monthly', label: 'Monthly', desc: 'Pay month-to-month', discount: null },
                { value: 'annual', label: 'Annual', desc: '2 months free', discount: '17% off' }
              ]?.map(cycle => (
                <button
                  key={cycle?.value}
                  onClick={() => updateConfig({ billingCycle: cycle?.value })}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    config?.billingCycle === cycle?.value ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="font-medium text-sm text-foreground">{cycle?.label}</div>
                  <div className="text-xs text-muted-foreground">{cycle?.desc}</div>
                  {cycle?.discount && <div className="text-xs text-green-400 mt-1">{cycle?.discount}</div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step4CostEstimate;
