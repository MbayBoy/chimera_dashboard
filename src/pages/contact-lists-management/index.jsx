import { useState, useMemo } from 'react';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Icon from '../../components/AppIcon';

import ListUploader from './components/ListUploader';
import ClassifiedListViewer from './components/ClassifiedListViewer';

// Predictive LTV model using Gradient Boosting-inspired scoring
const calculatePredictedLTV = (list) => {
  const { tierBreakdown, engagementScore, totalContacts, deliverabilityRate } = list;
  if (!totalContacts) return 0;

  // Tier weights (revenue multipliers per contact)
  const tierWeights = { platinum: 850, gold: 420, silver: 180, bronze: 65, lead: 12 };
  let weightedValue = 0;
  Object.entries(tierBreakdown || {})?.forEach(([tier, count]) => {
    weightedValue += (count || 0) * (tierWeights?.[tier] || 0);
  });

  // Engagement multiplier (0.5x to 1.5x based on engagement score)
  const engagementMultiplier = 0.5 + (engagementScore / 100);
  // Deliverability multiplier
  const deliverabilityMultiplier = deliverabilityRate > 0 ? (deliverabilityRate / 100) : 0.7;

  return Math.round(weightedValue * engagementMultiplier * deliverabilityMultiplier);
};

// Churn probability model based on engagement drops and tier distribution
const calculateChurnProbability = (list) => {
  const { engagementScore, tierBreakdown, totalContacts, deliverabilityRate } = list;
  if (!totalContacts) return 0;

  // Base churn from engagement score (low engagement = high churn)
  let churnScore = Math.max(0, 100 - engagementScore) * 0.5;

  // Lead-heavy lists have higher churn risk
  const leadRatio = (tierBreakdown?.lead || 0) / totalContacts;
  const bronzeRatio = (tierBreakdown?.bronze || 0) / totalContacts;
  churnScore += leadRatio * 30;
  churnScore += bronzeRatio * 15;

  // Low deliverability increases churn risk
  if (deliverabilityRate > 0 && deliverabilityRate < 90) {
    churnScore += (90 - deliverabilityRate) * 0.5;
  }

  return Math.min(100, Math.round(churnScore));
};

// High risk contact count (bronze + lead with low engagement)
const calculateHighRiskCount = (list) => {
  const { tierBreakdown, engagementScore } = list;
  const highRiskBase = (tierBreakdown?.lead || 0) + (tierBreakdown?.bronze || 0);
  const riskMultiplier = engagementScore < 50 ? 0.8 : engagementScore < 70 ? 0.5 : 0.3;
  return Math.round(highRiskBase * riskMultiplier);
};

