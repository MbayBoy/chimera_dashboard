import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const runbookSections = [
  {
    id: 'db-failure',
    title: 'Database Complete Failure',
    severity: 'critical',
    icon: 'Database',
    steps: [
      'Immediately notify on-call DBA and engineering lead via PagerDuty',
      'Assess failure scope: check Supabase dashboard for service status',
      'If Supabase outage: monitor status.supabase.com and wait for resolution',
      'If data corruption: identify last known good backup from Backup Timeline',
      'Execute restore procedure: select backup → confirm impact → monitor progress',
      'Verify data integrity post-restore: run SELECT COUNT(*) on all critical tables',
      'Restart all application services and clear connection pools',
      'Notify stakeholders of restoration completion and data loss window',
      'Document incident in post-mortem template within 24 hours',
    ],
    contacts: ['DBA Lead: +1-555-0101', 'Engineering Lead: +1-555-0102', 'Supabase Support: support@supabase.io'],
  },
  {
    id: 'partial-corruption',
    title: 'Partial Data Corruption',
    severity: 'high',
    icon: 'AlertTriangle',
    steps: [
      'Identify affected tables via anomaly detection dashboard',
      'Immediately disable write operations to affected tables via RLS policies',
      'Export current state of affected tables as emergency backup',
      'Compare corrupted data against last clean backup using diff analysis',
      'Restore only affected tables using point-in-time recovery if available',
      'Re-enable write operations after verification',
      'Audit all transactions since last clean state for replay',
    ],
    contacts: ['Data Team: data-team@chimera.io', 'On-call: +1-555-0103'],
  },
  {
    id: 'backup-failure',
    title: 'Backup Job Failure',
    severity: 'medium',
    icon: 'XCircle',
    steps: [
      'Check System_Logs for ERROR entries from BackupScheduler source',
      'Verify disk space on backup storage volume (minimum 20% free required)',
      'Check database connection pool availability (max 90% utilization)',
      'Manually trigger backup via Backup Schedule Config panel',
      'If manual backup fails: escalate to infrastructure team',
      'Ensure no backup gap exceeds 48 hours — escalate to critical if so',
    ],
    contacts: ['Infra Team: infra@chimera.io'],
  },
  {
    id: 'rpo-rto',
    title: 'RPO/RTO Objectives',
    severity: 'info',
    icon: 'Target',
    steps: [
      'Recovery Point Objective (RPO): Maximum 24 hours data loss acceptable',
      'Recovery Time Objective (RTO): Full restoration within 4 hours',
      'Daily backups at 03:00 AM ensure RPO compliance under normal conditions',
      'Pre-deployment manual snapshots reduce RPO for planned changes',
      'Test restore procedure quarterly to validate RTO targets',
      'Document actual RTO in each incident post-mortem for trend analysis',
    ],
    contacts: [],
  },
  {
    id: 'escalation',
    title: 'Escalation Protocol',
    severity: 'info',
    icon: 'Users',
    steps: [
      'Level 1 (0-15 min): On-call engineer investigates and attempts self-healing',
      'Level 2 (15-30 min): Escalate to DBA lead and engineering manager',
      'Level 3 (30-60 min): Escalate to CTO and initiate war room protocol',
      'Level 4 (60+ min): Executive notification and customer communication',
      'All escalations must be logged in incident tracker with timestamps',
      'Post-incident review mandatory for all Level 2+ escalations',
    ],
    contacts: ['CTO: cto@chimera.io', 'Incident Tracker: incidents.chimera.io'],
  },
];

const severityColors = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
};

const DisasterRunbook = () => {
  const [expandedId, setExpandedId] = useState('db-failure');

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="BookOpen" size={20} className="text-primary" />
        <div>
          <h3 className="text-foreground font-semibold">Disaster Recovery Runbook</h3>
          <p className="text-xs text-muted-foreground">Step-by-step recovery procedures for failure scenarios</p>
        </div>
      </div>
      <div className="space-y-3">
        {runbookSections?.map(section => (
          <div key={section?.id} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === section?.id ? null : section?.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon name={section?.icon} size={18} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{section?.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${severityColors?.[section?.severity]}`}>
                  {section?.severity}
                </span>
              </div>
              <Icon
                name={expandedId === section?.id ? 'ChevronUp' : 'ChevronDown'}
                size={16}
                className="text-muted-foreground"
              />
            </button>

            {expandedId === section?.id && (
              <div className="px-4 pb-4 border-t border-border">
                <div className="mt-4 space-y-2">
                  {section?.steps?.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <p className="text-sm text-muted-foreground pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>

                {section?.contacts?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium text-foreground mb-2">Emergency Contacts</p>
                    <div className="flex flex-wrap gap-2">
                      {section?.contacts?.map((contact, i) => (
                        <span key={i} className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                          {contact}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DisasterRunbook;
