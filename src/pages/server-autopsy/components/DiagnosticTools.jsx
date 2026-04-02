import Icon from '../../../components/AppIcon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DiagnosticTools = ({ data }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pass':
        return 'text-success';
      case 'warning':
        return 'text-warning';
      case 'fail':
        return 'text-error';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pass':
        return 'CheckCircle2';
      case 'warning':
        return 'AlertTriangle';
      case 'fail':
        return 'XCircle';
      default:
        return 'Circle';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">
            Diagnostic Tools
          </h2>
          <p className="text-sm text-muted-foreground">
            DNS, blacklist, and reputation analysis
          </p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="Stethoscope" size={24} className="text-primary" />
        </div>
      </div>

      <div className="space-y-6">
        {/* DNS Status */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            DNS Configuration
          </div>
          <div className="space-y-2">
            {Object.entries(data?.dnsStatus || {})?.map(([key, config]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Icon 
                    name={getStatusIcon(config?.status)} 
                    size={16} 
                    className={getStatusColor(config?.status)}
                  />
                  <span className="text-sm font-medium text-foreground uppercase">{key}</span>
                </div>
                <span className={`text-xs font-medium ${getStatusColor(config?.status)}`}>
                  {config?.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Blacklist Status */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Blacklist Memberships ({data?.blacklists?.filter(b => b?.listed)?.length})
          </div>
          <div className="space-y-2">
            {data?.blacklists?.map((blacklist, index) => (
              <div key={index} className="p-3 bg-error/5 border border-error/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="AlertCircle" size={16} className="text-error" />
                    <span className="text-sm font-medium text-foreground">{blacklist?.name}</span>
                  </div>
                  <span className="text-xs font-medium text-error">Listed</span>
                </div>
                <a 
                  href={blacklist?.delistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Request Delisting
                  <Icon name="ExternalLink" size={12} />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Reputation Trend */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Reputation Trend (7 Days)
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.reputationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--error))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--error))', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticTools;