import React, { useState, useEffect } from 'react';
import Icon from './AppIcon';

const DEV_MODE_KEY = 'chimera_dev_mode';
const CRON_DISABLED_KEY = 'chimera_cron_disabled';

export const isDevMode = () => localStorage.getItem(DEV_MODE_KEY) === 'true';
export const isCronDisabled = () => localStorage.getItem(CRON_DISABLED_KEY) === 'true';

const DevModeToggle = () => {
  const [open, setOpen] = useState(false);
  const [devMode, setDevMode] = useState(() => localStorage.getItem(DEV_MODE_KEY) === 'true');
  const [cronDisabled, setCronDisabled] = useState(() => localStorage.getItem(CRON_DISABLED_KEY) === 'true');

  const toggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem(DEV_MODE_KEY, String(next));
    console.log(`[DevMode] Dev mode ${next ? 'ENABLED' : 'DISABLED'}`);
  };

  const toggleCron = () => {
    const next = !cronDisabled;
    setCronDisabled(next);
    localStorage.setItem(CRON_DISABLED_KEY, String(next));
    console.log(`[DevMode] Cron workflows ${next ? 'DISABLED' : 'ENABLED'} — reload to apply`);
    window.location?.reload();
  };

  if (!devMode && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-8 h-8 bg-muted border border-border rounded-full flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
        title="Dev Tools"
      >
        <Icon name="Terminal" size={14} className="text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 bg-card border border-border rounded-xl shadow-xl p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon name="Terminal" size={16} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Dev Tools</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {/* Dev Mode Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Dev Mode</p>
                <p className="text-xs text-muted-foreground">Extra console logging</p>
              </div>
              <button
                onClick={toggleDevMode}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  devMode ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  devMode ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Cron Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Cron Workflows</p>
                <p className="text-xs text-muted-foreground">{cronDisabled ? 'Disabled (reload applied)' : 'Running in background'}</p>
              </div>
              <button
                onClick={toggleCron}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  !cronDisabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  !cronDisabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Status */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${cronDisabled ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <span className="text-xs text-muted-foreground">
                  {cronDisabled ? 'Cron paused' : '5 workflows active'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center shadow-lg hover:bg-muted transition-colors"
        title="Dev Tools"
      >
        <Icon name="Terminal" size={16} className={devMode ? 'text-primary' : 'text-muted-foreground'} />
      </button>
    </div>
  );
};

export default DevModeToggle;
