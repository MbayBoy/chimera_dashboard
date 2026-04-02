import { useState } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';

import ABTestsPanel from './components/ABTestsPanel';
import SelfHealingDNSPanel from './components/SelfHealingDNSPanel';
import StrategistAICampaigns from './components/StrategistAICampaigns';

const TABS = [
  { id: 'ab-tests', label: 'Active A/B Tests', icon: 'FlaskConical', badge: '2 running' },
  { id: 'dns', label: 'Self-Healing DNS', icon: 'Shield', badge: '1 retrying' },
  { id: 'ai-campaigns', label: 'Strategist AI Campaigns', icon: 'Brain', badge: '2 pending' },
];

const AutomationHub = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('ab-tests');

  const stats = [
    { label: 'Active A/B Tests', value: '2', icon: 'FlaskConical', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'DNS Auto-Fixes Today', value: '4', icon: 'Shield', color: 'text-success', bg: 'bg-success/10' },
    { label: 'AI Campaigns Pending', value: '2', icon: 'Brain', color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Auto-Deployments', value: '1', icon: 'Rocket', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <Breadcrumbs
              items={[
                { label: 'Home', path: '/' },
                { label: 'Automation Hub', path: '/automation-hub' }
              ]}
            />

            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="Cpu" size={20} className="text-primary" />
                  </div>
                  <h1 className="text-3xl font-heading font-bold text-foreground">
                    Automation Hub
                  </h1>
                </div>
                <p className="text-muted-foreground">
                  Centralized intelligent automation — A/B testing, self-healing DNS, and AI-generated campaigns
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-success/10 rounded-lg border border-success/20">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-success font-medium">All Systems Operational</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {stats?.map(stat => (
                <div key={stat?.label} className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat?.bg}`}>
                      <Icon name={stat?.icon} size={16} className={stat?.color} />
                    </div>
                    <span className="text-xs text-muted-foreground">{stat?.label}</span>
                  </div>
                  <div className={`text-2xl font-heading font-bold ${stat?.color}`}>{stat?.value}</div>
                </div>
              ))}
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 bg-muted rounded-lg p-1">
              {TABS?.map(tab => (
                <button
                  key={tab?.id}
                  onClick={() => setActiveTab(tab?.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                    activeTab === tab?.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={tab?.icon} size={16} />
                  <span className="hidden sm:inline">{tab?.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab?.id ? 'bg-primary/10 text-primary' : 'bg-border text-muted-foreground'
                  }`}>
                    {tab?.badge}
                  </span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'ab-tests' && <ABTestsPanel />}
              {activeTab === 'dns' && <SelfHealingDNSPanel />}
              {activeTab === 'ai-campaigns' && <StrategistAICampaigns />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AutomationHub;
