import { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';

const CRITICAL_RBLS = ['zen.spamhaus.org', 'cbl.abuseat.org'];

function getDelistURL(ip, rbl) {
  const urls = {
    'zen.spamhaus.org': `https://www.spamhaus.org/query/ip/${ip}`,
    'bl.spamcop.net': `https://www.spamcop.net/bl.shtml?${ip}`,
    'dnsbl.sorbs.net': `https://www.sorbs.net/lookup.shtml?${ip}`,
    'b.barracudacentral.org': `https://barracudacentral.org/lookups/lookup-reputation?host=${ip}`,
    'cbl.abuseat.org': `https://www.abuseat.org/lookup.cgi?ip=${ip}`,
    'psbl.surriel.com': `https://psbl.org/listing?ip=${ip}`,
    'dnsbl-1.uceprotect.net': `http://www.uceprotect.net/en/rblcheck.php?ipr=${ip}`,
    'ips.backscatterer.org': `https://www.backscatterer.org/?target=${ip}`,
    'ubl.unsubscore.com': `https://www.lashback.com/blacklist/?ip=${ip}`,
    'bogons.cymru.com': `https://www.team-cymru.com/bogon-reference.html`
  };
  return urls?.[rbl] || `https://mxtoolbox.com/SuperTool.aspx?action=blacklist:${ip}`;
}

function getSeverity(listings, ip) {
  if (!listings || listings?.length === 0) return 'clean';
  const hasCritical = listings?.some(l => CRITICAL_RBLS?.includes(l?.rbl));
  if (hasCritical || listings?.length >= 3) return 'critical';
  return 'warning';
}

const SeverityBadge = ({ severity, count }) => {
  if (severity === 'clean') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
        <Icon name="CheckCircle2" size={12} />
        Clean
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
        <Icon name="AlertTriangle" size={12} />
        {count} Listed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-error/10 text-error border border-error/20">
      <Icon name="ShieldAlert" size={12} />
      {count} Critical
    </span>
  );
};

const BlacklistMonitor = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase?.from('servers')?.select('id, name, ip_address, blacklist_status, status')?.not('status', 'eq', 'Burnt')?.order('name');

      if (error) throw error;
      setServers(data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseBlacklistStatus = (raw) => {
    if (!raw) return { lastChecked: null, totalListed: 0, listings: [] };
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return { lastChecked: null, totalListed: 0, listings: [] };
    }
  };

  const handleCheckNow = async (server) => {
    setCheckingId(server?.id);
    // Trigger a re-fetch after a short delay to simulate check
    // In production, this would call a backend endpoint or edge function
    setTimeout(async () => {
      await fetchServers();
      setCheckingId(null);
    }, 2000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      return new Date(dateStr)?.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3]?.map(i => (
          <div key={i} className="bg-card border border-border rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-muted rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-1">
              Real-Time Blacklist Monitoring
            </h3>
            <p className="text-sm text-muted-foreground">
              Monitor your server IPs across major RBL databases
            </p>
          </div>
          <Button iconName="RefreshCw" variant="outline" onClick={fetchServers}>
            Refresh All
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Last updated: {lastRefresh?.toLocaleTimeString()}
          </span>
        </div>
      </div>
      {servers?.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="Server" size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No servers found. Add servers to start monitoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers?.map((server) => {
            const bl = parseBlacklistStatus(server?.blacklist_status);
            const listings = bl?.listings || [];
            const severity = getSeverity(listings, server?.ip_address);
            const isExpanded = expandedId === server?.id;
            const isChecking = checkingId === server?.id;

            return (
              <div
                key={server?.id}
                className={`bg-card rounded-lg border p-5 transition-shadow hover:shadow-lg ${
                  severity === 'critical' ? 'border-error/40' :
                  severity === 'warning' ? 'border-warning/40' : 'border-border'
                }`}
              >
                {/* Server Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        severity === 'clean' ? 'bg-success' :
                        severity === 'warning' ? 'bg-warning' : 'bg-error'
                      }`} />
                      <span className="text-sm font-medium text-foreground truncate">{server?.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono ml-4">{server?.ip_address}</span>
                  </div>
                  <SeverityBadge severity={severity} count={listings?.length} />
                </div>
                {/* Critical RBL Warning */}
                {listings?.some(l => CRITICAL_RBLS?.includes(l?.rbl)) && (
                  <div className="flex items-center gap-2 bg-error/10 border border-error/20 rounded-lg px-3 py-2 mb-3">
                    <Icon name="ShieldAlert" size={14} className="text-error flex-shrink-0" />
                    <span className="text-xs text-error font-medium">Critical RBL detected — immediate action required</span>
                  </div>
                )}
                {/* Listings Summary */}
                {listings?.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {listings?.slice(0, isExpanded ? listings?.length : 3)?.map((listing, idx) => (
                      <div key={idx} className="bg-error/5 border border-error/15 rounded-lg p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${
                            CRITICAL_RBLS?.includes(listing?.rbl) ? 'text-error' : 'text-warning'
                          }`}>{listing?.rbl}</span>
                          <a
                            href={getDelistURL(server?.ip_address, listing?.rbl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"
                          >
                            Delist <Icon name="ExternalLink" size={10} />
                          </a>
                        </div>
                        {listing?.reason && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{listing?.reason}</p>
                        )}
                        {listing?.detectedAt && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Detected: {formatDate(listing?.detectedAt)}
                          </p>
                        )}
                      </div>
                    ))}
                    {listings?.length > 3 && !isExpanded && (
                      <button
                        onClick={() => setExpandedId(server?.id)}
                        className="text-xs text-primary hover:underline w-full text-center py-1"
                      >
                        +{listings?.length - 3} more listings
                      </button>
                    )}
                    {isExpanded && (
                      <button
                        onClick={() => setExpandedId(null)}
                        className="text-xs text-muted-foreground hover:underline w-full text-center py-1"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-success text-xs mb-3">
                    <Icon name="CheckCircle2" size={14} />
                    <span>Not listed on any monitored RBLs</span>
                  </div>
                )}
                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {bl?.lastChecked ? `Checked ${formatDate(bl?.lastChecked)}` : 'Never checked'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    iconName={isChecking ? 'Loader2' : 'Search'}
                    onClick={() => handleCheckNow(server)}
                    disabled={isChecking}
                  >
                    {isChecking ? 'Checking...' : 'Check Now'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* RBL Legend */}
      <div className="bg-muted rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">Severity Guide</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success flex-shrink-0" />
            <span><strong className="text-foreground">Green</strong> — Clean (0 listings)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning flex-shrink-0" />
            <span><strong className="text-foreground">Yellow</strong> — Warning (1–2 listings)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-error flex-shrink-0" />
            <span><strong className="text-foreground">Red</strong> — Critical (3+ or Spamhaus/CBL)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlacklistMonitor;