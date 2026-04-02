import { useState } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import CompetitorGrid from './components/CompetitorGrid';
import TrendPanel from './components/TrendPanel';
import StrategicInsights from './components/StrategicInsights';
import SeedListManager from './components/SeedListManager';
import CompetitorActivityFeed from './components/CompetitorActivityFeed';
import TrendingTopics from './components/TrendingTopics';

const MarketIntelligenceDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('live-feed');
  const [lastUpdated] = useState(new Date());

  const tabs = [
    { id: 'live-feed', label: 'Live Activity Feed', icon: 'Activity' },
    { id: 'trending', label: 'Trending Topics', icon: 'TrendingUp' },
    { id: 'competitors', label: 'Competitor Analysis', icon: 'Users' },
    { id: 'trends', label: 'Market Trends', icon: 'BarChart2' },
    { id: 'insights', label: 'Strategic Insights', icon: 'Lightbulb' },
    { id: 'seedlists', label: 'Seed List Manager', icon: 'Mail' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-foreground">Market Intelligence</h1>
              <p className="text-muted-foreground mt-1">Live competitor tracking · NLP sentiment analysis · Trend detection</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-success font-medium">Live · RSS feeds active</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon name="RefreshCw" size={14} />
                <span>Updated {lastUpdated?.toLocaleTimeString()}</span>
              </div>
              <Button variant="outline" size="sm" iconName="Download" iconPosition="left">
                Export Report
              </Button>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Competitors Tracked', value: '5', icon: 'Users', color: 'text-primary', change: 'RSS feeds active' },
              { label: 'Campaigns Analyzed', value: '247', icon: 'Mail', color: 'text-success', change: '+34 this week' },
              { label: 'Trend Alerts', value: '12', icon: 'Bell', color: 'text-warning', change: '3 critical' },
              { label: 'Cron: Every 6h', value: '6h', icon: 'Clock', color: 'text-purple-400', change: 'Auto-refresh' },
            ]?.map(kpi => (
              <div key={kpi?.label} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name={kpi?.icon} size={18} className={kpi?.color} />
                  <span className="text-sm text-muted-foreground">{kpi?.label}</span>
                </div>
                <div className="text-3xl font-mono font-bold text-foreground">{kpi?.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{kpi?.change}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
            {tabs?.map(tab => (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab?.id
                    ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={16} />
                {tab?.label}
                {tab?.id === 'live-feed' && (
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'live-feed' && <CompetitorActivityFeed />}
          {activeTab === 'trending' && <TrendingTopics />}
          {activeTab === 'competitors' && <CompetitorGrid />}
          {activeTab === 'trends' && <TrendPanel />}
          {activeTab === 'insights' && <StrategicInsights />}
          {activeTab === 'seedlists' && <SeedListManager />}
        </div>
      </main>
    </div>
  );
};

export default MarketIntelligenceDashboard;
