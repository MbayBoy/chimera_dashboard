import Icon from '../../../components/AppIcon';

const tierIcons = {
  Platinum: { icon: 'Crown', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  Gold: { icon: 'Star', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  Silver: { icon: 'Award', color: 'text-slate-400', bg: 'bg-slate-500/10' },
  Bronze: { icon: 'Medal', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  Lead: { icon: 'User', color: 'text-slate-500', bg: 'bg-slate-600/10' },
};

const SegmentSendTimeTable = ({ segmentStats }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Clock" size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Segment Send Time Distribution</h2>
        <span className="ml-auto text-xs text-muted-foreground">ML-optimized per tier</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Segment</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contacts</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Optimal_Send_Time_Hour</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Delivery Window</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Primary Timezone</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Rate</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {segmentStats?.map(seg => {
              const meta = tierIcons?.[seg?.segment] || tierIcons?.Lead;
              return (
                <tr key={seg?.segment} className="hover:bg-muted/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
                        <Icon name={meta.icon} size={14} className={meta.color} />
                      </div>
                      <span className="font-medium text-foreground">{seg?.segment}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-foreground">{seg?.contacts?.toLocaleString()}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: seg?.color }}>
                        {seg?.optimalHour}
                      </div>
                      <span className="text-sm text-foreground">{seg?.optimalHour}:00 local</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {seg?.deliveryWindow}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-muted-foreground">{seg?.timezone}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1.5 w-20">
                        <div className="h-full rounded-full bg-success" style={{ width: `${seg?.openRate}%` }} />
                      </div>
                      <span className="text-sm font-medium text-foreground">{seg?.openRate}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Optimized
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={14} className="text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">ML Recommendation:</strong> Optimal_Send_Time_Hour is calculated nightly from each contact's Last_Open_Date history. 
            Campaign_Queue jobs are individually scheduled per recipient using their local timezone offset. 
            Platinum contacts show highest lift (+24%) when delivered in the 8AM–11AM window.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SegmentSendTimeTable;
