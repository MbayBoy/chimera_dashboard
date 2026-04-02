import Icon from '../../../components/AppIcon';

const TRIGGER_LABELS = {
  Anomaly_Detected: 'Anomaly Detected',
  Server_Reputation_Drop: 'Reputation Drop',
  Bounce_Rate_Spike: 'Bounce Rate Spike',
  Cost_Exceeds_Budget: 'Cost Exceeds Budget',
  Campaign_Failure_Rate_High: 'Campaign Failure High',
};

const ACTION_LABELS = {
  Quarantine_Server: 'Quarantine Server',
  Pause_Campaign: 'Pause Campaign',
  Trigger_List_Verification: 'List Verification',
  Send_Alert_to_Admin: 'Alert Admin',
  Execute_Cost_Optimization: 'Cost Optimization',
  Auto_Clean_Contacts: 'Auto-Clean Contacts',
};

const RulesListTable = ({ rules, onEdit, onDelete, onToggle, loading }) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 space-y-3">
          {[1,2,3]?.map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (rules?.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Icon name="GitBranch" size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-foreground font-medium mb-1">No workflow rules yet</p>
        <p className="text-sm text-muted-foreground">Create your first rule to automate system responses</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rule Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Triggered</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Triggers</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules?.map(rule => (
              <tr key={rule?.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="GitBranch" size={13} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{rule?.name}</p>
                      {rule?.conditions?.severity && (
                        <p className="text-xs text-muted-foreground">Severity: {rule?.conditions?.severity}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                    {TRIGGER_LABELS?.[rule?.trigger_type] || rule?.trigger_type?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-success/10 text-success rounded text-xs font-medium">
                    {ACTION_LABELS?.[rule?.actions?.action_type] || rule?.actions?.action_type?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                    {rule?.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onToggle(rule?.id, !rule?.enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      rule?.enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      rule?.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {rule?.last_triggered_at
                    ? new Date(rule.last_triggered_at)?.toLocaleString()
                    : <span className="text-muted-foreground/50">Never</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-mono text-foreground">{rule?.trigger_count || 0}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(rule)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit rule"
                    >
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(rule?.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-error hover:bg-error/10 transition-colors"
                      title="Delete rule"
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RulesListTable;
