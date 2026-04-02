import { useState } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const FinancialManagement = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(2000);
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState(2000);

  const costs = [
    { service: 'Server Infrastructure', provider: 'DigitalOcean', monthly: 480, projected: 520, status: 'On Track', category: 'Infrastructure', canOptimize: false },
    { service: 'Domain Registration', provider: 'Namecheap', monthly: 45, projected: 45, status: 'On Track', category: 'Domains', canOptimize: false },
    { service: 'Blacklist Monitoring', provider: 'MXToolbox API', monthly: 189, projected: 245, status: 'Over Budget', category: 'Monitoring', canOptimize: true, alternative: 'MultiRBL API ($45/mo)', savings: 144 },
    { service: 'Email Verification', provider: 'Internal Verifier', monthly: 0, projected: 0, status: 'On Track', category: 'Verification', canOptimize: false },
    { service: 'DNS Management', provider: 'Cloudflare', monthly: 20, projected: 20, status: 'On Track', category: 'Infrastructure', canOptimize: false },
    { service: 'AI/ML Processing', provider: 'Internal', monthly: 85, projected: 90, status: 'On Track', category: 'AI', canOptimize: false },
    { service: 'Backup Storage', provider: 'AWS S3', monthly: 32, projected: 35, status: 'On Track', category: 'Infrastructure', canOptimize: false },
  ];

  const totalMonthly = costs?.reduce((sum, c) => sum + c?.monthly, 0);
  const totalProjected = costs?.reduce((sum, c) => sum + c?.projected, 0);
  const budgetUsed = Math.round((totalMonthly / monthlyBudget) * 100);
  const potentialSavings = costs?.filter(c => c?.canOptimize)?.reduce((sum, c) => sum + (c?.savings || 0), 0);

  const monthlyTrend = [
    { month: 'Sep', actual: 780, budget: 2000 },
    { month: 'Oct', actual: 890, budget: 2000 },
    { month: 'Nov', actual: 1020, budget: 2000 },
    { month: 'Dec', actual: 1150, budget: 2000 },
    { month: 'Jan', actual: 820, budget: 2000 },
    { month: 'Feb', actual: totalMonthly, budget: monthlyBudget },
  ];

  const categoryData = [
    { name: 'Infrastructure', value: costs?.filter(c => c?.category === 'Infrastructure')?.reduce((s, c) => s + c?.monthly, 0) },
    { name: 'Monitoring', value: costs?.filter(c => c?.category === 'Monitoring')?.reduce((s, c) => s + c?.monthly, 0) },
    { name: 'Domains', value: costs?.filter(c => c?.category === 'Domains')?.reduce((s, c) => s + c?.monthly, 0) },
    { name: 'AI', value: costs?.filter(c => c?.category === 'AI')?.reduce((s, c) => s + c?.monthly, 0) },
  ];

  const statusColor = { 'On Track': 'text-success bg-success/10', 'Over Budget': 'text-error bg-error/10', 'Warning': 'text-warning bg-warning/10' };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-foreground">Financial Management</h1>
              <p className="text-muted-foreground mt-1">Budget tracking, cost optimization & autonomous financial management</p>
            </div>
            <Button variant="outline" size="sm" iconName="Download" iconPosition="left">Export Report</Button>
          </div>

          {/* Budget Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="md:col-span-2 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Monthly Budget</h3>
                {editingBudget ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={tempBudget}
                      onChange={e => setTempBudget(parseInt(e?.target?.value) || 0)}
                      className="w-24 px-2 py-1 bg-muted border border-primary rounded text-sm font-mono text-foreground outline-none"
                    />
                    <button onClick={() => { setMonthlyBudget(tempBudget); setEditingBudget(false); }} className="text-xs text-success hover:text-success/80">Save</button>
                    <button onClick={() => setEditingBudget(false)} className="text-xs text-muted-foreground">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setTempBudget(monthlyBudget); setEditingBudget(true); }} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                    <Icon name="Edit" size={12} /> Edit Budget
                  </button>
                )}
              </div>
              <div className="text-4xl font-mono font-bold text-foreground mb-1">${monthlyBudget?.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mb-4">Current spend: ${totalMonthly} ({budgetUsed}% used)</div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budgetUsed >= 90 ? 'bg-error' : budgetUsed >= 70 ? 'bg-warning' : 'bg-success'}`}
                  style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>$0</span>
                <span>${monthlyBudget?.toLocaleString()}</span>
              </div>
            </div>
            {[
              { label: 'Current Spend', value: `$${totalMonthly}`, sub: 'This month', icon: 'CreditCard', color: 'text-primary' },
              { label: 'Projected Spend', value: `$${totalProjected}`, sub: 'End of month', icon: 'TrendingUp', color: totalProjected > monthlyBudget ? 'text-error' : 'text-success' },
              { label: 'Potential Savings', value: `$${potentialSavings}`, sub: 'AI-identified', icon: 'Lightbulb', color: 'text-success' },
            ]?.map(kpi => (
              <div key={kpi?.label} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={kpi?.icon} size={16} className={kpi?.color} />
                  <span className="text-sm text-muted-foreground">{kpi?.label}</span>
                </div>
                <div className={`text-3xl font-mono font-bold ${kpi?.color}`}>{kpi?.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{kpi?.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Trend Chart */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Monthly Spend Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Actual" />
                  <Line type="monotone" dataKey="budget" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Budget" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Category Breakdown */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">By Category</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="$" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Service Cost Breakdown</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon name="Brain" size={14} className="text-primary" />
                <span>AI Governor monitoring costs</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {['Service', 'Provider', 'Monthly', 'Projected', 'Status', 'AI Recommendation']?.map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costs?.map((cost, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-foreground">{cost?.service}</div>
                        <div className="text-xs text-muted-foreground">{cost?.category}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{cost?.provider}</td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-foreground">${cost?.monthly}</td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">${cost?.projected}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor?.[cost?.status] || 'bg-muted text-muted-foreground'}`}>
                          {cost?.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cost?.canOptimize ? (
                          <div className="flex items-start gap-2">
                            <Icon name="Lightbulb" size={14} className="text-success mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-foreground">Switch to {cost?.alternative}</p>
                              <p className="text-xs text-success font-medium">Save ${cost?.savings}/mo</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Optimized</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50">
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-foreground">Total</td>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-foreground">${totalMonthly}</td>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-foreground">${totalProjected}</td>
                    <td colSpan={2} className="px-4 py-3 text-xs text-muted-foreground">
                      {totalProjected > monthlyBudget ? (
                        <span className="text-error">⚠ Projected to exceed budget by ${totalProjected - monthlyBudget}</span>
                      ) : (
                        <span className="text-success">✓ Within budget (${monthlyBudget - totalProjected} remaining)</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FinancialManagement;
