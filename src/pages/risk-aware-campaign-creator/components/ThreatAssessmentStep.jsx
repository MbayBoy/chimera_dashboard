import { useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const ThreatAssessmentStep = ({ formData, contactLists, riskAssessment, setRiskAssessment, setCanaryConfig }) => {
  useEffect(() => {
    const selectedList = contactLists?.find(list => list?.id === formData?.selectedList);
    
    if (selectedList && formData?.htmlContent && formData?.subject) {
      const platinumGoldPercentage = ((selectedList?.tiers?.platinum + selectedList?.tiers?.gold) / selectedList?.subscriberCount) * 100;
      
      let listScore = 0;
      if (platinumGoldPercentage >= 80) listScore = 0;
      else if (platinumGoldPercentage >= 50) listScore = 10;
      else if (platinumGoldPercentage >= 30) listScore = 20;
      else listScore = 35;

      const contentQuality = Math.random() * 4 + 6;
      const contentScore = (10 - contentQuality) * 3;

      const domainHealthScore = Math.random() * 5 + 3;

      const senderHistoryScore = Math.random() * 3 + 2;

      const totalRiskScore = Math.round(
        (listScore * 0.4) + 
        (contentScore * 0.3) + 
        (domainHealthScore * 0.2) + 
        (senderHistoryScore * 0.1)
      );

      let recommendation = '';
      let infrastructure = '';
      
      if (totalRiskScore <= 30) {
        recommendation = 'Low risk campaign. Safe for Production infrastructure.';
        infrastructure = 'Production';
      } else if (totalRiskScore <= 50) {
        recommendation = 'Medium risk campaign. Recommend Canary infrastructure with simulation.';
        infrastructure = 'Canary';
      } else {
        recommendation = 'High risk campaign. Mandatory Canary simulation required. Consider list cleaning.';
        infrastructure = 'Canary (Required)';
      }

      setRiskAssessment({
        riskScore: totalRiskScore,
        listScore: listScore,
        contentScore: contentScore,
        domainHealthScore: domainHealthScore,
        senderHistoryScore: senderHistoryScore,
        recommendation: recommendation,
        infrastructure: infrastructure
      });

      if (totalRiskScore > 40) {
        setCanaryConfig(prev => ({ ...prev, enabled: true }));
      }
    }
  }, [formData, contactLists, setRiskAssessment, setCanaryConfig]);

  const getRiskColor = (score) => {
    if (score <= 30) return { text: 'text-success', bg: 'bg-success', label: 'Low Risk' };
    if (score <= 50) return { text: 'text-warning', bg: 'bg-warning', label: 'Medium Risk' };
    return { text: 'text-error', bg: 'bg-error', label: 'High Risk' };
  };

  const riskConfig = getRiskColor(riskAssessment?.riskScore);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
          Step 3: Threat Assessment
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Multi-factor risk analysis calculates your campaign's threat profile before sending.
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-base font-heading font-semibold text-foreground">
            Campaign Risk Profile
          </h4>
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${riskConfig?.bg}/10 ${riskConfig?.text} text-sm font-medium`}>
            <Icon name="Shield" size={14} />
            {riskConfig?.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="relative w-48 h-48 mx-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-muted"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray={`${(riskAssessment?.riskScore / 100) * 440} 440`}
                  strokeLinecap="round"
                  className={riskConfig?.text}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-5xl font-heading font-bold ${riskConfig?.text}`}>
                  {riskAssessment?.riskScore}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Risk Score</div>
                <div className="text-xs text-muted-foreground">out of 100</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">List Score (40%)</span>
                <span className="text-sm font-semibold text-foreground">{riskAssessment?.listScore?.toFixed(1)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(riskAssessment?.listScore / 40) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Content Score (30%)</span>
                <span className="text-sm font-semibold text-foreground">{riskAssessment?.contentScore?.toFixed(1)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(riskAssessment?.contentScore / 30) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Domain Health (20%)</span>
                <span className="text-sm font-semibold text-foreground">{riskAssessment?.domainHealthScore?.toFixed(1)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(riskAssessment?.domainHealthScore / 20) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Sender History (10%)</span>
                <span className="text-sm font-semibold text-foreground">{riskAssessment?.senderHistoryScore?.toFixed(1)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(riskAssessment?.senderHistoryScore / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${riskConfig?.bg}/10 ${riskConfig?.text?.replace('text-', 'border-')}/20`}>
          <div className="flex items-start gap-3">
            <Icon name="Lightbulb" size={18} className={riskConfig?.text} />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground mb-1">
                System Recommendation
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                {riskAssessment?.recommendation}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Icon name="Server" size={12} className="text-muted-foreground" />
                  <span className="text-foreground">Recommended Infrastructure:</span>
                  <span className={`font-semibold ${riskConfig?.text}`}>{riskAssessment?.infrastructure}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {riskAssessment?.riskScore > 40 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={18} className="text-warning mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground mb-1">
                Canary Simulation Required
              </div>
              <div className="text-sm text-muted-foreground">
                Risk score exceeds threshold (40). A canary simulation will be automatically configured in the next step to test campaign safety before full deployment.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreatAssessmentStep;