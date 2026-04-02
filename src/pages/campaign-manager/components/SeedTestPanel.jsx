import { useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const SeedTestPanel = ({ campaignData, onSendTest }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const handleSendTest = async () => {
    setIsTesting(true);
    setTestResults(null);

    setTimeout(() => {
      const mockResults = {
        inboxRate: Math.floor(Math.random() * 30) + 70,
        spamRate: Math.floor(Math.random() * 15) + 5,
        promotionsRate: Math.floor(Math.random() * 20) + 5,
        providers: [
          { name: 'Gmail', inbox: 92, spam: 5, promotions: 3 },
          { name: 'Outlook', inbox: 88, spam: 8, promotions: 4 },
          { name: 'Yahoo', inbox: 85, spam: 10, promotions: 5 },
          { name: 'Apple Mail', inbox: 95, spam: 3, promotions: 2 }
        ],
        recommendations: [
          'Subject line length is optimal',
          'HTML/Text ratio is balanced',
          'No major spam triggers detected',
          'Authentication records verified'
        ]
      };

      setTestResults(mockResults);
      setIsTesting(false);
      onSendTest(mockResults);
    }, 3000);
  };

  const getInboxRateColor = (rate) => {
    if (rate >= 85) return 'text-success';
    if (rate >= 70) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
            Seed Test
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Test deliverability across major email providers
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="TestTube" size={20} className="text-primary" />
        </div>
      </div>
      {!testResults && !isTesting && (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={16} className="text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground mb-1">
                  What is a seed test?
                </div>
                <div className="text-sm text-muted-foreground">
                  Send your campaign to a list of seed email addresses across major providers to predict inbox placement rates before sending to your full audience.
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-muted rounded-lg text-center">
              <Icon name="Mail" size={20} className="text-primary mx-auto mb-2" />
              <div className="text-xs text-muted-foreground">Gmail</div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <Icon name="Mail" size={20} className="text-primary mx-auto mb-2" />
              <div className="text-xs text-muted-foreground">Outlook</div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <Icon name="Mail" size={20} className="text-primary mx-auto mb-2" />
              <div className="text-xs text-muted-foreground">Yahoo</div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <Icon name="Mail" size={20} className="text-primary mx-auto mb-2" />
              <div className="text-xs text-muted-foreground">Apple Mail</div>
            </div>
          </div>

          <Button
            variant="default"
            fullWidth
            iconName="Send"
            iconPosition="left"
            onClick={handleSendTest}
            disabled={!campaignData?.subject || !campaignData?.htmlContent}
          >
            Send Seed Test
          </Button>
        </div>
      )}
      {isTesting && (
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-base font-medium text-foreground mb-2">
            Sending test emails...
          </div>
          <div className="text-sm text-muted-foreground">
            This may take a few moments
          </div>
        </div>
      )}
      {testResults && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Inbox" size={16} className="text-success" />
                <span className="text-xs text-muted-foreground">Inbox Rate</span>
              </div>
              <div className={`text-3xl font-heading font-bold ${getInboxRateColor(testResults?.inboxRate)}`}>
                {testResults?.inboxRate}%
              </div>
            </div>

            <div className="p-4 bg-error/5 border border-error/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="AlertTriangle" size={16} className="text-error" />
                <span className="text-xs text-muted-foreground">Spam Rate</span>
              </div>
              <div className="text-3xl font-heading font-bold text-error">
                {testResults?.spamRate}%
              </div>
            </div>

            <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Tag" size={16} className="text-warning" />
                <span className="text-xs text-muted-foreground">Promotions</span>
              </div>
              <div className="text-3xl font-heading font-bold text-warning">
                {testResults?.promotionsRate}%
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-caption font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Provider Breakdown
            </div>
            <div className="space-y-3">
              {testResults?.providers?.map((provider, index) => (
                <div key={index} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon name="Mail" size={16} className="text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{provider?.name}</span>
                    </div>
                    <span className={`text-sm font-mono font-medium ${getInboxRateColor(provider?.inbox)}`}>
                      {provider?.inbox}% inbox
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-2 bg-success rounded-full" style={{ width: `${provider?.inbox}%` }} />
                    <div className="flex-1 h-2 bg-error rounded-full" style={{ width: `${provider?.spam}%` }} />
                    <div className="flex-1 h-2 bg-warning rounded-full" style={{ width: `${provider?.promotions}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-caption font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Recommendations
            </div>
            <div className="space-y-2">
              {testResults?.recommendations?.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Icon name="CheckCircle2" size={16} className="text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              iconName="RotateCcw"
              iconPosition="left"
              onClick={handleSendTest}
            >
              Run Again
            </Button>
            <Button
              variant="default"
              fullWidth
              iconName="Send"
              iconPosition="left"
            >
              Proceed to Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedTestPanel;