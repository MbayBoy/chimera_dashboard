import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import AnomalyGrid from './components/AnomalyGrid';

import TrendChart from './components/TrendChart';
import MonitoringPanel from './components/MonitoringPanel';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { anomaliesService } from '../../services/supabaseService';
import { exportAnomalyPDF, exportAnomalyCSV } from '../../services/exportService';
import { useAuth } from '../../contexts/AuthContext';

const AnomalyDetectionDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const loadAnomalies = useCallback(async () => {
    try {
      const data = await anomaliesService?.getAll();
      setAnomalies(data);
    } catch (err) {
      toast?.error('Failed to load anomalies', 'Database Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnomalies();
    const channel = anomaliesService?.subscribeToChanges((payload) => {
      if (payload?.eventType === 'INSERT') {
        loadAnomalies();
        toast?.warning('New anomaly detected: ' + payload?.new?.title, 'Anomaly Alert');
      } else if (payload?.eventType === 'UPDATE') {
        setAnomalies(prev => prev?.map(a => a?.id === payload?.new?.id
          ? { ...a, isResolved: payload?.new?.is_resolved, remediationAction: payload?.new?.remediation_action }
          : a
        ));
      }
    });
    return () => { if (channel) channel?.unsubscribe(); };
  }, [loadAnomalies]);

  const handleRemediate = async (anomalyId, action) => {
    try {
      await anomaliesService?.resolve(anomalyId, action);
      toast?.success('Remediation action applied');
      loadAnomalies();
    } catch (err) {
      toast?.error(err?.message, 'Remediation failed');
    }
  };

  const handleExportPDF = () => {
    setShowExportMenu(false);
    exportAnomalyPDF({
      anomalies,
      generatedBy: user?.email || 'System',
      dateRange: `As of ${new Date()?.toLocaleString()}`,
    });
  };

  const handleExportCSV = () => {
    setShowExportMenu(false);
    exportAnomalyCSV({ anomalies });
  };

  const severities = ['All', 'Critical', 'High', 'Medium', 'Low'];
  const filtered = filterSeverity === 'All' ? anomalies : anomalies?.filter(a => a?.severity === filterSeverity);
  const active = anomalies?.filter(a => !a?.isResolved);
  const critical = active?.filter(a => a?.severity === 'Critical')?.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className={`pt-20 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-semibold text-foreground">Anomaly Detection</h1>
              <p className="text-muted-foreground mt-1">Real-time operational anomaly monitoring and remediation</p>
            </div>
            <div className="flex items-center gap-3">
              {critical > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-error/10 border border-error/30 rounded-lg">
                  <Icon name="AlertCircle" size={16} className="text-error" />
                  <span className="text-sm font-medium text-error">{critical} Critical</span>
                </div>
              )}
              {/* Export Button */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="Download" size={14} />
                  Export Report
                  <Icon name="ChevronDown" size={12} />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Icon name="FileText" size={14} className="text-red-400" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Icon name="Table" size={14} className="text-green-400" />
                      Export as CSV
                    </button>
                  </div>
                )}
              </div>
              <button onClick={loadAnomalies} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="RefreshCw" size={14} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Anomalies', value: active?.length, icon: 'Radar', color: 'text-error' },
              { label: 'Critical', value: critical, icon: 'AlertCircle', color: 'text-error' },
              { label: 'Resolved Today', value: anomalies?.filter(a => a?.isResolved)?.length, icon: 'CheckCircle', color: 'text-success' },
              { label: 'Total Detected', value: anomalies?.length, icon: 'Activity', color: 'text-primary' },
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

          {/* Filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {severities?.map(s => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterSeverity === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              {loading ? (
                <SkeletonTable rows={4} cols={5} />
              ) : filtered?.length === 0 ? (
                <EmptyState 
                  icon="Radar" 
                  title="No anomalies detected" 
                  description="All systems operating within normal parameters." 
                  actionLabel=""
                  onAction={() => {}}
                />
              ) : (
                <AnomalyGrid
                  anomalies={filtered}
                  selectedAnomaly={selectedAnomaly}
                  onSelect={setSelectedAnomaly}
                  onRemediate={handleRemediate}
                />
              )}
            </div>
            <div className="space-y-6">
              <TrendChart anomalies={anomalies} />
              <MonitoringPanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AnomalyDetectionDashboard;
