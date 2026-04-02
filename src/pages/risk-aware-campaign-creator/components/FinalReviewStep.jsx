import Icon from '../../../components/AppIcon';

const FinalReviewStep = ({ formData, riskAssessment, canaryConfig, contactLists }) => {
  const selectedList = contactLists?.find(list => list?.id === formData?.selectedList);

  const getRiskColor = (score) => {
    if (score <= 30) return 'text-success';
    if (score <= 50) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
          Step 5: Final Review
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Review all campaign details and system recommendations before deployment.
        </p>
      </div>
      <div className="space-y-4">
        <div className="bg-card rounded-lg border border-border p-6">
          <h4 className="text-base font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="FileText" size={18} />
            Campaign Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Campaign Name</div>
              <div className="text-sm font-medium text-foreground">{formData?.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Subject Line</div>
              <div className="text-sm font-medium text-foreground">{formData?.subject}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">From Address</div>
              <div className="text-sm font-medium text-foreground font-mono">{formData?.fromAddress}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Contact List</div>
              <div className="text-sm font-medium text-foreground">{selectedList?.name}</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h4 className="text-base font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Users" size={18} />
            Audience Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Total Recipients</div>
              <div className="text-xl font-heading font-semibold text-foreground">
                {selectedList?.subscriberCount?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Avg Engagement</div>
              <div className="text-xl font-heading font-semibold text-foreground">
                {selectedList?.averageEngagement}%
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">List Risk</div>
              <div className={`text-xl font-heading font-semibold ${
                selectedList?.riskLevel === 'Low' ? 'text-success' :
                selectedList?.riskLevel === 'Medium' ? 'text-warning' : 'text-error'
              }`}>
                {selectedList?.riskLevel}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Tier Quality</div>
              <div className="text-sm font-medium text-foreground">
                {selectedList?.tierBreakdown?.split(',')?.[0]}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h4 className="text-base font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Shield" size={18} />
            Risk Assessment
          </h4>
          <div className="flex items-center gap-6 mb-4">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(riskAssessment?.riskScore / 100) * 251} 251`}
                  strokeLinecap="round"
                  className={getRiskColor(riskAssessment?.riskScore)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-2xl font-heading font-bold ${getRiskColor(riskAssessment?.riskScore)}`}>
                  {riskAssessment?.riskScore}
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground mb-2">
                Overall Risk Score: <span className={getRiskColor(riskAssessment?.riskScore)}>{riskAssessment?.riskScore}/100</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {riskAssessment?.recommendation}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-2 bg-muted rounded text-center">
              <div className="text-xs text-muted-foreground">List</div>
              <div className="text-sm font-semibold text-foreground">{riskAssessment?.listScore?.toFixed(0)}/40</div>
            </div>
            <div className="p-2 bg-muted rounded text-center">
              <div className="text-xs text-muted-foreground">Content</div>
              <div className="text-sm font-semibold text-foreground">{riskAssessment?.contentScore?.toFixed(0)}/30</div>
            </div>
            <div className="p-2 bg-muted rounded text-center">
              <div className="text-xs text-muted-foreground">Domain</div>
              <div className="text-sm font-semibold text-foreground">{riskAssessment?.domainHealthScore?.toFixed(0)}/20</div>
            </div>
            <div className="p-2 bg-muted rounded text-center">
              <div className="text-xs text-muted-foreground">Sender</div>
              <div className="text-sm font-semibold text-foreground">{riskAssessment?.senderHistoryScore?.toFixed(0)}/10</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h4 className="text-base font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="TestTube" size={18} />
            Canary Simulation
          </h4>
          <div className="flex items-center gap-3">
            {canaryConfig?.status === 'completed' ? (
              <>
                <Icon name="CheckCircle2" size={20} className="text-success" />
                <div>
                  <div className="text-sm font-medium text-success">Simulation Completed</div>
                  <div className="text-xs text-muted-foreground">Campaign passed all quality thresholds</div>
                </div>
              </>
            ) : canaryConfig?.status === 'skipped' ? (
              <>
                <Icon name="SkipForward" size={20} className="text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-foreground">Simulation Skipped</div>
                  <div className="text-xs text-muted-foreground">Proceeding without canary testing</div>
                </div>
              </>
            ) : (
              <>
                <Icon name="AlertCircle" size={20} className="text-warning" />
                <div>
                  <div className="text-sm font-medium text-warning">Simulation Pending</div>
                  <div className="text-xs text-muted-foreground">Complete canary testing before deployment</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="Server" size={18} className="text-primary mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground mb-1">
                Recommended Infrastructure: {riskAssessment?.infrastructure}
              </div>
              <div className="text-xs text-muted-foreground">
                System will automatically assign this campaign to the appropriate server infrastructure based on risk assessment.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalReviewStep;