import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import { useAuth } from '../../contexts/AuthContext';
import { exportDeveloperDocsPDF } from '../../services/exportService';

const Sidebar = ({ isCollapsed = false, collapsed = false, onToggleCollapse, alertCounts = {} }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const sidebarCollapsed = isCollapsed || collapsed;

  const totalAlerts = (alertCounts?.total) || 0;
  const hasCritical = (alertCounts?.criticals || 0) > 0;

  const navItems = [
    { to: '/enhanced-system-overview', icon: 'LayoutDashboard', label: 'System Overview' },
    { to: '/war-room-dashboard', icon: 'Shield', label: 'War Room' },
    { to: '/ai-insights-dashboard', icon: 'BrainCircuit', label: 'AI Insights' },
    { to: '/campaign-manager', icon: 'Send', label: 'Campaigns' },
    { to: '/risk-aware-campaign-creator', icon: 'Target', label: 'Risk Creator' },
    { to: '/data-intelligence-hub', icon: 'BarChart3', label: 'Data Intelligence' },
    { to: '/contact-lists-management', icon: 'Users', label: 'Contact Lists' },
    { to: '/server-management', icon: 'Server', label: 'Server Management' },
    { to: '/server-provisioning-wizard', icon: 'PlusCircle', label: 'Add Server' },
    { to: '/server-autopsy', icon: 'Stethoscope', label: 'Server Autopsy' },
    { to: '/sto-scheduler', icon: 'Clock', label: 'STO Scheduler' },
    { to: '/anomaly-detection-dashboard', icon: 'Radar', label: 'Anomaly Detection' },
    { to: '/market-intelligence-dashboard', icon: 'TrendingUp', label: 'Market Intel' },
    { to: '/zero-click-campaign', icon: 'Zap', label: 'Zero-Click AI' },
    { to: '/financial-management', icon: 'DollarSign', label: 'Financial Mgmt' },
    { to: '/ab-testing-engine', icon: 'FlaskConical', label: 'A/B Testing' },
    { to: '/automation-hub', icon: 'Cpu', label: 'Automation Hub' },
    { to: '/system-health-check', icon: 'Activity', label: 'Health Check' },
    { to: '/cost-management-dashboard', icon: 'PieChart', label: 'Cost Management' },
    { to: '/backup-restore-management', icon: 'DatabaseBackup', label: 'Backup & Restore' },
    { to: '/user-management-rbac', icon: 'ShieldCheck', label: 'User Management' },
    { to: '/performance-monitoring-dashboard', icon: 'Gauge', label: 'Performance' },
    { to: '/notification-preferences', icon: 'BellRing', label: 'Notifications' },
    { to: '/workflow-rules', icon: 'GitBranch', label: 'Workflow Rules' },
    {
      to: '/system-health',
      icon: 'HeartPulse',
      label: 'System Health',
      badge: totalAlerts > 0 ? { count: totalAlerts, critical: hasCritical } : null,
    },
    {
      to: '/uptime-dashboard',
      icon: 'MonitorCheck',
      label: 'Uptime Dashboard',
    },
    {
      to: '/incident-response',
      icon: 'Siren',
      label: 'Incident Response',
    },
  ];

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isActivePath = (path) => location?.pathname === path;

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="mobile-menu-button"
        aria-label="Toggle mobile menu"
      >
        <Icon name={isMobileOpen ? 'X' : 'Menu'} size={24} />
      </button>
      {isMobileOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileOpen(false)} />
      )}
      <aside
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 50 }}
      >
        {/* Logo Header */}
        <div className="sidebar-header flex-shrink-0">
          <div className="sidebar-logo">
            <Icon name="Zap" size={28} className="sidebar-logo-icon" />
          </div>
          {!sidebarCollapsed && (
            <span className="ml-3 text-lg font-heading font-semibold text-foreground">
              Chimera
            </span>
          )}
        </div>

        {/* Scrollable Nav Area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          }}
        >
          <div className="sidebar-content">
            <nav className="space-y-1">
              {navItems?.map(item => (
                <Link
                  key={item?.to}
                  to={item?.to}
                  className={`sidebar-nav-item ${isActivePath(item?.to) ? 'active' : ''}`}
                  title={sidebarCollapsed ? item?.label : undefined}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Icon name={item?.icon} size={20} />
                  {!sidebarCollapsed && (
                    <span className="sidebar-nav-text text-sm font-medium flex-1">{item?.label}</span>
                  )}
                  {item?.badge && !sidebarCollapsed && (
                    <span className={`ml-auto px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[20px] text-center ${item?.badge?.critical ? 'bg-error text-white animate-pulse' : 'bg-warning text-white'}`}>
                      {item?.badge?.count}
                    </span>
                  )}
                  {item?.badge && sidebarCollapsed && (
                    <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${item?.badge?.critical ? 'bg-error' : 'bg-warning'}`} />
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Collapse Button - Fixed at Bottom */}
        <div className="flex-shrink-0 border-t border-border">
          {user && (
            <div className={`px-4 py-3 flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Icon name="User" size={14} className="text-primary" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium truncate">{user?.email}</p>
                </div>
              )}
              <button
                onClick={async () => { await signOut(); navigate('/login'); }}
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                title="Sign out"
              >
                <Icon name="LogOut" size={14} />
              </button>
            </div>
          )}
          <div className="px-4 pb-2">
            <button
              onClick={() => exportDeveloperDocsPDF()}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Download Developer Documentation PDF"
            >
              <Icon name="FileDown" size={18} />
              {!sidebarCollapsed && <span>Dev Docs</span>}
            </button>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={() => { if (onToggleCollapse) onToggleCollapse(); }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icon name={sidebarCollapsed ? 'ChevronRight' : 'ChevronLeft'} size={18} />
              {!sidebarCollapsed && <span>Collapse</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;