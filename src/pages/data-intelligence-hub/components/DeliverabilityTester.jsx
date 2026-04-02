import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';


const DeliverabilityTester = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [selectedProviders, setSelectedProviders] = useState({
    gmail: true,
    outlook: true,
    yahoo: true,
    aol: false,
    apple: false
  });

  const handleRunTest = () => {
    setIsRunning(true);
    setTestResults(null);

    // Simulate test execution
    setTimeout(() => {
      setTestResults({
        overallRate: 94.2,
        providers: [
          { name: 'Gmail', inbox: 95, spam: 3, promotional: 2, status: 'inbox' },
          { name: 'Outlook', inbox: 88, spam: 12, promotional: 0, status: 'spam' },
          { name: 'Yahoo', inbox: 97, spam: 2, promotional: 1, status: 'inbox' },
          { name: 'AOL', inbox: 92, spam: 8, promotional: 0, status: 'inbox' },
          { name: 'Apple Mail', inbox: 96, spam: 4, promotional: 0, status: 'inbox' }
        ],
        authentication: {
          spf: { status: 'pass', value: 'v=spf1 include:_spf.example.com ~all' },
          dkim: { status: 'pass', value: 'Valid signature found' },
          dmarc: { status: 'pass', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com' }
        },
        timestamp: new Date()?.toISOString()
      });
      setIsRunning(false);
    }, 3000);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'inbox':
        return <Icon name="CheckCircle" size={20} className="text-success" />;
      case 'spam':
        return <Icon name="AlertTriangle" size={20} className="text-warning" />;
      default:
        return <Icon name="Info" size={20} className="text-muted-foreground" />;
    }
  };

  const getAuthStatusColor = (status) => {
    switch (status) {
      case 'pass':
        return 'text-success';
      case 'fail':
        return 'text-error';
      default:
        return 'text-warning';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
          Seed List Configuration
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select email providers to test inbox placement rates
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Checkbox
            label="Gmail"
            checked={selectedProviders?.gmail}
            onChange={(e) => setSelectedProviders({ ...selectedProviders, gmail: e?.target?.checked })}
          />
          <Checkbox
            label="Outlook / Hotmail"
            checked={selectedProviders?.outlook}
            onChange={(e) => setSelectedProviders({ ...selectedProviders, outlook: e?.target?.checked })}
          />
          <Checkbox
            label="Yahoo Mail"
            checked={selectedProviders?.yahoo}
            onChange={(e) => setSelectedProviders({ ...selectedProviders, yahoo: e?.target?.checked })}
          />
          <Checkbox
            label="AOL Mail"
            checked={selectedProviders?.aol}
            onChange={(e) => setSelectedProviders({ ...selectedProviders, aol: e?.target?.checked })}
          />
          <Checkbox
            label="Apple Mail"
            checked={selectedProviders?.apple}
            onChange={(e) => setSelectedProviders({ ...selectedProviders, apple: e?.target?.checked })}
          />
        </div>

        <Button
          onClick={handleRunTest}
          loading={isRunning}
          disabled={isRunning}
          iconName="Play"
          className="w-full md:w-auto"
        >
          {isRunning ? 'Running Test...' : 'Run Deliverability Test'}
        </Button>
      </div>
      {isRunning && (
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin">
              <Icon name="Loader" size={24} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Test in Progress</div>
              <div className="text-xs text-muted-foreground">Sending test emails to seed list...</div>
            </div>
          </div>
        </div>
      )}
      {testResults && (
        <div className="space-y-6">
          {/* Overall Results */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-semibold text-foreground">
                Test Results
              </h3>
              <span className="text-xs text-muted-foreground">
                {new Date(testResults?.timestamp)?.toLocaleString()}
              </span>
            </div>

            <div className="bg-success/10 rounded-lg p-6 mb-6">
              <div className="text-center">
                <div className="text-4xl font-heading font-bold text-success mb-2">
                  {testResults?.overallRate}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Overall Inbox Placement Rate
                </div>
              </div>
            </div>

            {/* Provider Breakdown */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground mb-3">Provider Breakdown</h4>
              {testResults?.providers?.map((provider) => (
                <div key={provider?.name} className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(provider?.status)}
                      <span className="font-medium text-foreground">{provider?.name}</span>
                    </div>
                    <span className={`text-sm font-medium ${
                      provider?.status === 'inbox' ? 'text-success' : 'text-warning'
                    }`}>
                      {provider?.status === 'inbox' ? '✅ Inbox' : '⚠️ Spam'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Inbox</div>
                      <div className="text-lg font-semibold text-success">{provider?.inbox}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Spam</div>
                      <div className="text-lg font-semibold text-error">{provider?.spam}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Promotional</div>
                      <div className="text-lg font-semibold text-warning">{provider?.promotional}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Authentication Status */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
              Authentication Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Icon name="CheckCircle" size={20} className={getAuthStatusColor(testResults?.authentication?.spf?.status)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">SPF Record</span>
                    <span className={`text-xs font-medium uppercase ${getAuthStatusColor(testResults?.authentication?.spf?.status)}`}>
                      {testResults?.authentication?.spf?.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {testResults?.authentication?.spf?.value}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Icon name="CheckCircle" size={20} className={getAuthStatusColor(testResults?.authentication?.dkim?.status)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">DKIM Signature</span>
                    <span className={`text-xs font-medium uppercase ${getAuthStatusColor(testResults?.authentication?.dkim?.status)}`}>
                      {testResults?.authentication?.dkim?.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {testResults?.authentication?.dkim?.value}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Icon name="CheckCircle" size={20} className={getAuthStatusColor(testResults?.authentication?.dmarc?.status)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">DMARC Policy</span>
                    <span className={`text-xs font-medium uppercase ${getAuthStatusColor(testResults?.authentication?.dmarc?.status)}`}>
                      {testResults?.authentication?.dmarc?.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {testResults?.authentication?.dmarc?.value}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliverabilityTester;