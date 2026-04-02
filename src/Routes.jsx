import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import { useAuth } from "./contexts/AuthContext";
import { useGoogleAnalytics } from "./hooks/useGoogleAnalytics";
import LoginPage from "./pages/login";
import SystemOverview from './pages/system-overview';
import ServerDetail from './pages/server-detail';
import CampaignManager from './pages/campaign-manager';
import WarRoomDashboard from './pages/war-room-dashboard';
import RiskAwareCampaignCreator from './pages/risk-aware-campaign-creator';
import ServerAutopsy from './pages/server-autopsy';
import DataIntelligenceHub from './pages/data-intelligence-hub';
import ContactListsManagement from './pages/contact-lists-management';
import EnhancedSystemOverview from './pages/enhanced-system-overview';
import ServerProvisioningWizard from './pages/server-provisioning-wizard';
import ServerManagement from './pages/server-management';
import MarketIntelligenceDashboard from './pages/market-intelligence-dashboard';
import ZeroClickCampaign from './pages/zero-click-campaign';
import FinancialManagement from './pages/financial-management';
import ABTestingEngine from './pages/ab-testing-engine';
import AutomationHub from './pages/automation-hub';
import STOScheduler from './pages/sto-scheduler';
import AnomalyDetectionDashboard from './pages/anomaly-detection-dashboard';
import SystemHealthCheck from './pages/system-health-check';
import CostManagementDashboard from './pages/cost-management-dashboard';
import BackupRestoreManagement from './pages/backup-restore-management';
import UserManagementRBAC from './pages/user-management-rbac';
import PerformanceMonitoringDashboard from './pages/performance-monitoring-dashboard';
import AIInsightsDashboard from './pages/ai-insights-dashboard';
import NotificationPreferences from './pages/notification-preferences';
import WorkflowRules from './pages/workflow-rules';
import DiagnosticPage from 'pages/diagnostic/index';
import SystemHealth from './pages/system-health';
import UptimeDashboard from './pages/uptime-dashboard';
import IncidentResponse from './pages/incident-response';

// Auth guard: redirects to /login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) {
    console.log('[Router] Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppRoutes = () => {
  useGoogleAnalytics();
  return (
    <RouterRoutes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><EnhancedSystemOverview /></ProtectedRoute>} />
      <Route path="/system-overview" element={<ProtectedRoute><SystemOverview /></ProtectedRoute>} />
      <Route path="/enhanced-system-overview" element={<ProtectedRoute><EnhancedSystemOverview /></ProtectedRoute>} />
      <Route path="/server-detail" element={<ProtectedRoute><ServerDetail /></ProtectedRoute>} />
      <Route path="/server-autopsy" element={<ProtectedRoute><ServerAutopsy /></ProtectedRoute>} />
      <Route path="/server-management" element={<ProtectedRoute><ServerManagement /></ProtectedRoute>} />
      <Route path="/server-provisioning-wizard" element={<ProtectedRoute><ServerProvisioningWizard /></ProtectedRoute>} />
      <Route path="/campaign-manager" element={<ProtectedRoute><CampaignManager /></ProtectedRoute>} />
      <Route path="/war-room-dashboard" element={<ProtectedRoute><WarRoomDashboard /></ProtectedRoute>} />
      <Route path="/risk-aware-campaign-creator" element={<ProtectedRoute><RiskAwareCampaignCreator /></ProtectedRoute>} />
      <Route path="/data-intelligence-hub" element={<ProtectedRoute><DataIntelligenceHub /></ProtectedRoute>} />
      <Route path="/contact-lists-management" element={<ProtectedRoute><ContactListsManagement /></ProtectedRoute>} />
      <Route path="/market-intelligence-dashboard" element={<ProtectedRoute><MarketIntelligenceDashboard /></ProtectedRoute>} />
      <Route path="/zero-click-campaign" element={<ProtectedRoute><ZeroClickCampaign /></ProtectedRoute>} />
      <Route path="/financial-management" element={<ProtectedRoute><FinancialManagement /></ProtectedRoute>} />
      <Route path="/ab-testing-engine" element={<ProtectedRoute><ABTestingEngine /></ProtectedRoute>} />
      <Route path="/automation-hub" element={<ProtectedRoute><AutomationHub /></ProtectedRoute>} />
      <Route path="/sto-scheduler" element={<ProtectedRoute><STOScheduler /></ProtectedRoute>} />
      <Route path="/anomaly-detection-dashboard" element={<ProtectedRoute><AnomalyDetectionDashboard /></ProtectedRoute>} />
      <Route path="/system-health-check" element={<ProtectedRoute><SystemHealthCheck /></ProtectedRoute>} />
      <Route path="/cost-management-dashboard" element={<ProtectedRoute><CostManagementDashboard /></ProtectedRoute>} />
      <Route path="/backup-restore-management" element={<ProtectedRoute><BackupRestoreManagement /></ProtectedRoute>} />
      <Route path="/user-management-rbac" element={<ProtectedRoute><UserManagementRBAC /></ProtectedRoute>} />
      <Route path="/performance-monitoring-dashboard" element={<ProtectedRoute><PerformanceMonitoringDashboard /></ProtectedRoute>} />
      <Route path="/ai-insights-dashboard" element={<ProtectedRoute><AIInsightsDashboard /></ProtectedRoute>} />
      <Route path="/notification-preferences" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />
      <Route path="/workflow-rules" element={<ProtectedRoute><WorkflowRules /></ProtectedRoute>} />
      <Route path="/system-health" element={<ProtectedRoute><SystemHealth /></ProtectedRoute>} />
      <Route path="/uptime-dashboard" element={<ProtectedRoute><UptimeDashboard /></ProtectedRoute>} />
      <Route path="/incident-response" element={<ProtectedRoute><IncidentResponse /></ProtectedRoute>} />
      <Route path="/diagnostic" element={<DiagnosticPage />} />
      <Route path="*" element={<NotFound />} />
    </RouterRoutes>
  );
};

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
