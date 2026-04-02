import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const AIInsightsPanel = () => {
  const [activeSection, setActiveSection] = useState('anomaly');

  const anomalies = [
    { id: 1, severity: 'CRITICAL', metric: 'Platinum List Open Rate', baseline: '42.3%', current: '20.1%', deviation: '-52.5%', detected: '8 min ago', action: 'Investigating list poisoning. Win-back campaign auto-enrolled for 1,240 contacts.' },
    { id: 2, severity: 'HIGH', metric: 'srv-prod-03 Bounce Rate', baseline: '0.8%', current: '3.2%', deviation: '+300%', detected: '45 min ago', action: 'Server moved to Canary mode. Sending limit reduced to 5,000/day.' },
    { id: 3, severity: 'MEDIUM', metric: 'Campaign Queue Depth', baseline: '12,400', current: '89,200', deviation: '+619%', detected: '2 hours ago', action: 'Auto-provisioning new Canary server. ETA: 15 minutes.' }
  ];

  const stoStats = [
    { segment: 'Platinum', contacts: 8920, avgOptimalHour: '9:00 AM', improvement: '+18.4%', timezone: 'EST' },
    { segment: 'Gold', contacts: 24300, avgOptimalHour: '11:00 AM', improvement: '+12.1%', timezone: 'Mixed' },
    { segment: 'Silver', contacts: 41200, avgOptimalHour: '2:00 PM', improvement: '+8.7%', timezone: 'Mixed' },
    { segment: 'Bronze', contacts: 15600, avgOptimalHour: '7:00 PM', improvement: '+5.2%', timezone: 'PST' }
  ];

  const scalingPredictions = [
    { day: 'Today', queued: 124000, capacity: 180000, utilization: 69, status: 'OK' },
    { day: 'Tomorrow', queued: 156000, capacity: 180000, utilization: 87, status: 'WARNING' },
    { day: 'Day 3', queued: 198000, capacity: 180000, utilization: 110, status: 'CRITICAL' },
    { day: 'Day 4', queued: 210000, capacity: 260000, utilization: 81, status: 'OK' },
    { day: 'Day 5', queued: 185000, capacity: 260000, utilization: 71, status: 'OK' },
    { day: 'Day 6', queued: 142000, capacity: 260000, utilization: 55, status: 'OK' },
    { day: 'Day 7', queued: 167000, capacity: 260000, utilization: 64, status: 'OK' }
  ];

  const abTests = [
    { campaign: 'Spring Promo', variants: 5, testSize: '10%', winner: 'Variant C', improvement: '+5.2%', status: 'Completed', sent: '90% deployed' },
    { campaign: 'Re-engagement Q2', variants: 3, testSize: '10%', winner: 'Pending', improvement: 'TBD', status: 'Running', sent: 'Testing phase' },
    { campaign: 'Product Launch', variants: 5, testSize: '10%', winner: 'Variant A', improvement: '+8.1%', status: 'Completed', sent: '90% deployed' }
  ];

  const sections = [
    { id: 'anomaly', label: 'Anomaly Detection', icon: 'AlertOctagon' },
    { id: 'sto', label: 'Send Time Optimization', icon: 'Clock' },
    { id: 'scaling', label: 'Predictive Scaling', icon: 'TrendingUp' },
    { id: 'ab', label: 'A/B Testing Engine', icon: 'FlaskConical' }
  ];

  const getSeverityStyle = (s) => {
    if (s === 'CRITICAL') return 'bg-red-500/10 text-red-400 border border-red-500/30';
    if (s === 'HIGH') return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
    return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30';
  };

  const getUtilColor = (u) => {
    if (u >= 100) return 'bg-red-500';
    if (u >= 85) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
            <Icon name="Brain" size={20} className="text-primary" />
            AI Insights & Predictive Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Chimera v5.0 autonomous monitoring and optimization</p>
        </div>

        <div className="flex items-center gap-1 p-4 border-b border-border overflow-x-auto">
          {sections?.map(s => (
            <button
              key={s?.id}
              onClick={() => setActiveSection(s?.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeSection === s?.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon name={s?.icon} size={14} />
              {s?.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeSection === 'anomaly' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <Icon name="Info" size={16} className="text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-400">Isolation Forest ML model analyzing 47 operational metrics. Baseline established over 30-day rolling window.</p>
              </div>
              {anomalies?.map(a => (
                <div key={a?.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${getSeverityStyle(a?.severity)}`}>{a?.severity}</span>
                      <span className="font-medium text-foreground">{a?.metric}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{a?.detected}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="bg-muted/50 rounded p-2 text-center">
                      <div className="text-xs text-muted-foreground">Baseline</div>
                      <div className="text-sm font-medium text-foreground">{a?.baseline}</div>
                    </div>
                    <div className="bg-muted/50 rounded p-2 text-center">
                      <div className="text-xs text-muted-foreground">Current</div>
                      <div className="text-sm font-medium text-red-400">{a?.current}</div>
                    </div>
                    <div className="bg-muted/50 rounded p-2 text-center">
                      <div className="text-xs text-muted-foreground">Deviation</div>
                      <div className="text-sm font-medium text-red-400">{a?.deviation}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded">
                    <Icon name="Zap" size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-green-400"><span className="font-medium">Auto-action:</span> {a?.action}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'sto' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <Icon name="Clock" size={16} className="text-purple-400 flex-shrink-0" />
                <p className="text-sm text-purple-400">STO Workflow analyzes Last_Open_Date patterns nightly. Each contact receives an individually scheduled send window based on their Optimal_Send_Time_Hour.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Segment', 'Contacts', 'Avg Optimal Hour', 'Open Rate Improvement', 'Primary Timezone']?.map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stoStats?.map((s, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{s?.segment}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{s?.contacts?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{s?.avgOptimalHour}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-green-400">{s?.improvement}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{s?.timezone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'scaling' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <Icon name="AlertTriangle" size={16} className="text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-yellow-400">Day 3 forecast exceeds 85% capacity threshold. Auto-provisioning triggered. New Canary server will be online in ~15 minutes.</p>
              </div>
              <div className="space-y-3">
                {scalingPredictions?.map((day, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16 flex-shrink-0">{day?.day}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${getUtilColor(day?.utilization)}`}
                        style={{ width: `${Math.min(100, day?.utilization)}%` }}
                      />
                      {day?.utilization > 100 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">OVER CAPACITY</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-sm font-medium w-12 text-right flex-shrink-0 ${
                      day?.utilization >= 100 ? 'text-red-400' : day?.utilization >= 85 ? 'text-yellow-400' : 'text-green-400'
                    }`}>{day?.utilization}%</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                      day?.status === 'CRITICAL' ? 'bg-red-500/10 text-red-400' :
                      day?.status === 'WARNING'? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'
                    }`}>{day?.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'ab' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <Icon name="FlaskConical" size={16} className="text-cyan-400 flex-shrink-0" />
                <p className="text-sm text-cyan-400">Multi-armed bandit algorithm tests 5 variants on 10% of list. Winner auto-deployed to remaining 90% once statistical significance is reached.</p>
              </div>
              <div className="space-y-3">
                {abTests?.map((test, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-foreground">{test?.campaign}</span>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        test?.status === 'Completed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>{test?.status}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Variants</div>
                        <div className="text-sm font-medium text-foreground">{test?.variants}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Test Size</div>
                        <div className="text-sm font-medium text-foreground">{test?.testSize}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Winner</div>
                        <div className="text-sm font-medium text-foreground">{test?.winner}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Improvement</div>
                        <div className={`text-sm font-medium ${test?.improvement !== 'TBD' ? 'text-green-400' : 'text-muted-foreground'}`}>{test?.improvement}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">{test?.sent}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInsightsPanel;
