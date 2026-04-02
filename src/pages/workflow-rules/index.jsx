import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import RuleBuilderModal from './components/RuleBuilderModal';
import RulesListTable from './components/RulesListTable';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';

const WorkflowRules = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [stats, setStats] = useState({ total: 0, enabled: 0, triggered_today: 0 });
  const channelRef = useRef(null);
  const toast = useToast();

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase?.from('workflow_rules')?.select('*')?.order('priority', { ascending: false })?.order('created_at', { ascending: false });
      if (error) throw error;
      const ruleList = data || [];
      setRules(ruleList);
      const today = new Date();
      today?.setHours(0, 0, 0, 0);
      setStats({
        total: ruleList?.length,
        enabled: ruleList?.filter(r => r?.enabled)?.length,
        triggered_today: ruleList?.filter(r => r?.last_triggered_at && new Date(r.last_triggered_at) >= today)?.length,
      });
    } catch (err) {
      console.error('Load rules error:', err);
      toast?.error(err?.message || 'Failed to load workflow rules', 'Load Error');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();

    // Real-time subscription to workflow_rules table
    channelRef.current = supabase
      ?.channel('workflow_rules_rt')
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_rules' }, (payload) => {
        if (payload?.eventType === 'INSERT') {
          setRules(prev => [payload?.new, ...prev]);
          setStats(prev => ({ ...prev, total: prev?.total + 1, enabled: payload?.new?.enabled ? prev?.enabled + 1 : prev?.enabled }));
        } else if (payload?.eventType === 'UPDATE') {
          setRules(prev => prev?.map(r => r?.id === payload?.new?.id ? payload?.new : r));
        } else if (payload?.eventType === 'DELETE') {
          setRules(prev => prev?.filter(r => r?.id !== payload?.old?.id));
          setStats(prev => ({ ...prev, total: Math.max(0, prev?.total - 1) }));
        }
      })
      ?.subscribe();

    return () => { if (channelRef?.current) channelRef?.current?.unsubscribe(); };
  }, [loadRules]);

  const handleSaveRule = async (formData) => {
    setSaving(true);
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticRule = { id: tempId, ...formData, user_id: user?.id, trigger_count: 0, created_at: new Date()?.toISOString() };

    if (!editingRule) {
      setRules(prev => [optimisticRule, ...prev]);
    }

    try {
      if (editingRule) {
        const { error } = await supabase?.from('workflow_rules')?.update({
          name: formData?.name,
          trigger_type: formData?.trigger_type,
          conditions: formData?.conditions,
          actions: formData?.actions,
          enabled: formData?.enabled,
          priority: formData?.priority,
          updated_at: new Date()?.toISOString(),
        })?.eq('id', editingRule?.id);
        if (error) throw error;
        toast?.success('Rule updated successfully');
      } else {
        const { error } = await supabase?.from('workflow_rules')?.insert({
          user_id: user?.id,
          name: formData?.name,
          trigger_type: formData?.trigger_type,
          conditions: formData?.conditions,
          actions: formData?.actions,
          enabled: formData?.enabled,
          priority: formData?.priority,
          trigger_count: 0,
        });
        if (error) throw error;
        // Remove optimistic entry (real-time will add the real one)
        setRules(prev => prev?.filter(r => r?.id !== tempId));
        toast?.success('Rule created successfully');
      }
      setShowModal(false);
      setEditingRule(null);
      await loadRules();
    } catch (err) {
      // Rollback optimistic update on error
      if (!editingRule) {
        setRules(prev => prev?.filter(r => r?.id !== tempId));
      }
      console.error('Save rule error:', err);
      toast?.error(err?.message || 'Failed to save rule', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id, enabled) => {
    // Optimistic update
    setRules(prev => prev?.map(r => r?.id === id ? { ...r, enabled } : r));
    try {
      const { error } = await supabase?.from('workflow_rules')?.update({ enabled, updated_at: new Date()?.toISOString() })?.eq('id', id);
      if (error) throw error;
      setStats(prev => ({ ...prev, enabled: rules?.filter(r => r?.id === id ? enabled : r?.enabled)?.length }));
    } catch (err) {
      // Rollback
      setRules(prev => prev?.map(r => r?.id === id ? { ...r, enabled: !enabled } : r));
      toast?.error('Failed to update rule status', 'Toggle Error');
    }
  };

  const handleDelete = async (id) => {
    // Optimistic update
    const deletedRule = rules?.find(r => r?.id === id);
    setRules(prev => prev?.filter(r => r?.id !== id));
    try {
      const { error } = await supabase?.from('workflow_rules')?.delete()?.eq('id', id);
      if (error) throw error;
      toast?.success('Rule deleted successfully');
      setDeleteConfirm(null);
      await loadRules();
    } catch (err) {
      // Rollback
      if (deletedRule) setRules(prev => [...prev, deletedRule]);
      toast?.error('Failed to delete rule', 'Delete Error');
    }
  };

  const handleEdit = (rule) => { setEditingRule(rule); setShowModal(true); };
  const handleCreate = () => { setEditingRule(null); setShowModal(true); };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-heading font-semibold text-foreground">Workflow Rules</h1>
              <p className="text-muted-foreground mt-1 text-sm">Automate system responses with IF-THEN rule logic</p>
            </div>
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Icon name="Plus" size={16} />
              Create New Rule
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Rules', value: stats?.total, icon: 'GitBranch', color: 'text-primary' },
              { label: 'Active Rules', value: stats?.enabled, icon: 'CheckCircle', color: 'text-success' },
              { label: 'Triggered Today', value: stats?.triggered_today, icon: 'Zap', color: 'text-warning' },
            ]?.map(stat => (
              <div key={stat?.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{stat?.label}</span>
                  <Icon name={stat?.icon} size={16} className={stat?.color} />
                </div>
                <p className="text-2xl font-bold font-mono text-foreground">{stat?.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 p-4 mb-6 bg-primary/5 border border-primary/20 rounded-xl">
            <Icon name="Info" size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">How rules work: </span>
              Rules are evaluated in priority order (highest first) whenever anomalies are detected or thresholds are crossed.
              When a rule matches, the specified action executes automatically and is logged to the system audit trail.
            </div>
          </div>

          <RulesListTable rules={rules} loading={loading} onEdit={handleEdit} onDelete={(id) => setDeleteConfirm(id)} onToggle={handleToggle} />
        </div>
      </main>

      {showModal && (
        <RuleBuilderModal rule={editingRule} onSave={handleSaveRule} onClose={() => { setShowModal(false); setEditingRule(null); }} saving={saving} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <Icon name="Trash2" size={18} className="text-error" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Delete Rule</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this workflow rule? All associated configuration will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-error text-white rounded-lg text-sm font-medium hover:bg-error/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowRules;
