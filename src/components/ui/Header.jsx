import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';



const Header = ({ alertCounts = {} }) => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'critical', message: 'Server srv-canary-01 quarantined', time: '5 min ago', read: false },
    { id: 2, type: 'warning', message: 'Blacklist detection on srv-prod-03', time: '15 min ago', read: false },
    { id: 3, type: 'info', message: 'Campaign "Spring Launch" completed', time: '1 hour ago', read: true },
    { id: 4, type: 'critical', message: 'DKIM validation failed for domain news1.com', time: '2 hours ago', read: false },
    { id: 5, type: 'warning', message: 'Anomaly detected: Platinum list open rate dropped 20%', time: '3 hours ago', read: true },
  ]);
  const [alerts] = useState([
    { id: 1, severity: 'critical', title: 'Server Quarantined', description: 'srv-canary-01 auto-quarantined due to reputation drop', time: '5 min ago', category: 'Infrastructure' },
    { id: 2, severity: 'high', title: 'Blacklist Detected', description: 'srv-prod-03 IP listed on Spamhaus ZEN', time: '15 min ago', category: 'Deliverability' },
    { id: 3, severity: 'medium', title: 'DKIM Mismatch', description: 'DNS Healer triggered for news1.com - auto-fix in progress', time: '32 min ago', category: 'DNS' },
    { id: 4, severity: 'low', title: 'Warmup Accelerated', description: 'srv-warm-02 daily limit increased to 4,500', time: '1 hour ago', category: 'Warmup' },
    { id: 5, severity: 'medium', title: 'Engagement Drop', description: 'Platinum list open rate -20% vs 7-day average', time: '2 hours ago', category: 'Analytics' },
  ]);
  const [healthMetrics] = useState({
    activeServers: 24,
    deliveryRate: 98.7,
    criticalAlerts: 2
  });

  const notifRef = useRef(null);
  const alertsRef = useRef(null);
  const settingsRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef?.current && !notifRef?.current?.contains(e?.target)) {
        setIsNotificationsOpen(false);
      }
      if (alertsRef?.current && !alertsRef?.current?.contains(e?.target)) {
        setIsAlertsOpen(false);
      }
      if (settingsRef?.current && !settingsRef?.current?.contains(e?.target)) {
        setIsSettingsOpen(false);
      }
      if (searchRef?.current && !searchRef?.current?.contains(e?.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications?.filter(n => !n?.read)?.length;
  const criticalAlertsCount = alerts?.filter(a => a?.severity === 'critical' || a?.severity === 'high')?.length;

  // Threshold breach counts from System Health
  const thresholdBreachCount = (alertCounts?.total) || 0;
  const hasThresholdCritical = (alertCounts?.criticals || 0) > 0;
  const bellBadgeCount = unreadCount + thresholdBreachCount;

  const markAllRead = () => {
    setNotifications(prev => prev?.map(n => ({ ...n, read: true })));
  };

  const markRead = (id) => {
    setNotifications(prev => prev?.map(n => n?.id === id ? { ...n, read: true } : n));
  };

  const getStatusColor = (alerts) => {
    if (alerts === 0) return 'text-success';
    if (alerts <= 2) return 'text-warning';
    return 'text-error';
  };

  const getNotifIcon = (type) => {
    if (type === 'critical') return { name: 'AlertCircle', color: 'text-error' };
    if (type === 'warning') return { name: 'AlertTriangle', color: 'text-warning' };
    return { name: 'Info', color: 'text-primary' };
  };

  const getAlertSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-error/10 text-error border-error/30';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
      case 'medium': return 'bg-warning/10 text-warning border-warning/30';
      case 'low': return 'bg-primary/10 text-primary border-primary/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getAlertDotColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-error';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-warning';
      case 'low': return 'bg-primary';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-100 bg-card border-b border-border transition-smooth ${
        isScrolled ? 'shadow-md' : ''
      }`}
    >
      <div className="flex items-center justify-between h-20 px-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 hover-lift">
            <div className="header-logo">
              <Icon name="Zap" size={24} className="header-logo-icon" />
            </div>
            <span className="text-xl font-heading font-semibold text-foreground">
              Chimera v5.0
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Icon name="Server" size={16} className="text-muted-foreground" />
              <span className="text-sm font-mono font-medium text-foreground">{healthMetrics?.activeServers}</span>
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Icon name="TrendingUp" size={16} className="text-success" />
              <span className="text-sm font-mono font-medium text-foreground">{healthMetrics?.deliveryRate}%</span>
              <span className="text-xs text-muted-foreground">Rate</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Icon name="AlertCircle" size={16} className={getStatusColor(healthMetrics?.criticalAlerts)} />
              <span className={`text-sm font-mono font-medium ${getStatusColor(healthMetrics?.criticalAlerts)}`}>
                {healthMetrics?.criticalAlerts}
              </span>
              <span className="text-xs text-muted-foreground">Alerts</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => { setIsSearchOpen(!isSearchOpen); setIsNotificationsOpen(false); setIsAlertsOpen(false); setIsSettingsOpen(false); }}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Search"
            >
              <Icon name="Search" size={20} />
            </button>
            {isSearchOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-card rounded-lg border border-border shadow-xl p-4 z-50">
                <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2">
                  <Icon name="Search" size={16} className="text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search campaigns, servers, contacts..."
                    className="flex-1 bg-transparent text-sm text-foreground outline-none"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e?.target?.value)}
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}>
                      <Icon name="X" size={14} className="text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Quick Links</p>
                  <div className="space-y-1">
                    {[
                      { label: 'Campaign Manager', to: '/campaign-manager', icon: 'Send' },
                      { label: 'Server Management', to: '/server-management', icon: 'Server' },
                      { label: 'Contact Lists', to: '/contact-lists-management', icon: 'Users' },
                      { label: 'Automation Hub', to: '/automation-hub', icon: 'Cpu' },
                    ]?.map(link => (
                      <Link
                        key={link?.to}
                        to={link?.to}
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors"
                      >
                        <Icon name={link?.icon} size={14} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">{link?.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alerts Button */}
          <div className="relative" ref={alertsRef}>
            <button
              onClick={() => { setIsAlertsOpen(!isAlertsOpen); setIsNotificationsOpen(false); setIsSettingsOpen(false); setIsSearchOpen(false); }}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="System Alerts"
            >
              <Icon name="AlertTriangle" size={20} />
              {criticalAlertsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {criticalAlertsCount}
                </span>
              )}
            </button>
            {isAlertsOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-card rounded-lg border border-border shadow-xl z-50">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">System Alerts</h3>
                  <span className="text-xs text-muted-foreground">{criticalAlertsCount} active</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {alerts?.map(alert => (
                    <div
                      key={alert?.id}
                      className="p-4 border-b border-border hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getAlertDotColor(alert?.severity)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground">{alert?.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getAlertSeverityColor(alert?.severity)}`}>
                              {alert?.severity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{alert?.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{alert?.time}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-primary">{alert?.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 text-center border-t border-border">
                  <Link
                    to="/war-room-dashboard"
                    onClick={() => setIsAlertsOpen(false)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    View War Room Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Bell / Notifications with threshold breach badge */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); setIsAlertsOpen(false); setIsSettingsOpen(false); setIsSearchOpen(false); }}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Notifications"
            >
              <Icon name="Bell" size={20} />
              {bellBadgeCount > 0 && (
                <span className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold ${hasThresholdCritical ? 'bg-error animate-pulse' : 'bg-warning'}`}>
                  {bellBadgeCount > 9 ? '9+' : bellBadgeCount}
                </span>
              )}
            </button>
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-card rounded-lg border border-border shadow-xl z-50">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                  <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications?.map(notification => (
                    <div
                      key={notification?.id}
                      className="p-4 border-b border-border hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getNotifIcon(notification?.type)?.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground">{notification?.message}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getAlertSeverityColor(notification?.severity || 'info')}`}>
                              {notification?.severity || 'Info'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{notification?.time}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 text-center border-t border-border">
                  <Link
                    to="/notifications"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    View All Notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsNotificationsOpen(false); setIsAlertsOpen(false); setIsSearchOpen(false); }}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Settings"
            >
              <Icon name="Settings" size={20} />
            </button>
            {isSettingsOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg border border-border shadow-xl z-50">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">System</div>
                  <Link
                    to="/enhanced-system-overview"
                    onClick={() => setIsSettingsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Icon name="Activity" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">System Logs</span>
                  </Link>
                  <Link
                    to="/server-management"
                    onClick={() => setIsSettingsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Icon name="Server" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">Server Management</span>
                  </Link>
                  <Link
                    to="/financial-management"
                    onClick={() => setIsSettingsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">Budget & Costs</span>
                  </Link>
                  <Link
                    to="/automation-hub"
                    onClick={() => setIsSettingsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Icon name="Cpu" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">Automation Hub</span>
                  </Link>
                  <div className="border-t border-border my-2" />
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Account</div>
                  <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors w-full text-left">
                    <Icon name="User" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">Profile</span>
                  </button>
                  <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors w-full text-left">
                    <Icon name="Bell" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">Alert Preferences</span>
                  </button>
                  <div className="border-t border-border my-2" />
                  <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors w-full text-left">
                    <Icon name="LogOut" size={16} className="text-error" />
                    <span className="text-sm text-error">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="User" size={18} className="text-primary" />
            </div>
            <div className="hidden xl:block">
              <div className="text-sm font-medium text-foreground">Admin</div>
              <div className="text-xs text-muted-foreground">System Administrator</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;