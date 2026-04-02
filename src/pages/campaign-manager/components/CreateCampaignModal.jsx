import { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ContentEditor from './ContentEditor';
import LiveScoreGauge from './LiveScoreGauge';
import AudienceSelector from './AudienceSelector';
import SeedTestPanel from './SeedTestPanel';

const CreateCampaignModal = ({ isOpen, onClose, onCreateCampaign, contactLists }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    htmlContent: '',
    textContent: '',
    selectedList: '',
    status: 'Draft'
  });
  const [scoreData, setScoreData] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [threatAssessment, setThreatAssessment] = useState(null);

  // Calculate Threat Assessment Matrix (0-100 Risk Score)
  useEffect(() => {
    if (formData?.selectedList && scoreData?.score) {
      const selectedListData = contactLists?.find(list => list?.id === formData?.selectedList);
      
      if (selectedListData) {
        // List Score (40% weight) - based on tier
        let listScore = 0;
        if (selectedListData?.tier === 'Platinum') listScore = 0;
        else if (selectedListData?.tier === 'Gold') listScore = 10;
        else if (selectedListData?.tier === 'Silver') listScore = 25;
        else if (selectedListData?.tier === 'Bronze') listScore = 35;
        else if (selectedListData?.tier === 'Lead') listScore = 40;

        // Content Score (30% weight) - inverted from 0-10 scale
        const contentRisk = ((10 - parseFloat(scoreData?.score)) / 10) * 30;

        // Domain Health Score (20% weight) - simulated
        const domainHealthRisk = 5; // Assume good domain health

        // Sender History Score (10% weight) - simulated
        const senderHistoryRisk = 3; // Assume good sender history

        const totalRiskScore = Math.round(listScore + contentRisk + domainHealthRisk + senderHistoryRisk);

        // Determine recommended server
        let recommendedServer = '';
        let recommendation = '';
        
        if (totalRiskScore <= 30) {
          recommendedServer = 'Production';
          recommendation = `Assign to Production Server. This campaign has excellent metrics (Risk: ${totalRiskScore}/100). Safe for high-reputation infrastructure.`;
        } else if (totalRiskScore <= 50) {
          recommendedServer = 'Production';
          recommendation = `Assign to Production Server with monitoring. Moderate risk detected (Risk: ${totalRiskScore}/100). Campaign will be closely monitored.`;
        } else if (totalRiskScore <= 70) {
          recommendedServer = 'Canary';
          recommendation = `Recommendation: Assign to Canary Server. Risk score is ${totalRiskScore}/100 due to ${selectedListData?.tier} tier list. Too risky for Production infrastructure. A Canary simulation will be run automatically.`;
        } else {
          recommendedServer = 'Canary';
          recommendation = `REQUIRED: Assign to Canary Server. High risk detected (Risk: ${totalRiskScore}/100). Canary simulation mandatory before main send. Consider improving content or selecting a higher-tier list.`;
        }

        setThreatAssessment({
          riskScore: totalRiskScore,
          listScore,
          contentRisk: Math.round(contentRisk),
          domainHealthRisk,
          senderHistoryRisk,
          recommendedServer,
          recommendation,
          requiresCanary: totalRiskScore > 40
        });
      }
    }
  }, [formData?.selectedList, scoreData, contactLists]);

  const handleScoreUpdate = (data) => {
    setScoreData(data);
  };

  const handleSendTest = (results) => {
    setTestResults(results);
  };

  const handleSubmit = () => {
    const newCampaign = {
      id: Date.now(),
      name: formData?.name,
      subject: formData?.subject,
      status: formData?.status,
      riskProfile: threatAssessment?.riskScore <= 30 ? 'Low' : threatAssessment?.riskScore <= 60 ? 'Medium' : 'High',
      riskScore: threatAssessment?.riskScore || 0,
      contentScore: scoreData?.score || '0.0',
      sent: 0,
      delivered: 0,
      createdAt: new Date()?.toISOString(),
      assignedServer: threatAssessment?.recommendedServer || 'Production'
    };

    onCreateCampaign(newCampaign);
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      name: '',
      subject: '',
      htmlContent: '',
      textContent: '',
      selectedList: '',
      status: 'Draft'
    });
    setScoreData(null);
    setTestResults(null);
    setThreatAssessment(null);
    onClose();
  };

  const canProceedToStep2 = formData?.name && formData?.subject && formData?.htmlContent;
  const canProceedToStep3 = canProceedToStep2 && formData?.selectedList;
  const canSubmit = canProceedToStep3 && threatAssessment;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[90vh] bg-card rounded-lg border border-border shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
          <div>
            <h2 className="text-xl md:text-2xl font-heading font-semibold text-foreground">
              Risk-Aware Campaign Creator
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Step {currentStep} of 4 - {currentStep === 1 ? 'Content' : currentStep === 2 ? 'Audience' : currentStep === 3 ? 'Threat Assessment' : 'Test'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            iconName="X"
            iconSize={20}
            onClick={handleClose}
          />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4]?.map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-medium transition-smooth ${
                        currentStep >= step
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {currentStep > step ? (
                        <Icon name="Check" size={20} />
                      ) : (
                        step
                      )}
                    </div>
                    <div className="ml-3 hidden md:block">
                      <div className={`text-sm font-medium ${
                        currentStep >= step ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step === 1 ? 'Content' : step === 2 ? 'Audience' : step === 3 ? 'Risk' : 'Test'}
                      </div>
                    </div>
                  </div>
                  {step < 4 && (
                    <div className={`flex-1 h-0.5 mx-2 md:mx-4 ${
                      currentStep > step ? 'bg-primary' : 'bg-border'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <Input
                  label="Campaign Name"
                  type="text"
                  placeholder="Enter campaign name"
                  value={formData?.name}
                  onChange={(e) => setFormData({ ...formData, name: e?.target?.value })}
                  required
                  description="Internal name for this campaign"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <ContentEditor
                    formData={formData}
                    onChange={setFormData}
                    onScoreUpdate={handleScoreUpdate}
                  />
                </div>
                <div>
                  <LiveScoreGauge scoreData={scoreData} />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <AudienceSelector
              contactLists={contactLists}
              selectedList={formData?.selectedList}
              onSelectList={(listId) => setFormData({ ...formData, selectedList: listId })}
            />
          )}

          {currentStep === 3 && threatAssessment && (
            <div className="space-y-6">
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-heading font-semibold text-foreground">
                    Threat Assessment Matrix
                  </h3>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="Shield" size={24} className="text-primary" />
                  </div>
                </div>

                <div className="flex items-center justify-center mb-8">
                  <div className="relative w-48 h-48">
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
                        strokeDasharray={2 * Math.PI * 70}
                        strokeDashoffset={2 * Math.PI * 70 * (1 - threatAssessment?.riskScore / 100)}
                        strokeLinecap="round"
                        className={`${
                          threatAssessment?.riskScore <= 30 ? 'text-success' :
                          threatAssessment?.riskScore <= 60 ? 'text-warning' : 'text-error'
                        } transition-all duration-1000 ease-out`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className={`text-5xl font-heading font-bold ${
                        threatAssessment?.riskScore <= 30 ? 'text-success' :
                        threatAssessment?.riskScore <= 60 ? 'text-warning' : 'text-error'
                      }`}>
                        {threatAssessment?.riskScore}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Risk Score</div>
                      <div className={`text-xs font-medium mt-2 px-3 py-1 rounded-full ${
                        threatAssessment?.riskScore <= 30 ? 'bg-success/10 text-success' :
                        threatAssessment?.riskScore <= 60 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'
                      }`}>
                        {threatAssessment?.riskScore <= 30 ? 'Low Risk' :
                         threatAssessment?.riskScore <= 60 ? 'Medium Risk' : 'High Risk'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">List Score</div>
                    <div className="text-2xl font-heading font-bold text-foreground">{threatAssessment?.listScore}</div>
                    <div className="text-xs text-muted-foreground mt-1">40% weight</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Content Risk</div>
                    <div className="text-2xl font-heading font-bold text-foreground">{threatAssessment?.contentRisk}</div>
                    <div className="text-xs text-muted-foreground mt-1">30% weight</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Domain Health</div>
                    <div className="text-2xl font-heading font-bold text-foreground">{threatAssessment?.domainHealthRisk}</div>
                    <div className="text-xs text-muted-foreground mt-1">20% weight</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Sender History</div>
                    <div className="text-2xl font-heading font-bold text-foreground">{threatAssessment?.senderHistoryRisk}</div>
                    <div className="text-xs text-muted-foreground mt-1">10% weight</div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  threatAssessment?.riskScore <= 30 ? 'bg-success/5 border-success/20' :
                  threatAssessment?.riskScore <= 60 ? 'bg-warning/5 border-warning/20' : 'bg-error/5 border-error/20'
                }`}>
                  <div className="flex items-start gap-3">
                    <Icon name="Info" size={20} className={`mt-0.5 flex-shrink-0 ${
                      threatAssessment?.riskScore <= 30 ? 'text-success' :
                      threatAssessment?.riskScore <= 60 ? 'text-warning' : 'text-error'
                    }`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground mb-1">
                        Server Assignment Recommendation
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {threatAssessment?.recommendation}
                      </div>
                    </div>
                  </div>
                </div>

                {threatAssessment?.requiresCanary && (
                  <div className="mt-4 p-4 bg-warning/5 border border-warning/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Icon name="AlertTriangle" size={20} className="text-warning mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground mb-1">
                          Canary Simulation Required
                        </div>
                        <div className="text-sm text-muted-foreground">
                          This campaign will automatically send to a 1% sample (or 500 recipients minimum) and monitor for 4 hours. 
                          If complaint rate exceeds 0.1% or inbox placement falls below 95%, the main campaign will be auto-paused.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <SeedTestPanel
              campaignData={formData}
              onSendTest={handleSendTest}
            />
          )}
        </div>

        <div className="flex items-center justify-between p-4 md:p-6 border-t border-border">
          <Button
            variant="outline"
            iconName="ChevronLeft"
            iconPosition="left"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : handleClose()}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex gap-3">
            {currentStep < 4 ? (
              <Button
                variant="default"
                iconName="ChevronRight"
                iconPosition="right"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3) ||
                  (currentStep === 3 && !threatAssessment)
                }
              >
                Next Step
              </Button>
            ) : (
              <Button
                variant="default"
                iconName="Check"
                iconPosition="left"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                Create Campaign
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaignModal;