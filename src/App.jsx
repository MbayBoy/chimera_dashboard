import React, { useEffect, useState } from 'react';
import Routes from './Routes';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { startCronScheduler } from './services/cronService';
import DevModeToggle, { isCronDisabled } from './components/DevModeToggle';
import Icon from './components/AppIcon';
import { useToast, ToastProvider } from './components/ui/Toast';
import { startAlertSubscriptions, setToastCallback, requestNotificationPermission,  } from './services/alertNotificationService';

// Inner component that has access to auth context
const AppInner = () => {
  const { loading, isAuthenticated } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (isCronDisabled()) {
      console.log('[App] Cron workflows DISABLED via dev toggle');
      return;
    }
    console.log('[App] Starting cron scheduler...');
    const stopCron = startCronScheduler();
    return () => stopCron();
  }, []);

  // Set up alert notification service when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Register toast callback
    setToastCallback((type, message, title, duration) => {
      if (type === 'error') toast?.error(message, title);
      else if (type === 'warning') toast?.warning(message, title);
      else toast?.info(message, title);
    });

    // Request notification permission
    requestNotificationPermission();

    // Start real-time alert subscriptions
    const stopAlerts = startAlertSubscriptions();
    return () => stopAlerts?.();
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Icon name="Zap" size={28} className="text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="Loader2" size={18} className="animate-spin" />
            <span className="text-sm">Loading Chimera...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes />
      <DevModeToggle />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
