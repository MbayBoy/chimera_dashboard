import { useState } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ABTestingEngine = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  const activeTests = [
    {
      id: 1,
      campaign: 'Spring Product Launch 2026',
      status: 'Running',
      startDate: '2026-02-23',
      testSegmentSize: 4523,
      totalAudience: 45230,
      variants: [
        { id: 'A', subject: 'Introducing Our Revolutionary New Product Line', sent: 905, opens: 298, openRate: 32.9, clicks: 67 },
        { id: 'B', subject: 'Your Exclusive First Look at Our New Products', sent: 905, opens: 341, openRate: 37.7, clicks: 89 },
        { id: 'C', subject: 'New Products That Will Change How You Work', sent: 905, opens: 312, openRate: 34.5, clicks: 71 },
        { id: 'D', subject: '[Name], We Built This For You', sent: 904, opens: 389, openRate: 43.0, clicks: 112 },
        { id: 'E', subject: 'The Product Launch You\'ve Been Waiting For', sent: 904, opens: 267, openRate: 29.5, clicks: 54 },
      ],
      winnerFound: true,
      winner: 'D',
      confidence: 97.3,
      remainingAudience: 40707,
    },
    {
      id: 2,
      campaign: 'Customer Re-engagement Campaign',
      status: 'Running',
      startDate: '2026-02-24',
      testSegmentSize: 1200,
      totalAudience: 12000,
      variants: [
        { id: 'A', subject: 'We Miss You! Here\'s 20% Off', sent: 400, opens: 88, openRate: 22.0, clicks: 21 },
        { id: 'B', subject: 'It\'s Been a While — Come Back for a Special Gift', sent: 400, opens: 104, openRate: 26.0, clicks: 28 },
        { id: 'C', subject: 'Your Account Has a Surprise Waiting', sent: 400, opens: 97, openRate: 24.3, clicks: 24 },
      ],
      winnerFound: false,
      winner: null,
      confidence: 68.4,
      remainingAudience: 10800,
    },
  ];

  const completedTests = [
    {
      id: 3,
      campaign: 'Weekly Newsletter - Feb 17',
      completedDate: '2026-02-18',
      winner: 'B',
      winnerSubject: 'This Week\'s Top Stories and Updates',
      winnerOpenRate: 31.2,
      lift: '+5.8%',
      totalSent: 28450,
    },
    {
      id: 4,
      campaign: 'Flash Sale Announcement',
      completedDate: '2026-02-15',
      winner: 'A',
      winnerSubject: '24-Hour Flash Sale — Up to 50% Off Everything!',
      winnerOpenRate: 28.9,
      lift: '+3.2%',
      totalSent: 78450,
    },
  ];

  const getWinnerVariant = (test) => test?.variants?.find(v => v?.id === test?.winner);
  const maxOpenRate = (test) => Math.max(...test?.variants?.map(v => v?.openRate));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-foreground">A/B Testing Engine</h1>
              <p className="text-muted-foreground mt-1">Autonomous multi-armed bandit testing with automatic winner deployment</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
              <Icon name="Brain" size={16} className="text-primary" />
              <span>Autopilot Optimization Active</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Active Tests', value: activeTests?.length, icon: 'FlaskConical', color: 'text-primary' },
              { label: 'Tests Completed', value: completedTests?.length, icon: 'CheckCircle', color: 'text-success' },
              { label: 'Avg Lift Achieved', value: '+4.5%', icon: 'TrendingUp', color: 'text-success' },
              { label: 'Emails Optimized', value: '106,900', icon: 'Mail', color: 'text-primary' },
            ]?.map(stat => (
              <div key={stat?.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={stat?.icon} size={16} className={stat?.color} />
                  <span className="text-xs text-muted-foreground">{stat?.label}</span>
                </div>
                <div className="text-2xl font-mono font-bold text-foreground">{stat?.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-border">
            {[{ id: 'active', label: 'Active Tests' }, { id: 'completed', label: 'Completed Tests' }]?.map(tab => (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab?.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab?.label}
              </button>
            ))}
          </div>

          {activeTab === 'active' && (
            <div className="space-y-6">
              {activeTests?.map(test => (
                <div key={test?.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{test?.campaign}</h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Started {test?.startDate}</span>
                          <span>Test segment: {test?.testSegmentSize?.toLocaleString()} ({Math.round(test?.testSegmentSize / test?.totalAudience * 100)}%)</span>
                          <span>Remaining: {test?.remainingAudience?.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {test?.winnerFound ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-3 py-1 bg-success/10 text-success rounded-full font-medium">Winner Found</span>
                            <span className="text-xs text-muted-foreground">{test?.confidence}% confidence</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs text-muted-foreground">Testing... {test?.confidence?.toFixed(0)}% confidence</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Bar Chart */}
                    <div className="mb-4">
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={test?.variants} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="id" tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            formatter={(val) => [`${val}%`, 'Open Rate']}
                          />
                          <Bar
                            dataKey="openRate"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            name="Open Rate"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Variant Table */}
                    <div className="space-y-2">
                      {test?.variants?.map(variant => (
                        <div
                          key={variant?.id}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            test?.winner === variant?.id
                              ? 'bg-success/10 border border-success/30' :'bg-muted'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            test?.winner === variant?.id ? 'bg-success text-white' : 'bg-border text-muted-foreground'
                          }`}>
                            {variant?.id}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{variant?.subject}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm flex-shrink-0">
                            <span className="text-muted-foreground font-mono">{variant?.sent}</span>
                            <span className={`font-mono font-bold ${
                              variant?.openRate === maxOpenRate(test) ? 'text-success' : 'text-foreground'
                            }`}>{variant?.openRate}%</span>
                            {test?.winner === variant?.id && (
                              <Icon name="Trophy" size={14} className="text-success" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {test?.winnerFound && (
                      <div className="mt-4 p-3 bg-success/5 border border-success/20 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name="Zap" size={16} className="text-success" />
                          <span className="text-sm text-foreground">
                            Variant <strong>{test?.winner}</strong> wins with {getWinnerVariant(test)?.openRate}% open rate.
                            Auto-sending to {test?.remainingAudience?.toLocaleString()} remaining contacts.
                          </span>
                        </div>
                        <span className="text-xs text-success font-medium">Auto-deploying</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'completed' && (
            <div className="space-y-4">
              {completedTests?.map(test => (
                <div key={test?.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{test?.campaign}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Completed {test?.completedDate} • {test?.totalSent?.toLocaleString()} total sent</p>
                    </div>
                    <span className="text-sm font-bold text-success">{test?.lift} lift</span>
                  </div>
                  <div className="mt-3 p-3 bg-success/5 border border-success/20 rounded-lg flex items-center gap-3">
                    <Icon name="Trophy" size={16} className="text-success flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground">Winner (Variant {test?.winner}): </span>
                      <span className="text-sm text-foreground">{test?.winnerSubject}</span>
                      <span className="text-xs text-success ml-2">{test?.winnerOpenRate}% open rate</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ABTestingEngine;
