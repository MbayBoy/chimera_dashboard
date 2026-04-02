import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

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
  };
  return urls?.[rbl] || `https://mxtoolbox.com/SuperTool.aspx?action=blacklist:${ip}`;
}

const HealthTab = ({ healthData, server }) => {
  const [expandedBlacklist, setExpandedBlacklist] = useState(null);
  const [showAllRBL, setShowAllRBL] = useState(false);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pass': case 'valid':
        return 'text-success bg-success/10 border-success/20';
      case 'fail': case 'invalid':
        return 'text-error bg-error/10 border-error/20';
      case 'warning':
        return 'text-warning bg-warning/10 border-warning/20';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pass': case 'valid': return 'CheckCircle2';
      case 'fail': case 'invalid': return 'XCircle';
      case 'warning': return 'AlertTriangle';
      default: return 'Circle';
    }
  };

  const handleDelistClick = (blacklist) => {
    window.open(blacklist?.delistUrl, '_blank', 'noopener,noreferrer');
  };

  // Parse blacklist_status JSON from server prop (live data)
  const parseBlacklistStatus = (raw) => {
    if (!raw) return { lastChecked: null, totalListed: 0, listings: [] };
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return { lastChecked: null, totalListed: 0, listings: [] };
    }
  };

  const blData = parseBlacklistStatus(server?.blacklist_status);
  const rblListings = blData?.listings || [];
  const hasCriticalRBL = rblListings?.some(l => CRITICAL_RBLS?.includes(l?.rbl));
  const displayedRBL = showAllRBL ? rblListings : rblListings?.slice(0, 5);

  // Merge live RBL data with static healthData.blacklists for backward compat
  const staticBlacklists = healthData?.blacklists || [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
          DNS & Authentication Status
        </h3>
        <p className="text-sm md:text-base text-muted-foreground">
          Verify email authentication records and DNS configuration
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {healthData?.dnsChecks?.map((check) => (
          <div key={check?.type} className="bg-card border border-border rounded-lg p-4 md:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(check?.status)}`}>
                  <Icon name={getStatusIcon(check?.status)} size={20} />
                </div>
                <div>
                  <h4 className="text-base md:text-lg font-heading font-medium text-foreground">
                    {check?.type}
                  </h4>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {check?.description}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getStatusColor(check?.status)}`}>
                {check?.status}
              </span>
            </div>
            {check?.value && (
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Record Value</div>
                <div className="text-sm font-mono text-foreground break-all">{check?.value}</div>
              </div>
            )}
            {check?.message && (
              <div className="mt-3 flex items-start gap-2">
                <Icon name="Info" size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">{check?.message}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Live RBL Listings from blacklist_status JSON */}
      {rblListings?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
                Active RBL Listings
              </h3>
              <p className="text-sm text-muted-foreground">
                {blData?.lastChecked ? `Last checked: ${new Date(blData.lastChecked)?.toLocaleString()}` : 'Real-time blacklist data'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasCriticalRBL && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm font-medium">
                  <Icon name="ShieldAlert" size={16} />
                  Critical RBL
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm font-medium">
                <Icon name="AlertCircle" size={16} />
                {rblListings?.length} Listed
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {displayedRBL?.map((listing, idx) => {
              const isCritical = CRITICAL_RBLS?.includes(listing?.rbl);
              const isExpanded = expandedBlacklist === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 ${
                    isCritical ? 'border-error/40 bg-error/5' : 'border-warning/30 bg-warning/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCritical ? 'bg-error/10' : 'bg-warning/10'
                      }`}>
                        <Icon name={isCritical ? 'ShieldAlert' : 'AlertTriangle'} size={18}
                          className={isCritical ? 'text-error' : 'text-warning'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${
                            isCritical ? 'text-error' : 'text-warning'
                          }`}>{listing?.rbl}</span>
                          {isCritical && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-error/20 text-error font-medium">Critical</span>
                          )}
                        </div>
                        {listing?.reason && (
                          <p className="text-xs text-muted-foreground mt-1">{listing?.reason}</p>
                        )}
                        {listing?.detectedAt && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Detected: {new Date(listing.detectedAt)?.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="ExternalLink"
                        iconPosition="right"
                        onClick={() => window.open(getDelistURL(server?.ip_address || server?.ip, listing?.rbl), '_blank', 'noopener,noreferrer')}
                      >
                        Delist
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconName={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                        onClick={() => setExpandedBlacklist(isExpanded ? null : idx)}
                      />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h5 className="text-sm font-medium text-foreground mb-2">Delisting Instructions</h5>
                      <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Click the Delist button to open the RBL's removal portal</li>
                        <li>Verify your IP address: <span className="font-mono text-foreground">{server?.ip_address || server?.ip}</span></li>
                        <li>Complete any verification or CAPTCHA steps</li>
                        <li>Submit your delisting request</li>
                        <li>Monitor your email for confirmation (24–48 hours)</li>
                      </ol>
                      <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Icon name="Info" size={16} className="text-warning mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-warning">
                            Resolve the underlying issue before requesting removal to avoid re-listing.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {rblListings?.length > 5 && (
              <button
                onClick={() => setShowAllRBL(!showAllRBL)}
                className="text-sm text-primary hover:underline w-full text-center py-2"
              >
                {showAllRBL ? 'Show less' : `Show all ${rblListings?.length} listings`}
              </button>
            )}
          </div>
        </div>
      )}
      {/* Static / legacy blacklists section */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
          <div>
            <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
              Active Blacklists
            </h3>
            <p className="text-sm md:text-base text-muted-foreground">
              Monitor and manage blacklist status across major providers
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Icon name="AlertCircle" size={16} className="text-warning" />
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {staticBlacklists?.filter(b => b?.listed)?.length} Active
            </span>
          </div>
        </div>

        {staticBlacklists?.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircle2" size={32} className="text-success md:w-10 md:h-10" />
            </div>
            <h4 className="text-base md:text-lg font-heading font-medium text-foreground mb-2">
              No Blacklists Detected
            </h4>
            <p className="text-sm md:text-base text-muted-foreground">
              Your server IP is not listed on any monitored blacklists
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {staticBlacklists?.map((blacklist) => (
              <div
                key={blacklist?.id}
                className="bg-muted rounded-lg p-4 transition-smooth hover:bg-muted/80"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      blacklist?.listed ? 'bg-error/10' : 'bg-success/10'
                    }`}>
                      <Icon
                        name={blacklist?.listed ? 'XCircle' : 'CheckCircle2'}
                        size={20}
                        className={blacklist?.listed ? 'text-error' : 'text-success'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm md:text-base font-medium text-foreground mb-1">{blacklist?.name}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground mb-2">{blacklist?.description}</p>
                      {blacklist?.listed && blacklist?.reason && (
                        <div className="flex items-start gap-2 mt-2">
                          <Icon name="AlertCircle" size={14} className="text-warning mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">Reason: {blacklist?.reason}</p>
                        </div>
                      )}
                      {blacklist?.listedDate && (
                        <div className="text-xs text-muted-foreground mt-1">Listed since: {blacklist?.listedDate}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {blacklist?.listed ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          iconName="ExternalLink"
                          iconPosition="right"
                          onClick={() => handleDelistClick(blacklist)}
                        >
                          Request Delist
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName={expandedBlacklist === blacklist?.id ? 'ChevronUp' : 'ChevronDown'}
                          onClick={() => setExpandedBlacklist(
                            expandedBlacklist === blacklist?.id ? null : blacklist?.id
                          )}
                        />
                      </>
                    ) : (
                      <span className="px-3 py-1 bg-success/10 text-success rounded-lg text-xs font-medium border border-success/20">
                        Clear
                      </span>
                    )}
                  </div>
                </div>
                {expandedBlacklist === blacklist?.id && blacklist?.listed && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h5 className="text-sm font-medium text-foreground mb-2">Delisting Instructions</h5>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Visit the delisting portal using the button above</li>
                      <li>Verify your IP address: {blacklist?.ip}</li>
                      <li>Complete the verification process</li>
                      <li>Submit your delisting request</li>
                      <li>Monitor your email for confirmation</li>
                    </ol>
                    <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Icon name="Info" size={16} className="text-warning mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-warning">
                          Delisting typically takes 24-48 hours. Ensure the underlying issue is resolved before requesting removal.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Shield" size={20} className="text-success" />
            <span className="text-sm text-muted-foreground">DNS Health</span>
          </div>
          <div className="text-2xl font-heading font-semibold text-foreground">
            {healthData?.dnsChecks?.filter(c => c?.status?.toLowerCase() === 'pass')?.length}/{healthData?.dnsChecks?.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Records Passing</div>
        </div>
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name={hasCriticalRBL ? 'ShieldAlert' : 'AlertCircle'} size={20}
              className={hasCriticalRBL ? 'text-error' : 'text-warning'} />
            <span className="text-sm text-muted-foreground">RBL Listings</span>
          </div>
          <div className={`text-2xl font-heading font-semibold ${
            hasCriticalRBL ? 'text-error' : rblListings?.length > 0 ? 'text-warning' : 'text-foreground'
          }`}>
            {rblListings?.length > 0 ? rblListings?.length : staticBlacklists?.filter(b => b?.listed)?.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {hasCriticalRBL ? 'Critical — Immediate Action' : 'Active Listings'}
          </div>
        </div>
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Clock" size={20} className="text-primary" />
            <span className="text-sm text-muted-foreground">Last Check</span>
          </div>
          <div className="text-base font-medium text-foreground">
            {blData?.lastChecked ? new Date(blData.lastChecked)?.toLocaleString() : healthData?.lastCheck || 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Blacklist scan time</div>
        </div>
      </div>
    </div>
  );
};

export default HealthTab;