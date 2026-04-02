import { useState } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';

import TimezoneMap from './components/TimezoneMap';
import DeliveryWindowChart from './components/DeliveryWindowChart';
import EngagementHeatmap from './components/EngagementHeatmap';
import SegmentSendTimeTable from './components/SegmentSendTimeTable';

const STOScheduler = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedTimezone, setSelectedTimezone] = useState('all');

  const segmentOptions = [
    { value: 'all', label: 'All Segments' },
    { value: 'platinum', label: 'Platinum' },
    { value: 'gold', label: 'Gold' },
    { value: 'silver', label: 'Silver' },
    { value: 'bronze', label: 'Bronze' },
    { value: 'lead', label: 'Lead' },
  ];

  const timezoneOptions = [
    { value: 'all', label: 'All Timezones' },
    { value: 'EST', label: 'EST (UTC-5)' },
    { value: 'CST', label: 'CST (UTC-6)' },
    { value: 'MST', label: 'MST (UTC-7)' },
    { value: 'PST', label: 'PST (UTC-8)' },
    { value: 'GMT', label: 'GMT (UTC+0)' },
    { value: 'CET', label: 'CET (UTC+1)' },
    { value: 'IST', label: 'IST (UTC+5:30)' },
    { value: 'JST', label: 'JST (UTC+9)' },
  ];

  const segmentStats = [
    { segment: 'Platinum', contacts: 6234, optimalHour: 9, timezone: 'EST', openRate: 68.4, deliveryWindow: '8AM-11AM', color: '#a855f7' },
    { segment: 'Gold', contacts: 18106, optimalHour: 10, timezone: 'EST/CST', openRate: 54.2, deliveryWindow: '9AM-12PM', color: '#eab308' },
    { segment: 'Silver', contacts: 12340, optimalHour: 14, timezone: 'Mixed', openRate: 38.7, deliveryWindow: '1PM-4PM', color: '#94a3b8' },
    { segment: 'Bronze', contacts: 6780, optimalHour: 18, timezone: 'PST/MST', openRate: 22.1, deliveryWindow: '5PM-8PM', color: '#ea580c' },
    { segment: 'Lead', contacts: 23450, optimalHour: 11, timezone: 'Mixed', openRate: 8.3, deliveryWindow: '10AM-1PM', color: '#475569' },
  ];

  const kpis = [
    { label: 'Avg Optimal Send Hour', value: '10:24 AM', icon: 'Clock', color: 'text-primary' },
    { label: 'Contacts Optimized', value: '66,910', icon: 'Users', color: 'text-success' },
    { label: 'Lift vs Batch Send', value: '+18.4%', icon: 'TrendingUp', color: 'text-success' },
    { label: 'Timezones Covered', value: '24', icon: 'Globe', color: 'text-primary' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-heading font-semibold text-foreground">STO Scheduler</h1>
            <p className="text-muted-foreground mt-1">Send Time Optimization — Optimal_Send_Time_Hour per contact segment with timezone mapping</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Segment:</label>
              <select
                value={selectedSegment}
                onChange={e => setSelectedSegment(e?.target?.value)}
                className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {segmentOptions?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Timezone:</label>
              <select
                value={selectedTimezone}
                onChange={e => setSelectedTimezone(e?.target?.value)}
                className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {timezoneOptions?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
              </select>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {kpis?.map(kpi => (
              <div key={kpi?.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={kpi?.icon} size={16} className={kpi?.color} />
                  <span className="text-xs text-muted-foreground">{kpi?.label}</span>
                </div>
                <div className={`text-2xl font-mono font-bold ${kpi?.color}`}>{kpi?.value}</div>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {/* Timezone World Map */}
            <TimezoneMap />
            {/* Delivery Window Analytics */}
            <DeliveryWindowChart selectedSegment={selectedSegment} />
          </div>

          {/* Engagement Heatmap */}
          <div className="mb-6">
            <EngagementHeatmap />
          </div>

          {/* Segment Distribution Table */}
          <SegmentSendTimeTable segmentStats={segmentStats} />
        </div>
      </main>
    </div>
  );
};

export default STOScheduler;
