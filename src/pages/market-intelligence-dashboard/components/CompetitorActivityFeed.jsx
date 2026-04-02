import { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const getSentimentLabel = (score) => {
  if (score > 0.3) return { label: 'Positive', color: 'text-success', bg: 'bg-success/10' };
  if (score < -0.3) return { label: 'Negative', color: 'text-error', bg: 'bg-error/10' };
  return { label: 'Neutral', color: 'text-muted-foreground', bg: 'bg-muted' };
};

const mockCampaigns = [
  { id: 'cc-001', competitor: 'CompetitorA', subject: 'Exclusive Summer Sale - 50% Off!', campaign_type: 'promotional', sentiment_score: 0.6, detected_at: new Date(Date.now() - 3600000)?.toISOString(), from_domain: 'competitora.com', estimated_list_size: 45000 },
  { id: 'cc-002', competitor: 'CompetitorB', subject: 'Your account needs attention', campaign_type: 'transactional', sentiment_score: -0.1, detected_at: new Date(Date.now() - 7200000)?.toISOString(), from_domain: 'competitorb.com', estimated_list_size: 12000 },
  { id: 'cc-003', competitor: 'CompetitorC', subject: 'New product launch - Be first!', campaign_type: 'announcement', sentiment_score: 0.8, detected_at: new Date(Date.now() - 10800000)?.toISOString(), from_domain: 'competitorc.com', estimated_list_size: 28000 },
];

const CompetitorActivityFeed = () => {
  const [campaigns, setCampaigns] = useState(mockCampaigns);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        ?.from('competitor_campaigns')
        ?.select('*')
        ?.order('detected_at', { ascending: false })
        ?.limit(20);

      if (!error && data?.length > 0) {
        setCampaigns(data);
      }
    } catch (err) {
      // Use mock data as fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [filter]);

  const filtered = filter === 'all' ? campaigns : campaigns?.filter(c => c?.campaign_type === filter);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Competitor Activity Feed</h3>
        <div className="flex gap-2">
          {['all', 'promotional', 'transactional', 'announcement']?.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {f?.charAt(0)?.toUpperCase() + f?.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Icon name="Loader" size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map(campaign => {
            const sentiment = getSentimentLabel(campaign?.sentiment_score || 0);
            return (
              <div key={campaign?.id} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{campaign?.subject}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sentiment?.bg} ${sentiment?.color} flex-shrink-0`}>{sentiment?.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{campaign?.competitor || campaign?.from_domain}</span>
                  <span>~{((campaign?.estimated_list_size || 0) / 1000)?.toFixed(0)}K recipients</span>
                  <span>{new Date(campaign?.detected_at)?.toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })}
          {filtered?.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">No competitor activity found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CompetitorActivityFeed;
