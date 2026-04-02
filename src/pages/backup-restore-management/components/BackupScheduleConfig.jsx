import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const BackupScheduleConfig = () => {
  const [schedule, setSchedule] = useState({
    enabled: true,
    time: '03:00',
    frequency: 'daily',
    retentionDays: 30,
    compressionEnabled: true,
    integrityCheck: true,
    notifyOnFailure: true,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-foreground font-semibold mb-6">Backup Schedule Configuration</h3>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Automated Backups</p>
              <p className="text-xs text-muted-foreground">Enable daily scheduled backups</p>
            </div>
            <button
              onClick={() => setSchedule(s => ({ ...s, enabled: !s?.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                schedule?.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                schedule?.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Backup Time</label>
            <input
              type="time"
              value={schedule?.time}
              onChange={e => setSchedule(s => ({ ...s, time: e?.target?.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Currently set to 3:00 AM daily</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Frequency</label>
            <select
              value={schedule?.frequency}
              onChange={e => setSchedule(s => ({ ...s, frequency: e?.target?.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Retention Period: <span className="text-primary">{schedule?.retentionDays} days</span>
            </label>
            <input
              type="range"
              min="7"
              max="90"
              value={schedule?.retentionDays}
              onChange={e => setSchedule(s => ({ ...s, retentionDays: parseInt(e?.target?.value) }))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>7 days</span>
              <span>90 days</span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'compressionEnabled', label: 'Enable Compression', desc: 'Reduce backup size with gzip' },
              { key: 'integrityCheck', label: 'Integrity Verification', desc: 'Verify backup after creation' },
              { key: 'notifyOnFailure', label: 'Failure Notifications', desc: 'Alert on backup failures' },
            ]?.map(opt => (
              <div key={opt?.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">{opt?.label}</p>
                  <p className="text-xs text-muted-foreground">{opt?.desc}</p>
                </div>
                <button
                  onClick={() => setSchedule(s => ({ ...s, [opt?.key]: !s?.[opt?.key] }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    schedule?.[opt?.key] ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    schedule?.[opt?.key] ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              saved
                ? 'bg-green-500 text-white' :'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {saved ? '✓ Saved Successfully' : 'Save Configuration'}
          </button>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-foreground font-semibold mb-4">Current Schedule Summary</h3>
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="CheckCircle" size={16} className="text-green-400" />
              <span className="text-green-400 font-medium text-sm">Backup System Active</span>
            </div>
            <p className="text-xs text-muted-foreground">Next backup scheduled for 03:00 AM</p>
          </div>

          {[
            { icon: 'Clock', label: 'Schedule', value: 'Daily at 03:00 AM UTC' },
            { icon: 'Archive', label: 'Retention', value: `${schedule?.retentionDays} days` },
            { icon: 'Zap', label: 'Compression', value: schedule?.compressionEnabled ? 'Enabled (gzip)' : 'Disabled' },
            { icon: 'Shield', label: 'Integrity Check', value: schedule?.integrityCheck ? 'Enabled' : 'Disabled' },
            { icon: 'Bell', label: 'Notifications', value: schedule?.notifyOnFailure ? 'On failure' : 'Disabled' },
          ]?.map(item => (
            <div key={item?.label} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name={item?.icon} size={14} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item?.label}</p>
                <p className="text-sm font-medium text-foreground">{item?.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BackupScheduleConfig;
