import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../AppIcon';
import { setAlertCallback } from '../../services/alertNotificationService';

const STORAGE_KEY = 'chimera_read_alert_ids';

const getReadIds = () => {
  try {
    return new Set(JSON.parse(localStorage?.getItem(STORAGE_KEY) || '[]'));
  } catch { return new Set(); }
};

const saveReadIds = (ids) => {
  try {
    localStorage?.setItem(STORAGE_KEY, JSON.stringify([...ids]?.slice(-200)));
  } catch {}
};

const getSeverityOrder = (severity) => {
  const s = severity?.toLowerCase?.();
  if (s === 'critical') return 0;
  if (s === 'high' || s === 'error') return 1;
  if (s === 'warn' || s === 'warning' || s === 'medium') return 2;
  return 3;
};

const getHighestSeverity = (alerts) => {
  if (!alerts?.length) return null;
  return alerts?.reduce((highest, alert) => {
    return getSeverityOrder(alert?.severity) < getSeverityOrder(highest?.severity) ? alert : highest;
  });
};

const getBadgeStyle = (severity) => {
  const s = severity?.toLowerCase?.();
  if (s === 'critical') return 'bg-error text-white';
  if (s === 'high' || s === 'error') return 'bg-orange-500 text-white';
  if (s === 'warn' || s === 'warning' || s === 'medium') return 'bg-warning text-black';
  return 'bg-primary text-primary-foreground';
};

const getSeverityIcon = (severity) => {
  const s = severity?.toLowerCase?.();
  if (s === 'critical') return { name: 'AlertCircle', color: 'text-error' };
  if (s === 'high' || s === 'error') return { name: 'AlertTriangle', color: 'text-orange-500' };
  if (s === 'warn' || s === 'warning' || s === 'medium') return { name: 'AlertTriangle', color: 'text-warning' };
  return { name: 'Info', color: 'text-primary' };
};

const AlertBadge = () => {
  const [alerts, setAlerts] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds);
  const [isOpen, setIsOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const dropdownRef = useRef(null);

  // Register as alert callback receiver
  useEffect(() => {
    setAlertCallback((newAlert) => {
      setAlerts(prev => {
        const updated = [newAlert, ...prev]?.slice(0, 50);
        return updated;
      });
      // Pulse animation on critical
      if (newAlert?.severity?.toLowerCase?.() === 'critical') {
        setPulsing(true);
        setTimeout(() => setPulsing(false), 3000);
      }
    });
    return () => setAlertCallback(null);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef?.current && !dropdownRef?.current?.contains(e?.target)) {
        setIsOpen(false);
      }
    };
    document?.addEventListener('mousedown', handler);
    return () => document?.removeEventListener('mousedown', handler);
  }, []);

  const unreadAlerts = alerts?.filter(a => !readIds?.has(a?.id));
  const unreadCount = unreadAlerts?.length;
  const highestSeverity = getHighestSeverity(unreadAlerts);

  // Count by severity
  const criticalCount = unreadAlerts?.filter(a => a?.severity?.toLowerCase?.() === 'critical')?.length;
  const highCount = unreadAlerts?.filter(a => ['high', 'error']?.includes(a?.severity?.toLowerCase?.()))?.length;
  const warnCount = unreadAlerts?.filter(a => ['warn', 'warning', 'medium']?.includes(a?.severity?.toLowerCase?.()))?.length;

  const handleOpen = () => {
    setIsOpen(prev => !prev);
    if (!isOpen && unreadCount > 0) {
      // Mark all current alerts as read when dropdown opens
      const newReadIds = new Set([...readIds, ...alerts?.map(a => a?.id)]);
      setReadIds(newReadIds);
      saveReadIds(newReadIds);
    }
  };

  const last10 = alerts?.slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Alert Notifications"
      >
        <Icon name="Bell" size={20} />

        {/* Pulse ring for critical */}
        {pulsing && (
          <span className="absolute inset-0 rounded-lg animate-ping bg-error/30" />
        )}

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold leading-none ${
              getBadgeStyle(highestSeverity?.severity)
            } ${pulsing ? 'animate-bounce' : ''}`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-card rounded-lg border border-border shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Live Alert Feed</h3>
              <div className="flex items-center gap-3 mt-1">
                {criticalCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-error">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                    {criticalCount} Critical
                  </span>
                )}
                {highCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orange-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    {highCount} High
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-warning">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    {warnCount} Warn
                  </span>
                )}
                {unreadCount === 0 && <span className="text-xs text-muted-foreground">All caught up</span>}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-muted rounded">
              <Icon name="X" size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Alert List */}
          <div className="max-h-80 overflow-y-auto">
            {last10?.length === 0 ? (
              <div className="p-8 text-center">
                <Icon name="Bell" size={24} className="mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No alerts yet</p>
                <p className="text-xs text-muted-foreground mt-1">Real-time alerts will appear here</p>
              </div>
            ) : (
              last10?.map((alert) => {
                const icon = getSeverityIcon(alert?.severity);
                const isRead = readIds?.has(alert?.id);
                const timeAgo = alert?.timestamp ? new Date(alert?.timestamp) : new Date();
                const minsAgo = Math.floor((Date.now() - timeAgo?.getTime()) / 60000);
                const timeLabel = minsAgo < 1 ? 'Just now' : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`;

                return (
                  <div
                    key={alert?.id || Math.random()}
                    className={`p-4 border-b border-border hover:bg-muted/50 transition-colors ${
                      !isRead ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon name={icon?.name} size={15} className={`${icon?.color} mt-0.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-medium text-foreground truncate">{alert?.title}</p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{timeLabel}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{alert?.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            alert?.severity?.toLowerCase?.() === 'critical' ? 'bg-error/10 text-error' :
                            ['high', 'error']?.includes(alert?.severity?.toLowerCase?.()) ? 'bg-orange-500/10 text-orange-500' :
                            'bg-warning/10 text-warning'
                          }`}>
                            {alert?.severity}
                          </span>
                          {alert?.source && <span className="text-xs text-muted-foreground">{alert?.source}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border flex items-center justify-between">
            <Link
              to="/war-room-dashboard"
              onClick={() => setIsOpen(false)}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              View War Room Dashboard
            </Link>
            <span className="text-xs text-muted-foreground">{alerts?.length} total alerts</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertBadge;
