import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import ServerCard from './components/ServerCard';
import AddServerWizard from './components/AddServerWizard';
import RemoveServerModal from './components/RemoveServerModal';
import { SkeletonGrid } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { serversService } from '../../services/supabaseService';

const ServerManagement = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [serverToRemove, setServerToRemove] = useState(null);
  const [filterPurpose, setFilterPurpose] = useState('All');
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const purposes = ['All', 'Production', 'Canary', 'Sanitizer', 'HotSpare', 'Verifier'];

  const loadServers = useCallback(async () => {
    try {
      setError(null);
      const data = await serversService?.getAll();
      setServers(data);
    } catch (err) {
      setError(err?.message);
      toast?.error('Failed to load servers', 'Database Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
    const channel = serversService?.subscribeToChanges((payload) => {
      if (payload?.eventType === 'INSERT') {
        loadServers();
      } else if (payload?.eventType === 'UPDATE') {
        setServers(prev => prev?.map(s => s?.id === payload?.new?.id ? { ...s, status: payload?.new?.server_status, reputation: payload?.new?.reputation_score } : s));
      } else if (payload?.eventType === 'DELETE') {
        setServers(prev => prev?.filter(s => s?.id !== payload?.old?.id));
      }
    });
    return () => { if (channel) channel?.unsubscribe(); };
  }, [loadServers]);

  const filtered = filterPurpose === 'All' ? servers : servers?.filter(s => s?.purpose === filterPurpose);

  const stats = {
    total: servers?.length,
    active: servers?.filter(s => s?.status === 'Active')?.length,
    warning: servers?.filter(s => s?.status === 'Warning')?.length,
    quarantined: servers?.filter(s => s?.status === 'Quarantined')?.length,
    totalCapacity: servers?.reduce((sum, s) => sum + (s?.dailyLimit || 0), 0),
    usedCapacity: servers?.reduce((sum, s) => sum + (s?.dailySent || 0), 0),
  };

  const handleAddServer = async (newServer) => {
    try {
      await serversService?.create(newServer);
      toast?.success('Server added successfully');
      setShowAddWizard(false);
      loadServers();
    } catch (err) {
      toast?.error(err?.message, 'Failed to add server');
    }
  };

  const handleRemoveServer = async (server) => {
    try {
      await serversService?.delete(server?.id);
      toast?.success(`${server?.name} removed from fleet`);
      setServerToRemove(null);
      loadServers();
    } catch (err) {
      toast?.error(err?.message, 'Failed to remove server');
    }
  };

  const handleStatusChange = async (serverId, newStatus) => {
    try {
      await serversService?.update(serverId, { status: newStatus });
      toast?.success(`Server status updated to ${newStatus}`);
    } catch (err) {
      toast?.error(err?.message, 'Failed to update status');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-foreground">Server Management</h1>
              <p className="text-muted-foreground mt-1">Add, configure, and remove mail servers from your fleet</p>
            </div>
            <Button variant="default" iconName="Plus" iconPosition="left" onClick={() => setShowAddWizard(true)}>
              Add New Server
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Total Servers', value: stats?.total, icon: 'Server', color: 'text-primary' },
              { label: 'Active', value: stats?.active, icon: 'CheckCircle', color: 'text-success' },
              { label: 'Warning', value: stats?.warning, icon: 'AlertTriangle', color: 'text-warning' },
              { label: 'Quarantined', value: stats?.quarantined, icon: 'Shield', color: 'text-error' },
              { label: 'Daily Capacity', value: stats?.totalCapacity?.toLocaleString(), icon: 'TrendingUp', color: 'text-primary' },
              { label: 'Sent Today', value: stats?.usedCapacity?.toLocaleString(), icon: 'Send', color: 'text-success' },
            ]?.map(stat => (
              <div key={stat?.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={stat?.icon} size={16} className={stat?.color} />
                  <span className="text-xs text-muted-foreground">{stat?.label}</span>
                </div>
                <div className="text-2xl font-bold font-mono text-foreground">{loading ? '—' : stat?.value}</div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {purposes?.map(p => (
              <button
                key={p}
                onClick={() => setFilterPurpose(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPurpose === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-lg flex items-center gap-3">
              <Icon name="AlertCircle" size={18} className="text-error" />
              <p className="text-sm text-error">{error}</p>
              <button onClick={loadServers} className="ml-auto text-xs text-primary hover:underline">Retry</button>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <SkeletonGrid items={6} />
          ) : filtered?.length === 0 ? (
            <EmptyState
              icon="Server"
              title="No servers found"
              description={filterPurpose === 'All' ? 'Add your first mail server to get started.' : `No ${filterPurpose} servers in your fleet.`}
              actionLabel="Add Server"
              onAction={() => setShowAddWizard(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered?.map(server => (
                <ServerCard
                  key={server?.id}
                  server={server}
                  onRemove={() => setServerToRemove(server)}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      {showAddWizard && (
        <AddServerWizard
          onAdd={handleAddServer}
          onClose={() => setShowAddWizard(false)}
        />
      )}
      {serverToRemove && (
        <RemoveServerModal
          server={serverToRemove}
          onConfirm={handleRemoveServer}
          onClose={() => setServerToRemove(null)}
        />
      )}
    </div>
  );
};

export default ServerManagement;