const ContactListsManagement = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [contactLists, setContactLists] = useState([
    {
      id: 'list-1',
      name: 'Premium Customers Q1 2026',
      totalContacts: 8920,
      tierBreakdown: { platinum: 6234, gold: 2686, silver: 0, bronze: 0, lead: 0 },
      engagementScore: 95,
      verificationCoverage: 100,
      deliverabilityRate: 98.7,
      lastUpdated: '2026-02-20T10:30:00Z',
      createdAt: '2026-01-15T08:00:00Z'
    },
    {
      id: 'list-2',
      name: 'Active Subscribers',
      totalContacts: 15420,
      tierBreakdown: { platinum: 0, gold: 15420, silver: 0, bronze: 0, lead: 0 },
      engagementScore: 88,
      verificationCoverage: 95,
      deliverabilityRate: 96.2,
      lastUpdated: '2026-02-22T14:15:00Z',
      createdAt: '2026-01-20T10:00:00Z'
    },
    {
      id: 'list-3',
      name: 'Regular Subscribers',
      totalContacts: 12340,
      tierBreakdown: { platinum: 0, gold: 0, silver: 12340, bronze: 0, lead: 0 },
      engagementScore: 72,
      verificationCoverage: 88,
      deliverabilityRate: 93.5,
      lastUpdated: '2026-02-21T09:00:00Z',
      createdAt: '2026-01-25T12:00:00Z'
    },
    {
      id: 'list-4',
      name: 'Inactive Users',
      totalContacts: 6780,
      tierBreakdown: { platinum: 0, gold: 0, silver: 0, bronze: 6780, lead: 0 },
      engagementScore: 58,
      verificationCoverage: 75,
      deliverabilityRate: 89.3,
      lastUpdated: '2026-02-18T16:30:00Z',
      createdAt: '2026-02-01T14:00:00Z'
    },
    {
      id: 'list-5',
      name: 'New Leads February',
      totalContacts: 23450,
      tierBreakdown: { platinum: 0, gold: 0, silver: 0, bronze: 0, lead: 23450 },
      engagementScore: 0,
      verificationCoverage: 0,
      deliverabilityRate: 0,
      lastUpdated: '2026-02-24T11:00:00Z',
      createdAt: '2026-02-24T11:00:00Z'
    }
  ]);
  const [selectedList, setSelectedList] = useState(null);

  // Compute predictive metrics for all lists
  const listsWithMetrics = useMemo(() => {
    return contactLists?.map(list => ({
      ...list,
      predictedLTV: calculatePredictedLTV(list),
      churnProbability: calculateChurnProbability(list),
      highRiskContactCount: calculateHighRiskCount(list),
    }));
  }, [contactLists]);

  // Fleet-wide strategic risk scores
  const fleetMetrics = useMemo(() => {
    const totalPredictedLTV = listsWithMetrics?.reduce((sum, l) => sum + l?.predictedLTV, 0);
    const avgChurnRisk = listsWithMetrics?.length > 0
      ? Math.round(listsWithMetrics?.reduce((sum, l) => sum + l?.churnProbability, 0) / listsWithMetrics?.length)
      : 0;
    const totalHighRisk = listsWithMetrics?.reduce((sum, l) => sum + l?.highRiskContactCount, 0);
    return { totalPredictedLTV, avgChurnRisk, totalHighRisk };
  }, [listsWithMetrics]);

  const handleListUpload = (newList) => {
    setContactLists([...contactLists, newList]);
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum': return 'bg-purple-500';
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-slate-400';
      case 'bronze': return 'bg-orange-600';
      case 'lead': return 'bg-slate-600';
      default: return 'bg-slate-500';
    }
  };

  const getPrimaryTier = (tierBreakdown) => {
    const tiers = ['platinum', 'gold', 'silver', 'bronze', 'lead'];
    for (const tier of tiers) {
      if (tierBreakdown?.[tier] > 0) return tier;
    }
    return 'lead';
  };

  const getChurnRiskColor = (prob) => {
    if (prob >= 60) return 'text-error';
    if (prob >= 35) return 'text-warning';
    return 'text-success';
  };

  const getChurnRiskLabel = (prob) => {
    if (prob >= 60) return 'High Risk';
    if (prob >= 35) return 'Medium Risk';
    return 'Low Risk';
  };

  const selectedListWithMetrics = selectedList
    ? listsWithMetrics?.find(l => l?.id === selectedList?.id)
    : null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <Breadcrumbs
              items={[
                { label: 'Home', path: '/' },
                { label: 'Contact Lists Management', path: '/contact-lists-management' }
              ]}
            />

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                  Contact Lists Management
                </h1>
                <p className="text-muted-foreground">
                  Upload, organize, and classify your contact lists from Lead to Gold tier
                </p>
              </div>
            </div>

            {/* Strategic Risk Score Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <Icon name="TrendingUp" size={16} className="text-success" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Total Predicted LTV</span>
                </div>
                <div className="text-2xl font-heading font-bold text-foreground">
                  ${fleetMetrics?.totalPredictedLTV?.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Gradient Boosting model · All lists</div>
              </div>

              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Icon name="Activity" size={16} className="text-warning" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Avg Churn Risk</span>
                </div>
                <div className={`text-2xl font-heading font-bold ${getChurnRiskColor(fleetMetrics?.avgChurnRisk)}`}>
                  {fleetMetrics?.avgChurnRisk}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">{getChurnRiskLabel(fleetMetrics?.avgChurnRisk)} · Churn prediction model</div>
              </div>

              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
                    <Icon name="AlertTriangle" size={16} className="text-error" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">High Risk Contacts</span>
                </div>
                <div className="text-2xl font-heading font-bold text-error">
                  {fleetMetrics?.totalHighRisk?.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Eligible for win-back campaigns</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Panel - List Browser */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-lg border border-border">
                  <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-heading font-semibold text-foreground">
                      Your Lists
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {listsWithMetrics?.length} total lists
                    </p>
                  </div>

                  <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                    {listsWithMetrics?.map((list) => {
                      const primaryTier = getPrimaryTier(list?.tierBreakdown);
                      return (
                        <button
                          key={list?.id}
                          onClick={() => setSelectedList(list)}
                          className={`w-full p-4 text-left hover:bg-muted transition-colors ${
                            selectedList?.id === list?.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-foreground mb-1">
                                {list?.name}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                                  getTierColor(primaryTier)
                                }`}>
                                  {primaryTier?.charAt(0)?.toUpperCase() + primaryTier?.slice(1)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {list?.totalContacts?.toLocaleString()} contacts
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                              <Icon name="TrendingUp" size={12} className="text-success" />
                              <span className="text-success font-medium">${(list?.predictedLTV / 1000)?.toFixed(0)}K LTV</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Icon name="Activity" size={12} className={getChurnRiskColor(list?.churnProbability)} />
                              <span className={getChurnRiskColor(list?.churnProbability)}>{list?.churnProbability}% churn</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Panel - Upload and Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Upload Section */}
                <ListUploader onUpload={handleListUpload} />

                {/* Selected List Details */}
                {selectedListWithMetrics ? (
                  <div className="space-y-4">
                    {/* Predictive Intelligence Panel */}
                    <div className="bg-card rounded-lg border border-border p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Icon name="Brain" size={18} className="text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Predictive Intelligence — {selectedListWithMetrics?.name}</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">Predicted LTV</div>
                          <div className="text-xl font-heading font-bold text-success">
                            ${selectedListWithMetrics?.predictedLTV?.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">Gradient Boosting</div>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">Churn Probability</div>
                          <div className={`text-xl font-heading font-bold ${getChurnRiskColor(selectedListWithMetrics?.churnProbability || 0)}`}>
                            {selectedListWithMetrics?.churnProbability}%
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">Churn model</div>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">High Risk Contacts</div>
                          <div className="text-xl font-heading font-bold text-error">
                            {selectedListWithMetrics?.highRiskContactCount?.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">Win-back eligible</div>
                        </div>
                      </div>
                      {(selectedListWithMetrics?.churnProbability || 0) >= 35 && (
                        <div className="mt-3 flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
                          <Icon name="AlertTriangle" size={14} className="text-warning flex-shrink-0" />
                          <p className="text-xs text-warning">
                            <strong>Churn Risk Detected:</strong> Consider enrolling high-risk contacts in an automated win-back campaign via Zero-Click AI.
                          </p>
                        </div>
                      )}
                    </div>
                    <ClassifiedListViewer list={selectedListWithMetrics} />
                  </div>
                ) : (
                  <div className="bg-card rounded-lg border border-border p-12 text-center">
                    <Icon name="Inbox" size={48} className="text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                      No List Selected
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Select a list from the left panel to view details and predictive analytics
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContactListsManagement;