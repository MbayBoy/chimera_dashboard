import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const CampaignListTable = ({ campaigns, onViewCampaign, onEditCampaign, onDelete, onQueueCampaign, onPauseCampaign, onResumeCampaign, actionLoading = {} }) => {
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return 'ChevronsUpDown';
    return sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown';
  };

  const sortedCampaigns = [...(campaigns || [])]?.sort((a, b) => {
    let aValue = a?.[sortField];
    let bValue = b?.[sortField];
    if (sortField === 'createdAt' || sortField === 'created_at') {
      aValue = new Date(a?.createdAt || a?.created_at)?.getTime();
      bValue = new Date(b?.createdAt || b?.created_at)?.getTime();
    }
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': case 'active': return 'bg-success/10 text-success border-success/20';
      case 'scheduled': return 'bg-primary/10 text-primary border-primary/20';
      case 'draft': return 'bg-muted text-muted-foreground border-border';
      case 'completed': return 'bg-success/10 text-success border-success/20';
      case 'paused': return 'bg-warning/10 text-warning border-warning/20';
      case 'simulating': return 'bg-warning/10 text-warning border-warning/20';
      case 'failed': return 'bg-error/10 text-error border-error/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getRiskColor = (riskScore) => {
    if (riskScore <= 30) return 'text-success';
    if (riskScore <= 60) return 'text-warning';
    return 'text-error';
  };

  const getRiskLabel = (riskScore) => {
    if (riskScore <= 30) return 'Low';
    if (riskScore <= 60) return 'Medium';
    return 'High';
  };

  const getCanaryStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'passed': return 'bg-success/10 text-success border-success/20';
      case 'failed': return 'bg-error/10 text-error border-error/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getCanaryStatusLabel = (status) => {
    if (!status || status === 'not_run') return 'Not Run';
    return status?.charAt(0)?.toUpperCase() + status?.slice(1);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getQueueProgress = (campaign) => {
    const sent = campaign?.sent_count || campaign?.sent || 0;
    const total = campaign?.total_recipients || 0;
    if (!total) return null;
    const pct = Math.min(100, Math.round((sent / total) * 100));
    return { sent, total, pct };
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-4 text-left">
                <button onClick={() => handleSort('name')} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Campaign Name <Icon name={getSortIcon('name')} size={14} />
                </button>
              </th>
              <th className="px-6 py-4 text-left">
                <button onClick={() => handleSort('status')} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Status <Icon name={getSortIcon('status')} size={14} />
                </button>
              </th>
              <th className="px-6 py-4 text-left">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Canary</span>
              </th>
              <th className="px-6 py-4 text-left">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">A/B Test</span>
              </th>
              <th className="px-6 py-4 text-left">
                <button onClick={() => handleSort('riskScore')} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Risk <Icon name={getSortIcon('riskScore')} size={14} />
                </button>
              </th>
              <th className="px-6 py-4 text-left">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</span>
              </th>
              <th className="px-6 py-4 text-left">
                <button onClick={() => handleSort('createdAt')} className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  Created <Icon name={getSortIcon('createdAt')} size={14} />
                </button>
              </th>
              <th className="px-6 py-4 text-right">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedCampaigns?.map((campaign) => {
              const progress = getQueueProgress(campaign);
              const isQueueLoading = actionLoading?.[`queue_${campaign?.id}`];
              const isPauseLoading = actionLoading?.[`pause_${campaign?.id}`];
              const isResumeLoading = actionLoading?.[`resume_${campaign?.id}`];
              const canQueue = campaign?.status === 'Draft' || campaign?.status === 'Scheduled';
              const canPause = campaign?.status === 'Running';
              const canResume = campaign?.status === 'Paused';
              const hasABWinner = campaign?.ab_winner_variant;

              return (
                <tr key={campaign?.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-1">{campaign?.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{campaign?.subject}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(campaign?.status)}`}>
                      {campaign?.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCanaryStatusColor(campaign?.canaryStatus)}`}>
                      {getCanaryStatusLabel(campaign?.canaryStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {hasABWinner ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <Icon name="Trophy" size={12} className="text-warning" />
                          <span className="text-xs font-medium text-success">Variant {campaign?.ab_winner_variant}</span>
                        </div>
                        {campaign?.ab_confidence && (
                          <span className="text-xs text-muted-foreground">{campaign?.ab_confidence}% conf.</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getRiskColor(campaign?.riskScore)}`}>{getRiskLabel(campaign?.riskScore)}</span>
                      <span className="text-xs text-muted-foreground">({campaign?.riskScore}/100)</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {progress ? (
                      <div className="min-w-[100px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{progress?.sent?.toLocaleString()}/{progress?.total?.toLocaleString()}</span>
                          <span className="font-medium text-foreground">{progress?.pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress?.pct}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Sent:</span>
                          <span className="font-medium text-foreground">{(campaign?.sent_count || campaign?.sent || 0)?.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted-foreground">{formatDate(campaign?.createdAt || campaign?.created_at)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canQueue && (
                        <button
                          onClick={() => onQueueCampaign?.(campaign)}
                          disabled={isQueueLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          title="Queue Campaign"
                        >
                          {isQueueLoading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Send" size={12} />}
                          Queue
                        </button>
                      )}
                      {canPause && (
                        <button
                          onClick={() => onPauseCampaign?.(campaign)}
                          disabled={isPauseLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-warning/10 hover:bg-warning/20 text-warning rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          title="Pause Campaign"
                        >
                          {isPauseLoading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Pause" size={12} />}
                          Pause
                        </button>
                      )}
                      {canResume && (
                        <button
                          onClick={() => onResumeCampaign?.(campaign)}
                          disabled={isResumeLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-success/10 hover:bg-success/20 text-success rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          title="Resume Campaign"
                        >
                          {isResumeLoading ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Play" size={12} />}
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => onViewCampaign?.(campaign)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Icon name="Eye" size={16} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => onEditCampaign?.(campaign)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Edit Campaign"
                      >
                        <Icon name="Edit" size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CampaignListTable;