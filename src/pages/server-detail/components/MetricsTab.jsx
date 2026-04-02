import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const MetricsTab = ({ metricsData }) => {
  const [dateRange, setDateRange] = useState('7d');

  const dateRangeOptions = [
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry?.color }}
              />
              <span className="text-muted-foreground">{entry?.name}:</span>
              <span className="font-medium text-foreground">{entry?.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
            Performance Metrics
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            Track reputation score and daily sending limits over time
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {dateRangeOptions?.map((option) => (
            <Button
              key={option?.value}
              variant={dateRange === option?.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(option?.value)}
            >
              {option?.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="mb-4">
          <h4 className="text-base md:text-lg font-heading font-medium text-foreground mb-1">
            Reputation Score Trend
          </h4>
          <p className="text-sm text-muted-foreground">
            Higher scores indicate better sender reputation
          </p>
        </div>
        <div className="w-full h-64 md:h-80" aria-label="Reputation Score Line Chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metricsData?.reputationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey="date" 
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '14px' }}
                iconType="circle"
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                name="Reputation Score"
                stroke="var(--color-primary)" 
                strokeWidth={2}
                dot={{ fill: 'var(--color-primary)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="mb-4">
          <h4 className="text-base md:text-lg font-heading font-medium text-foreground mb-1">
            Daily Sending Limit
          </h4>
          <p className="text-sm text-muted-foreground">
            Monitor daily email sending capacity and usage
          </p>
        </div>
        <div className="w-full h-64 md:h-80" aria-label="Daily Limit Line Chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metricsData?.dailyLimitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey="date" 
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '14px' }}
                iconType="circle"
              />
              <Line 
                type="monotone" 
                dataKey="limit" 
                name="Daily Limit"
                stroke="var(--color-success)" 
                strokeWidth={2}
                dot={{ fill: 'var(--color-success)', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="sent" 
                name="Emails Sent"
                stroke="var(--color-accent)" 
                strokeWidth={2}
                dot={{ fill: 'var(--color-accent)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="TrendingUp" size={20} className="text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Average Score</div>
              <div className="text-xl font-heading font-semibold text-foreground">
                {metricsData?.averageReputation}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Last {dateRange === '24h' ? '24 hours' : dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : '90 days'}
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Icon name="Mail" size={20} className="text-success" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Sent</div>
              <div className="text-xl font-heading font-semibold text-foreground">
                {metricsData?.totalSent?.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Last {dateRange === '24h' ? '24 hours' : dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : '90 days'}
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Icon name="Percent" size={20} className="text-accent" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Capacity Used</div>
              <div className="text-xl font-heading font-semibold text-foreground">
                {metricsData?.capacityUsed}%
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Last {dateRange === '24h' ? '24 hours' : dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : '90 days'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsTab;