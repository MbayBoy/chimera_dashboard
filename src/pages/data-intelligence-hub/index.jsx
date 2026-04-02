import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';
import DeliverabilityTester from './components/DeliverabilityTester';
import BlacklistMonitor from './components/BlacklistMonitor';
import ListCleanerVerifier from './components/ListCleanerVerifier';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

const DataIntelligenceHub = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('deliverability');
  const [contactStats, setContactStats] = useState({ total: 0, verified: 0, unverified: 0, invalid: 0 });
  const [listCount, setListCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const channelRef = useRef(null);
  const listsChannelRef = useRef(null);
  const toast = useToast();

  const loadStats = useCallback(async () => {
    try {
      const results = await Promise.all([
        supabase?.from('contacts')?.select('*', { count: 'exact', head: true }),
        supabase?.from('contacts')?.select('*', { count: 'exact', head: true })?.eq('contact_status', 'Active'),
        supabase?.from('contacts')?.select('*', { count: 'exact', head: true })?.eq('contact_status', 'Unverified'),
        supabase?.from('contacts')?.select('*', { count: 'exact', head: true })?.eq('contact_status', 'Invalid'),
        supabase?.from('contact_lists')?.select('*', { count: 'exact', head: true }),
      ]);
      const [{ count: total, error: e1 }, { count: verified, error: e2 }, { count: unverified, error: e3 }, { count: invalid, error: e4 }, { count: lists, error: e5 }] = results;
      if (e1) throw e1;
      setContactStats({ total: total || 0, verified: verified || 0, unverified: unverified || 0, invalid: invalid || 0 });
      setListCount(lists || 0);
    } catch (err) {
      toast?.error(err?.message || 'Failed to load contact stats', 'Data Error');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();

    // Real-time subscription to contacts table
    channelRef.current = supabase
      ?.channel('dih_contacts_rt')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        loadStats();
      })
      ?.subscribe();

    // Real-time subscription to contact_lists table
    listsChannelRef.current = supabase
      ?.channel('dih_lists_rt')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'contact_lists' }, () => {
        loadStats();
      })
      ?.subscribe();

    return () => {
      if (channelRef?.current) channelRef?.current?.unsubscribe();
      if (listsChannelRef?.current) listsChannelRef?.current?.unsubscribe();
    };
  }, [loadStats]);

  const tabs = [
    { id: 'deliverability', label: 'Deliverability Tester', icon: 'Mail' },
    { id: 'blacklist', label: 'Blacklist Monitor', icon: 'Shield' },
    { id: 'cleaner', label: 'List Cleaner / Verifier', icon: 'CheckCircle' }
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar collapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} currentSection="Data Intelligence" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Data Intelligence Hub', path: '/data-intelligence-hub' }]} />
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Data Intelligence Hub</h1>
                <p className="text-muted-foreground">Advanced analytics, testing, and verification tools for email marketing optimization</p>
              </div>
            </div>

            {/* Contact Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Contacts', value: contactStats?.total, icon: 'Users', color: 'text-primary' },
                { label: 'Verified', value: contactStats?.verified, icon: 'CheckCircle', color: 'text-success' },
                { label: 'Unverified', value: contactStats?.unverified, icon: 'Clock', color: 'text-warning' },
                { label: 'Contact Lists', value: listCount, icon: 'List', color: 'text-info' },
              ]?.map(stat => (
                <div key={stat?.label} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name={stat?.icon} size={14} className={stat?.color} />
                    <span className="text-xs text-muted-foreground">{stat?.label}</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {statsLoading ? '—' : stat?.value?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-lg border border-border mb-6">
              <div className="flex border-b border-border overflow-x-auto">
                {tabs?.map((tab) => (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab?.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon name={tab?.icon} size={18} />
                    {tab?.label}
                  </button>
                ))}
              </div>
              <div className="p-6">
                {activeTab === 'deliverability' && <DeliverabilityTester />}
                {activeTab === 'blacklist' && <BlacklistMonitor />}
                {activeTab === 'cleaner' && <ListCleanerVerifier />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DataIntelligenceHub;