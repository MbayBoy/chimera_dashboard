import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { motion } from 'framer-motion';

const RehabilitationPlan = ({ data, onManualOverride }) => {
  const getPhaseStatus = (status) => {
    switch (status) {
      case 'completed':
        return { color: 'text-success', bg: 'bg-success', icon: 'CheckCircle2' };
      case 'in_progress':
        return { color: 'text-warning', bg: 'bg-warning', icon: 'Loader2' };
      case 'pending':
        return { color: 'text-muted-foreground', bg: 'bg-muted', icon: 'Circle' };
      default:
        return { color: 'text-muted-foreground', bg: 'bg-muted', icon: 'Circle' };
    }
  };

  const formatDate = (date) => {
    return new Date(date)?.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const overallProgress = (data?.phases?.filter(p => p?.status === 'completed')?.length / data?.phases?.length) * 100;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">
            Auto-Rehabilitation Protocol
          </h2>
          <p className="text-sm text-muted-foreground">
            7-day monitoring and recovery progression
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Est. Completion</div>
            <div className="text-sm font-medium text-foreground">{formatDate(data?.estimatedCompletion)}</div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="Activity" size={24} className="text-primary" />
          </div>
        </div>
      </div>
      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Overall Progress</span>
          <span className="text-sm font-medium text-foreground">{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary to-success"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Icon name="Clock" size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {data?.daysInQuarantine?.toFixed(2)} days in quarantine
          </span>
        </div>
      </div>
      {/* Phases */}
      <div className="space-y-4">
        {data?.phases?.map((phase, index) => {
          const status = getPhaseStatus(phase?.status);
          const isActive = phase?.status === 'in_progress';

          return (
            <motion.div
              key={phase?.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border ${
                isActive ? 'bg-warning/5 border-warning/20' : 'bg-muted/50 border-border'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-8 h-8 rounded-full ${status?.bg}/20 flex items-center justify-center flex-shrink-0`}>
                  <Icon 
                    name={status?.icon} 
                    size={16} 
                    className={`${status?.color} ${isActive ? 'animate-spin' : ''}`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-foreground">
                      Phase {phase?.id}: {phase?.name}
                    </h3>
                    <span className={`text-xs font-medium ${status?.color} capitalize`}>
                      {phase?.status?.replace('_', ' ')}
                    </span>
                  </div>
                  {phase?.completedAt && (
                    <div className="text-xs text-muted-foreground">
                      Completed: {formatDate(phase?.completedAt)}
                    </div>
                  )}
                </div>
              </div>
              {/* Phase Progress Bar */}
              {phase?.status === 'in_progress' && phase?.progress && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Phase Progress</span>
                    <span className="text-xs font-medium text-foreground">{phase?.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${phase?.progress}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full bg-warning"
                    />
                  </div>
                </div>
              )}
              {/* Tasks */}
              <div className="space-y-2">
                {phase?.tasks?.map((task, taskIndex) => (
                  <div key={taskIndex} className="flex items-center gap-2">
                    <Icon 
                      name={task?.completed ? 'CheckCircle2' : 'Circle'} 
                      size={14} 
                      className={task?.completed ? 'text-success' : 'text-muted-foreground'}
                    />
                    <span className={`text-xs ${
                      task?.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}>
                      {task?.name}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
      {/* Manual Override */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-start gap-3">
          <Icon name="AlertTriangle" size={20} className="text-error mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground mb-1">
              Manual Override Available
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              You can force this server back to Production, but this bypasses all safety protocols and may cause further damage.
            </div>
            <Button
              variant="danger"
              size="sm"
              iconName="AlertTriangle"
              iconPosition="left"
              onClick={onManualOverride}
            >
              Force Production Override
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RehabilitationPlan;