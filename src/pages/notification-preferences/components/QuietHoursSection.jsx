import Icon from '../../../components/AppIcon';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Singapore',
];

const QuietHoursSection = ({ quietHours, onChange }) => {
  const handleChange = (field, value) => {
    onChange({ ...quietHours, [field]: value });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Icon name="Moon" size={18} className="text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Quiet Hours</h2>
            <p className="text-xs text-muted-foreground">Suppress non-critical alerts during specified hours</p>
          </div>
        </div>
        <button
          onClick={() => handleChange('enabled', !quietHours?.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            quietHours?.enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            quietHours?.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>
      <div className={`space-y-4 transition-opacity ${quietHours?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start Time</label>
            <input
              type="time"
              value={quietHours?.startTime}
              onChange={e => handleChange('startTime', e?.target?.value)}
              className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">End Time</label>
            <input
              type="time"
              value={quietHours?.endTime}
              onChange={e => handleChange('endTime', e?.target?.value)}
              className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Timezone</label>
            <select
              value={quietHours?.timezone}
              onChange={e => handleChange('timezone', e?.target?.value)}
              className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
            >
              {TIMEZONES?.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
          <Icon name="Info" size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            During quiet hours ({quietHours?.startTime} – {quietHours?.endTime} {quietHours?.timezone}),
            only <span className="text-error font-medium">Critical</span> alerts will be delivered.
            High, Medium, and Low severity alerts will be queued and delivered after quiet hours end.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuietHoursSection;
