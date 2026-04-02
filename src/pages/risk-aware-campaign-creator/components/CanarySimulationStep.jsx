import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CanarySimulationStep = ({ canaryConfig, setCanaryConfig, riskAssessment }) => {
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationResults, setSimulationResults] = useState(null);

  const handleStartSimulation = () => {
    setCanaryConfig({ ...canaryConfig, status: 'running' });
    setSimulationProgress(0);
    setSimulationResults(null);

    const interval = setInterval(() => {
      setSimulationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          const complaintRate = Math.random() * 0.2;
          const inboxPlacement = Math.random() * 10 + 90;
          const passed = complaintRate <= 0.1 && inboxPlacement >= 95;
          
          setSimulationResults({
            complaintRate: complaintRate?.toFixed(3),
            inboxPlacement: inboxPlacement?.toFixed(1),
            bounceRate: (Math.random() * 2)?.toFixed(2),
            sampleSize: Math.round(canaryConfig?.sampleSize * 500),
            passed: passed,
            recommendation: passed 
              ? 'Simulation passed all thresholds. Safe to proceed with full campaign deployment.' :'Simulation failed quality thresholds. Review content and list quality before proceeding.'
          });
          
          setCanaryConfig(prev => ({ ...prev, status: 'completed' }));
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const handleSkipSimulation = () => {
    setCanaryConfig({ ...canaryConfig, status: 'skipped' });
  };

  const isSimulationRequired = riskAssessment?.riskScore > 40;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
          Step 4: Canary Campaign Simulation
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {isSimulationRequired 
            ? 'Risk score requires canary testing. A small sample will be sent to validate campaign safety.' :'Optional canary testing available for additional validation before full deployment.'}
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-base font-heading font-semibold text-foreground">
            Simulation Configuration
          </h4>
          {isSimulationRequired && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
              <Icon name="AlertTriangle" size={12} />
              Required
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Users" size={16} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sample Size</span>
            </div>
            <div className="text-2xl font-heading font-semibold text-foreground">
              {canaryConfig?.sampleSize}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ~{Math.round(canaryConfig?.sampleSize * 500)} recipients
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Clock" size={16} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Monitor Period</span>
            </div>
            <div className="text-2xl font-heading font-semibold text-foreground">
              {canaryConfig?.monitoringPeriod}h
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Results analysis time
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Target" size={16} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thresholds</span>
            </div>
            <div className="text-sm font-medium text-foreground">
              Complaint ≤ 0.1%
            </div>
            <div className="text-sm font-medium text-foreground">
              Inbox ≥ 95%
            </div>
          </div>
        </div>

        {canaryConfig?.status === 'pending' && (
          <div className="flex gap-3">
            <Button
              variant="default"
              iconName="Play"
              onClick={handleStartSimulation}
              fullWidth
            >
              Start Canary Simulation
            </Button>
            {!isSimulationRequired && (
              <Button
                variant="outline"
                iconName="SkipForward"
                onClick={handleSkipSimulation}
              >
                Skip
              </Button>
            )}
          </div>
        )}

        {canaryConfig?.status === 'running' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Simulation in Progress</span>
              <span className="text-sm font-semibold text-primary">{simulationProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 mb-4">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${simulationProgress}%` }}
              >
                {simulationProgress > 10 && (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Sending to sample group and monitoring results...
            </div>
          </div>
        )}

        {canaryConfig?.status === 'completed' && simulationResults && (
          <div>
            <div className={`p-4 rounded-lg border mb-6 ${
              simulationResults?.passed 
                ? 'bg-success/10 border-success/30' :'bg-error/10 border-error/30'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <Icon 
                  name={simulationResults?.passed ? 'CheckCircle2' : 'XCircle'} 
                  size={24} 
                  className={simulationResults?.passed ? 'text-success' : 'text-error'} 
                />
                <div>
                  <div className={`text-base font-semibold ${
                    simulationResults?.passed ? 'text-success' : 'text-error'
                  }`}>
                    {simulationResults?.passed ? 'Simulation Passed' : 'Simulation Failed'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {simulationResults?.recommendation}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Complaint Rate</div>
                <div className={`text-xl font-heading font-semibold ${
                  parseFloat(simulationResults?.complaintRate) <= 0.1 ? 'text-success' : 'text-error'
                }`}>
                  {simulationResults?.complaintRate}%
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Inbox Placement</div>
                <div className={`text-xl font-heading font-semibold ${
                  parseFloat(simulationResults?.inboxPlacement) >= 95 ? 'text-success' : 'text-error'
                }`}>
                  {simulationResults?.inboxPlacement}%
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Bounce Rate</div>
                <div className="text-xl font-heading font-semibold text-foreground">
                  {simulationResults?.bounceRate}%
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Sample Size</div>
                <div className="text-xl font-heading font-semibold text-foreground">
                  {simulationResults?.sampleSize}
                </div>
              </div>
            </div>
          </div>
        )}

        {canaryConfig?.status === 'skipped' && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Icon name="SkipForward" size={20} className="text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">Simulation Skipped</div>
                <div className="text-xs text-muted-foreground">Proceeding directly to campaign deployment</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanarySimulationStep;