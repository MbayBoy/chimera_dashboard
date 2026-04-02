import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import AlertChannelSection from './components/AlertChannelSection';
import SeverityFiltersSection from './components/SeverityFiltersSection';
import QuietHoursSection from './components/QuietHoursSection';
import AlertSubscriptionsTable from './components/AlertSubscriptionsTable';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const DEFAULT_PREFS = {
  channels: { browser: true, email: false, sms: false },
  severities: { critical: true, high: true, medium: true, low: false },
  quietHours: { enabled: false, startTime: '23:00', endTime: '07:00', timezone: 'UTC' },
  subscriptions: {
    Server_Quarantined: true,
    Blacklist_Detected: true,
    Campaign_Failed: true,
    Bounce_Spike: true,
    Cost_Overrun: false,
    Reputation_Drop: true,
    Verification_Failed: false,
  },
};

const NotificationPreferences = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [savedPrefs, setSavedPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPrefs = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase?.from('user_profiles')?.select('notification_settings')?.eq('id', user?.id)?.single();
      if (!error && data?.notification_settings) {
        const merged = { ...DEFAULT_PREFS, ...data?.notification_settings };
        setPrefs(merged);
        setSavedPrefs(JSON.stringify(merged));
      } else {
        setSavedPrefs(JSON.stringify(DEFAULT_PREFS));
      }
    } catch (err) {
      console.error('Load prefs error:', err);
      setSavedPrefs(JSON.stringify(DEFAULT_PREFS));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const hasUnsavedChanges = savedPrefs !== JSON.stringify(prefs);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (user?.id) {
        const { error } = await supabase?.from('user_profiles')?.upsert({ id: user?.id, notification_settings: prefs, updated_at: new Date()?.toISOString() });
        if (error) throw error;
      }
      setSavedPrefs(JSON.stringify(prefs));
      showToast('Notification preferences saved successfully');
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save preferences. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      if (prefs?.channels?.browser && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification('Chimera Test Alert', {
            body: 'This is a test notification from Chimera. Your alert configuration is working correctly.',
            icon: '/favicon.ico',
          });
        }
      }
      await new Promise(r => setTimeout(r, 800));
      showToast('Test notification sent successfully');
    } catch (err) {
      showToast('Failed to send test notification', 'error');
    } finally {
      setTesting(false);
    }
  };

  const updateChannel = (key, val) => setPrefs(p => ({ ...p, channels: { ...p?.channels, [key]: val } }));
  const updateSeverity = (key, val) => setPrefs(p => ({ ...p, severities: { ...p?.severities, [key]: val } }));
  const updateQuietHours = (qh) => setPrefs(p => ({ ...p, quietHours: qh }));
  const updateSubscriptions = (subs) => setPrefs(p => ({ ...p, subscriptions: subs }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-heading font-semibold text-foreground">Notification Preferences</h1>
              <p className="text-muted-foreground mt-1 text-sm">Customize how and when you receive system alerts</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestNotification}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <Icon name={testing ? 'Loader' : 'BellRing'} size={15} className={testing ? 'animate-spin' : ''} />
                {testing ? 'Sending...' : 'Test Notification'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Icon name={saving ? 'Loader' : 'Save'} size={15} className={saving ? 'animate-spin' : ''} />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>

          {/* Unsaved changes warning */}
          {hasUnsavedChanges && !loading && (
            <div className="flex items-center gap-2 p-3 mb-6 bg-warning/10 border border-warning/30 rounded-lg">
              <Icon name="AlertTriangle" size={15} className="text-warning flex-shrink-0" />
              <p className="text-sm text-warning">You have unsaved changes. Click "Save Preferences" to apply them.</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1,2,3,4]?.map(i => <div key={i} className="h-40 bg-card border border-border rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-6">
              <AlertChannelSection channels={prefs?.channels} onChange={updateChannel} />
              <SeverityFiltersSection severities={prefs?.severities} onChange={updateSeverity} />
              <QuietHoursSection quietHours={prefs?.quietHours} onChange={updateQuietHours} />
              <AlertSubscriptionsTable subscriptions={prefs?.subscriptions} onChange={updateSubscriptions} />
            </div>
          )}
        </div>
      </main>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
          toast?.type === 'error' ?'bg-error/10 border-error/30 text-error' :'bg-success/10 border-success/30 text-success'
        }`}>
          <Icon name={toast?.type === 'error' ? 'XCircle' : 'CheckCircle'} size={16} />
          {toast?.message}
        </div>
      )}
    </div>
  );
};

export default NotificationPreferences;
