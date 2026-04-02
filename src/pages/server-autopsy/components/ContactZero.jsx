import Icon from '../../../components/AppIcon';

const ContactZero = ({ data }) => {
  const getTierColor = (tier) => {
    switch (tier) {
      case 'Platinum':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'Gold':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Silver':
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
      case 'Bronze':
        return 'bg-orange-600/10 text-orange-600 border-orange-600/20';
      case 'Lead':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getEngagementColor = (score) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="bg-card border border-error rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">
            Contact Zero
          </h2>
          <p className="text-sm text-muted-foreground">
            Trigger contact attribution
          </p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
          <Icon name="Target" size={24} className="text-error" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-error/5 border border-error/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Icon name="AlertCircle" size={20} className="text-error mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground mb-1">
                This contact triggered the quarantine
              </div>
              <div className="text-xs text-muted-foreground">
                Policy block received when attempting to send to this recipient
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="User" size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Contact Information</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-sm font-medium text-foreground">{data?.name}</div>
              <div className="text-xs font-mono text-muted-foreground">{data?.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${
                getTierColor(data?.tier)
              }`}>
                {data?.tier} Tier
              </span>
              <span className={`text-xs font-medium ${
                getEngagementColor(data?.engagementScore)
              }`}>
                {data?.engagementScore}% engagement
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Mail" size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Campaign Details</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-sm font-medium text-foreground">{data?.campaign?.name}</div>
              <div className="text-xs text-muted-foreground">{data?.campaign?.subject}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Risk:</span>
                <span className="text-xs font-medium text-error">{data?.campaign?.riskScore}/100</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Content:</span>
                <span className="text-xs font-medium text-foreground">{data?.campaign?.contentScore}/10</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="AlertTriangle" size={16} className="text-error" />
            <span className="text-xs text-muted-foreground">Trigger Details</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">SMTP Code:</span>
              <span className="text-xs font-mono text-foreground">{data?.triggerDetails?.smtpCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">ISP:</span>
              <span className="text-xs font-medium text-foreground">{data?.triggerDetails?.isp}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1">SMTP Message:</div>
              <div className="text-xs font-mono text-foreground bg-background p-2 rounded">
                {data?.triggerDetails?.smtpMessage}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="History" size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Contact History</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Last Opened:</span>
              <span className="text-xs text-foreground">{data?.lastOpened}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Bounce History:</span>
              <span className="text-xs text-foreground">{data?.bounceHistory} bounces</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Complaint History:</span>
              <span className="text-xs text-foreground">{data?.complaintHistory} complaints</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactZero;