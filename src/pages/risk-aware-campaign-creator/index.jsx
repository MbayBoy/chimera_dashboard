import { useState } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import AudienceStepEnhanced from './components/AudienceStepEnhanced';
import ContentStepEnhanced from './components/ContentStepEnhanced';
import ThreatAssessmentStep from './components/ThreatAssessmentStep';
import CanarySimulationStep from './components/CanarySimulationStep';
import FinalReviewStep from './components/FinalReviewStep';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

const RiskAwareCampaignCreator = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    htmlContent: '',
    textContent: '',
    selectedList: '',
    fromAddress: '',
    domain: ''
  });

  const [riskAssessment, setRiskAssessment] = useState({
    riskScore: 0,
    listScore: 0,
    contentScore: 0,
    domainHealthScore: 0,
    senderHistoryScore: 0,
    recommendation: ''
  });

  const [canaryConfig, setCanaryConfig] = useState({
    enabled: false,
    sampleSize: 1,
    monitoringPeriod: 4,
    status: 'pending'
  });

  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const contactLists = [
    {
      id: 'list-1',
      name: 'Premium Customers - Platinum Tier',
      subscriberCount: 8920,
      averageEngagement: 95,
      tiers: {
        platinum: 8920,
        gold: 0,
        silver: 0,
        bronze: 0,
        lead: 0
      },
      tierBreakdown: 'Platinum: 100%',
      riskLevel: 'Low'
    },
    {
      id: 'list-2',
      name: 'Active Subscribers - Gold Tier',
      subscriberCount: 15420,
      averageEngagement: 88,
      tiers: {
        platinum: 0,
        gold: 15420,
        silver: 0,
        bronze: 0,
        lead: 0
      },
      tierBreakdown: 'Gold: 100%',
      riskLevel: 'Low'
    },
    {
      id: 'list-3',
      name: 'Regular Subscribers - Silver Tier',
      subscriberCount: 12340,
      averageEngagement: 72,
      tiers: {
        platinum: 0,
        gold: 0,
        silver: 12340,
        bronze: 0,
        lead: 0
      },
      tierBreakdown: 'Silver: 100%',
      riskLevel: 'Medium'
    },
    {
      id: 'list-4',
      name: 'Inactive Users - Bronze Tier',
      subscriberCount: 6780,
      averageEngagement: 58,
      tiers: {
        platinum: 0,
        gold: 0,
        silver: 0,
        bronze: 6780,
        lead: 0
      },
      tierBreakdown: 'Bronze: 100%',
      riskLevel: 'High'
    },
    {
      id: 'list-5',
      name: 'New Leads - Lead Tier',
      subscriberCount: 1770,
      averageEngagement: 35,
      tiers: {
        platinum: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        lead: 1770
      },
      tierBreakdown: 'Lead: 100%',
      riskLevel: 'High'
    },
    {
      id: 'list-6',
      name: 'Mixed Engagement List',
      subscriberCount: 25000,
      averageEngagement: 74,
      tiers: {
        platinum: 2500,
        gold: 7500,
        silver: 10000,
        bronze: 4000,
        lead: 1000
      },
      tierBreakdown: 'Platinum: 10%, Gold: 30%, Silver: 40%, Bronze: 16%, Lead: 4%',
      riskLevel: 'Medium'
    }
  ];

  const steps = [
    { id: 1, label: 'Audience', icon: 'Users' },
    { id: 2, label: 'Content', icon: 'FileText' },
    { id: 3, label: 'Risk Assessment', icon: 'Shield' },
    { id: 4, label: 'Canary Test', icon: 'TestTube' },
    { id: 5, label: 'Review', icon: 'CheckCircle2' }
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData?.selectedList && formData?.fromAddress;
      case 2:
        return formData?.name && formData?.subject && formData?.htmlContent;
      case 3:
        return riskAssessment?.riskScore > 0;
      case 4:
        return canaryConfig?.status === 'completed' || canaryConfig?.status === 'skipped';
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session) throw new Error('Not authenticated. Please log in again.');

      const { error } = await supabase?.from('campaigns')?.insert({
        name: formData?.name,
        subject: formData?.subject,
        body_html: formData?.htmlContent,
        body_text: formData?.textContent,
        from_address: formData?.fromAddress,
        list_id: formData?.selectedList,
        campaign_status: 'Draft',
        risk_score: riskAssessment?.riskScore,
        canary_enabled: canaryConfig?.enabled,
        user_id: session?.user?.id,
      });

      if (error) throw error;
      toast?.success('Campaign created successfully! You can manage it in Campaign Manager.', 'Campaign Created');
      setCurrentStep(1);
      setFormData({ name: '', subject: '', htmlContent: '', textContent: '', selectedList: '', fromAddress: '', domain: '' });
      setRiskAssessment({ riskScore: 0, listScore: 0, contentScore: 0, domainHealthScore: 0, senderHistoryScore: 0, recommendation: '' });
      setCanaryConfig({ enabled: false, sampleSize: 1, monitoringPeriod: 4, status: 'pending' });
    } catch (err) {
      const msg = err?.message || 'Failed to create campaign';
      if (msg?.includes('spam') || msg?.includes('score')) {
        toast?.error('Campaign blocked: spam score too high. Review your content and try again.', 'Spam Score Error');
      } else if (msg?.includes('list') || msg?.includes('audience')) {
        toast?.error('Invalid audience selection. Please choose a valid contact list.', 'Audience Error');
      } else if (msg?.includes('auth') || msg?.includes('authenticated')) {
        toast?.error('Authentication error. Please refresh and log in again.', 'Auth Error');
      } else {
        toast?.error(msg, 'Campaign Creation Failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <main 
        className={`pt-20 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[280px]'
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-6 md:mb-8">
            <Breadcrumbs />
            <h1 className="text-3xl md:text-4xl font-heading font-semibold text-foreground mt-4 mb-2">
              Risk-Aware Campaign Creator
            </h1>
            <p className="text-base md:text-lg text-muted-foreground">
              Intelligent campaign creation with threat assessment and system recommendations
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-6">
                  {steps?.map((step, index) => (
                    <div key={step?.id} className="flex items-center flex-1">
                      <div className="flex items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-smooth ${
                            currentStep >= step?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {currentStep > step?.id ? (
                            <Icon name="Check" size={20} />
                          ) : (
                            <Icon name={step?.icon} size={20} />
                          )}
                        </div>
                        <div className="ml-3 hidden md:block">
                          <div className={`text-sm font-medium ${
                            currentStep >= step?.id ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {step?.label}
                          </div>
                        </div>
                      </div>
                      {index < steps?.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-4 ${
                          currentStep > step?.id ? 'bg-primary' : 'bg-border'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 min-h-[500px]">
                {currentStep === 1 && (
                  <AudienceStepEnhanced
                    contactLists={contactLists}
                    formData={formData}
                    setFormData={setFormData}
                  />
                )}
                {currentStep === 2 && (
                  <ContentStepEnhanced
                    formData={formData}
                    setFormData={setFormData}
                  />
                )}
                {currentStep === 3 && (
                  <ThreatAssessmentStep
                    formData={formData}
                    contactLists={contactLists}
                    riskAssessment={riskAssessment}
                    setRiskAssessment={setRiskAssessment}
                    setCanaryConfig={setCanaryConfig}
                  />
                )}
                {currentStep === 4 && (
                  <CanarySimulationStep
                    canaryConfig={canaryConfig}
                    setCanaryConfig={setCanaryConfig}
                    riskAssessment={riskAssessment}
                  />
                )}
                {currentStep === 5 && (
                  <FinalReviewStep
                    formData={formData}
                    riskAssessment={riskAssessment}
                    canaryConfig={canaryConfig}
                    contactLists={contactLists}
                  />
                )}
              </div>

              <div className="flex items-center justify-between p-6 border-t border-border">
                <Button
                  variant="outline"
                  iconName="ChevronLeft"
                  iconPosition="left"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                >
                  Back
                </Button>

                <div className="flex gap-3">
                  {currentStep < 5 ? (
                    <Button
                      variant="default"
                      iconName="ChevronRight"
                      iconPosition="right"
                      onClick={handleNext}
                      disabled={!canProceed()}
                    >
                      Next Step
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      iconName="Send"
                      iconPosition="left"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? 'Creating...' : 'Create Campaign'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RiskAwareCampaignCreator;