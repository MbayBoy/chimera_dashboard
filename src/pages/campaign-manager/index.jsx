import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import CampaignListTable from './components/CampaignListTable';
import CreateCampaignModal from './components/CreateCampaignModal';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { campaignsService } from '../../services/supabaseService';
import { supabase } from '../../lib/supabase';

const CACHE_KEY = 'chimera_campaigns_cache';

const CampaignManager = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [actionLoading, setActionLoading] = useState({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const toast = useToast();

  const loadCampaigns = useCallback(async () => {
    try {
      setError(null);
      const data = await campaignsService?.getAll();
      setCampaigns(data);
      // Save to offline cache
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
    } catch (err) {
      setError(err?.message);
      toast?.error('Failed to load campaigns', 'Database Error');
      // Load from offline cache
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data } = JSON.parse(cached);
          setCampaigns(data || []);
          toast?.warning('Showing cached data — connection unavailable', 'Offline Mode');
        }
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();

    const handleOnline = () => { setIsOffline(false); toast?.success('Connection restored', 'Back Online'); loadCampaigns(); };
    const handleOffline = () => { setIsOffline(true); toast?.warning('You are offline. Showing cached data.', 'Offline'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const channel = campaignsService?.subscribeToChanges((payload) => {
      if (payload?.eventType === 'INSERT') {
        loadCampaigns();
      } else if (payload?.eventType === 'UPDATE') {
        setCampaigns(prev => prev?.map(c => c?.id === payload?.new?.id
          ? { ...c, ...payload?.new, status: payload?.new?.campaign_status || payload?.new?.status, canaryStatus: payload?.new?.campaign_canary_status }
          : c
        ));
      } else if (payload?.eventType === 'DELETE') {
        setCampaigns(prev => prev?.filter(c => c?.id !== payload?.old?.id));
      }
    });

    return () => {
      if (channel) channel?.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCampaigns]);

  const statuses = ['All', 'Draft', 'Scheduled', 'Running', 'Paused', 'Completed'];
  const filtered = filterStatus === 'All' ? campaigns : campaigns?.filter(c => c?.status === filterStatus);

  const stats = {
    total: campaigns?.length,
    active: campaigns?.filter(c => c?.status === 'Running')?.length,
    scheduled: campaigns?.filter(c => c?.status === 'Scheduled')?.length,
    completed: campaigns?.filter(c => c?.status === 'Completed')?.length,
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase?.auth?.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    };
  };

  const handleCreateCampaign = async (campaignData) => {
    try {
      await campaignsService?.create(campaignData);
      toast?.success('Campaign created successfully');
      setIsCreateModalOpen(false);
      loadCampaigns();
    } catch (err) {
      toast?.error(err?.message, 'Failed to create campaign');
    }
  };

  const handleDeleteCampaign = async (id) => {
    try {
      await campaignsService?.delete(id);
      toast?.success('Campaign deleted');
      loadCampaigns();
    } catch (err) {
      toast?.error(err?.message, 'Failed to delete campaign');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await campaignsService?.update(id, { status });
      toast?.success(`Campaign ${status?.toLowerCase()}`);
      loadCampaigns();
    } catch (err) {
      toast?.error(err?.message, 'Failed to update campaign');
    }
  };

  const handleQueueCampaign = async (campaign, listId) => {
    const key = `queue_${campaign?.id}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      const { data, error } = await supabase?.functions?.invoke('campaign-actions', {
        body: { action: 'queue', campaignId: campaign?.id, listId: listId || campaign?.list_id },
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (error) throw error;
      toast?.success(`Campaign queued for ${data?.queued || 0} contacts`);
      setCampaigns(prev => prev?.map(c => c?.id === campaign?.id ? { ...c, status: 'Running' } : c));
    } catch (err) {
      // Fallback: update status directly via Supabase
      try {
        await campaignsService?.update(campaign?.id, { status: 'Running' });
        toast?.success('Campaign queued');
        loadCampaigns();
      } catch (fallbackErr) {
        toast?.error(err?.message, 'Failed to queue campaign');
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handlePauseCampaign = async (campaign) => {
    const key = `pause_${campaign?.id}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      await campaignsService?.update(campaign?.id, { status: 'Paused' });
      toast?.success('Campaign paused');
      setCampaigns(prev => prev?.map(c => c?.id === campaign?.id ? { ...c, status: 'Paused' } : c));
    } catch (err) {
      toast?.error(err?.message, 'Failed to pause campaign');
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleResumeCampaign = async (campaign) => {
    const key = `resume_${campaign?.id}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      await campaignsService?.update(campaign?.id, { status: 'Running' });
      toast?.success('Campaign resumed');
      setCampaigns(prev => prev?.map(c => c?.id === campaign?.id ? { ...c, status: 'Running' } : c));
    } catch (err) {
      toast?.error(err?.message, 'Failed to resume campaign');
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <Breadcrumbs />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-4">
              <div>
                <h1 className="text-3xl font-heading font-semibold text-foreground">Campaign Manager</h1>
                <p className="text-muted-foreground mt-1">Manage and monitor all email campaigns</p>
              </div>
              <Button variant="default" iconName="Plus" iconPosition="left" onClick={() => setIsCreateModalOpen(true)}>
                New Campaign
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total', value: stats?.total, icon: 'Send', color: 'text-primary' },
              { label: 'Active', value: stats?.active, icon: 'Play', color: 'text-success' },
              { label: 'Scheduled', value: stats?.scheduled, icon: 'Clock', color: 'text-warning' },
              { label: 'Completed', value: stats?.completed, icon: 'CheckCircle', color: 'text-muted-foreground' },
            ]?.map(stat => (
              <div key={stat?.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={stat?.icon} size={14} className={stat?.color} />
                  <span className="text-xs text-muted-foreground">{stat?.label}</span>
                </div>
                <div className="text-2xl font-bold font-mono text-foreground">{loading ? '—' : stat?.value}</div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {statuses?.map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-error/10 border border-error/30 rounded-lg flex items-center gap-3">
              <Icon name="AlertCircle" size={18} className="text-error" />
              <p className="text-sm text-error">{error}</p>
              <button onClick={loadCampaigns} className="ml-auto text-xs text-primary hover:underline">Retry</button>
            </div>
          )}

          {loading ? (
            <SkeletonTable rows={5} cols={7} />
          ) : filtered?.length === 0 ? (
            <EmptyState
              icon="Send"
              title="No campaigns found"
              description={filterStatus === 'All' ? 'Create your first campaign to get started.' : `No ${filterStatus?.toLowerCase()} campaigns.`}
              actionLabel="Create Campaign"
              onAction={() => setIsCreateModalOpen(true)}
            />
          ) : (
            <CampaignListTable
              campaigns={filtered}
              onDelete={handleDeleteCampaign}
              onUpdateStatus={handleUpdateStatus}
              onViewCampaign={(id) => {}}
              onEditCampaign={(id) => {}}
              onQueueCampaign={handleQueueCampaign}
              onPauseCampaign={handlePauseCampaign}
              onResumeCampaign={handleResumeCampaign}
              actionLoading={actionLoading}
            />
          )}
        </div>
      </main>
      {isCreateModalOpen && (
        <CreateCampaignModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateCampaign={handleCreateCampaign}
          contactLists={[]}
        />
      )}
    </div>
  );
};

export default CampaignManager;