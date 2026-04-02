import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const TRIGGER_CONDITIONS = [
  { value: 'Anomaly_Detected', label: 'Anomaly Detected' },
  { value: 'Server_Reputation_Drop', label: 'Server Reputation Drop' },
  { value: 'Bounce_Rate_Spike', label: 'Bounce Rate Spike' },
  { value: 'Cost_Exceeds_Budget', label: 'Cost Exceeds Budget' },
  { value: 'Campaign_Failure_Rate_High', label: 'Campaign Failure Rate High' },
];

const ANOMALY_TYPES = [
  'Engagement_Drop', 'Bounce_Spike', 'Reputation_Drop', 'Cost_Overrun',
  'Blacklist_Detection', 'Campaign_Failure', 'Verification_Failure',
];

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

const ACTIONS = [
  { value: 'Quarantine_Server', label: 'Quarantine Server', params: ['server_id'] },
  { value: 'Pause_Campaign', label: 'Pause Campaign', params: ['campaign_id'] },
  { value: 'Trigger_List_Verification', label: 'Trigger List Verification', params: ['list_id'] },
  { value: 'Send_Alert_to_Admin', label: 'Send Alert to Admin', params: ['message'] },
  { value: 'Execute_Cost_Optimization', label: 'Execute Cost Optimization', params: ['budget_limit'] },
  { value: 'Auto_Clean_Contacts', label: 'Auto-Clean Contacts', params: ['list_id'] },
];

const DEFAULT_RULE = {
  name: '',
  trigger_type: 'Anomaly_Detected',
  conditions: {
    anomaly_type: '',
    severity: 'High',
    threshold: '',
    time_window_minutes: 60,
    occurrence_count: 1,
  },
  actions: {
    action_type: 'Send_Alert_to_Admin',
    params: {},
  },
  enabled: true,
  priority: 5,
};

const RuleBuilderModal = ({ rule, onSave, onClose, saving }) => {
  const [form, setForm] = useState(rule || DEFAULT_RULE);
  const [errors, setErrors] = useState({});

  const update = (path, value) => {
    setForm(prev => {
      const next = { ...prev };
      const parts = path?.split('.');
      let obj = next;
      for (let i = 0; i < parts?.length - 1; i++) {
        obj[parts[i]] = { ...obj?.[parts?.[i]] };
        obj = obj?.[parts?.[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
    if (errors?.[path]) setErrors(e => ({ ...e, [path]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form?.name?.trim()) errs.name = 'Rule name is required';
    if (!form?.trigger_type) errs.trigger_type = 'Trigger condition is required';
    if (!form?.actions?.action_type) errs['actions.action_type'] = 'Action is required';
    setErrors(errs);
    return Object.keys(errs)?.length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSave(form);
  };

  const selectedAction = ACTIONS?.find(a => a?.value === form?.actions?.action_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="GitBranch" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {rule ? 'Edit Rule' : 'Create New Rule'}
              </h2>
              <p className="text-xs text-muted-foreground">Define automation trigger and action</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rule Name + Priority */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rule Name *</label>
              <input
                type="text"
                value={form?.name}
                onChange={e => update('name', e?.target?.value)}
                placeholder="e.g., Auto-quarantine on critical reputation drop"
                className={`w-full text-sm bg-muted border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground ${
                  errors?.name ? 'border-error' : 'border-border'
                }`}
              />
              {errors?.name && <p className="text-xs text-error mt-1">{errors?.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority (1–10)</label>
              <input
                type="number"
                min="1" max="10"
                value={form?.priority}
                onChange={e => update('priority', parseInt(e?.target?.value) || 5)}
                className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
              />
            </div>
          </div>

          {/* IF Section */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border-b border-border">
              <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded">IF</span>
              <span className="text-sm font-medium text-foreground">Trigger Condition</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">When this happens</label>
                <select
                  value={form?.trigger_type}
                  onChange={e => update('trigger_type', e?.target?.value)}
                  className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                >
                  {TRIGGER_CONDITIONS?.map(t => <option key={t?.value} value={t?.value}>{t?.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form?.trigger_type === 'Anomaly_Detected' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Anomaly Type</label>
                    <select
                      value={form?.conditions?.anomaly_type}
                      onChange={e => update('conditions.anomaly_type', e?.target?.value)}
                      className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                    >
                      <option value="">Any Type</option>
                      {ANOMALY_TYPES?.map(t => <option key={t} value={t}>{t?.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Severity</label>
                  <select
                    value={form?.conditions?.severity}
                    onChange={e => update('conditions.severity', e?.target?.value)}
                    className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                  >
                    <option value="">Any Severity</option>
                    {SEVERITIES?.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Threshold Value</label>
                  <input
                    type="text"
                    value={form?.conditions?.threshold}
                    onChange={e => update('conditions.threshold', e?.target?.value)}
                    placeholder="e.g., reputation < 50"
                    className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Occurs X times</label>
                  <input
                    type="number" min="1"
                    value={form?.conditions?.occurrence_count}
                    onChange={e => update('conditions.occurrence_count', parseInt(e?.target?.value) || 1)}
                    className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Within (minutes)</label>
                  <input
                    type="number" min="1"
                    value={form?.conditions?.time_window_minutes}
                    onChange={e => update('conditions.time_window_minutes', parseInt(e?.target?.value) || 60)}
                    className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* THEN Section */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-success/5 border-b border-border">
              <span className="px-2 py-0.5 bg-success text-white text-xs font-bold rounded">THEN</span>
              <span className="text-sm font-medium text-foreground">Execute Action</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Action to perform</label>
                <select
                  value={form?.actions?.action_type}
                  onChange={e => update('actions.action_type', e?.target?.value)}
                  className={`w-full text-sm bg-muted border rounded-lg px-3 py-2 text-foreground ${
                    errors?.['actions.action_type'] ? 'border-error' : 'border-border'
                  }`}
                >
                  {ACTIONS?.map(a => <option key={a?.value} value={a?.value}>{a?.label}</option>)}
                </select>
                {errors?.['actions.action_type'] && <p className="text-xs text-error mt-1">{errors?.['actions.action_type']}</p>}
              </div>
              {selectedAction?.params?.map(param => (
                <div key={param}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    {param?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase())}
                  </label>
                  <input
                    type="text"
                    value={form?.actions?.params?.[param] || ''}
                    onChange={e => update(`actions.params.${param}`, e?.target?.value)}
                    placeholder={`Enter ${param?.replace(/_/g, ' ')}...`}
                    className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/50">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Rule</p>
              <p className="text-xs text-muted-foreground">Rule will be evaluated in real-time when enabled</p>
            </div>
            <button
              onClick={() => update('enabled', !form?.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form?.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form?.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Icon name={saving ? 'Loader' : 'Save'} size={15} className={saving ? 'animate-spin' : ''} />
            {saving ? 'Saving...' : (rule ? 'Update Rule' : 'Create Rule')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleBuilderModal;
