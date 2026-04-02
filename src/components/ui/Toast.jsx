import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import Icon from '../AppIcon';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const ICONS = {
  success: { name: 'CheckCircle', color: 'text-success' },
  error: { name: 'XCircle', color: 'text-error' },
  warning: { name: 'AlertTriangle', color: 'text-warning' },
  info: { name: 'Info', color: 'text-primary' },
};

const BG = {
  success: 'border-success/30 bg-success/10',
  error: 'border-error/30 bg-error/10',
  warning: 'border-warning/30 bg-warning/10',
  info: 'border-primary/30 bg-primary/10',
};

const ToastItem = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast?.id), toast?.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast?.id, toast?.duration, onRemove]);

  const icon = ICONS?.[toast?.type] || ICONS?.info;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg bg-card max-w-sm w-full ${BG?.[toast?.type] || BG?.info} animate-slide-in`}>
      <Icon name={icon?.name} size={18} className={`${icon?.color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {toast?.title && <p className="text-sm font-semibold text-foreground">{toast?.title}</p>}
        <p className="text-sm text-muted-foreground">{toast?.message}</p>
      </div>
      <button onClick={() => onRemove(toast?.id)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
        <Icon name="X" size={14} />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, title, duration) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message, title, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev?.filter(t => t?.id !== id));
  }, []);

  const toast = {
    success: (message, title) => addToast('success', message, title),
    error: (message, title) => addToast('error', message, title, 6000),
    warning: (message, title) => addToast('warning', message, title),
    info: (message, title) => addToast('info', message, title),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts?.map(t => (
          <div key={t?.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
