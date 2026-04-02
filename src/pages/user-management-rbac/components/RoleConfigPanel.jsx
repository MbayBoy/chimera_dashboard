import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const roleDefinitions = [
  {
    role: 'admin',
    label: 'Administrator',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10 border-red-400/30',
    icon: 'ShieldCheck',
    description: 'Full system access with all privileges',
    permissions: [
      'Full access to all screens and features',
      'Delete servers, campaigns, and critical infrastructure',
      'Manage users and assign roles',
      'Approve and modify budgets',
      'Access backup and restore operations',
      'Configure system settings and RLS policies',
      'View all data regardless of ownership',
    ],
  },
  {
    role: 'manager',
    label: 'Manager',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10 border-blue-400/30',
    icon: 'Briefcase',
    description: 'Campaign and contact management access',
    permissions: [
      'View all data across the platform',
      'Create and edit campaigns',
      'Manage contact lists and segments',
      'Access anomaly detection and remediation',
      'View cost and financial reports',
      'Cannot delete critical infrastructure (servers)',
      'Cannot manage users or assign roles',
    ],
  },
  {
    role: 'operator',
    label: 'Operator',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10 border-yellow-400/30',
    icon: 'Settings',
    description: 'Execution and monitoring capabilities',
    permissions: [
      'Execute and monitor campaigns',
      'Access dashboards and monitoring screens',
      'Trigger remediation actions for anomalies',
      'View server health and metrics',
      'Read-only access to contact lists',
      'Cannot modify settings or infrastructure',
      'Cannot create or delete campaigns',
    ],
  },
  {
    role: 'viewer',
    label: 'Viewer',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10 border-green-400/30',
    icon: 'Eye',
    description: 'Read-only access to dashboards and reports',
    permissions: [
      'View dashboards and system overview',
      'Read campaign performance reports',
      'View server health status',
      'Access financial and cost reports',
      'View system logs',
      'No modification permissions whatsoever',
      'Cannot execute actions or trigger workflows',
    ],
  },
];

const RoleConfigPanel = () => {
  const [selectedRole, setSelectedRole] = useState('admin');
  const role = roleDefinitions?.find(r => r?.role === selectedRole);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Role selector */}
      <div className="space-y-3">
        {roleDefinitions?.map(r => (
          <button
            key={r?.role}
            onClick={() => setSelectedRole(r?.role)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selectedRole === r?.role
                ? `${r?.bgColor} border-current`
                : 'bg-card border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon name={r?.icon} size={18} className={selectedRole === r?.role ? r?.color : 'text-muted-foreground'} />
              <div>
                <p className={`text-sm font-semibold ${selectedRole === r?.role ? r?.color : 'text-foreground'}`}>
                  {r?.label}
                </p>
                <p className="text-xs text-muted-foreground">{r?.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Role details */}
      <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
        {role && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role?.bgColor}`}>
                <Icon name={role?.icon} size={20} className={role?.color} />
              </div>
              <div>
                <h3 className={`font-semibold ${role?.color}`}>{role?.label}</h3>
                <p className="text-xs text-muted-foreground">{role?.description}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-foreground mb-3">Permission Set</h4>
              <div className="space-y-2">
                {role?.permissions?.map((perm, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Icon
                      name={perm?.startsWith('Cannot') || perm?.startsWith('No ') ? 'X' : 'Check'}
                      size={14}
                      className={`mt-0.5 flex-shrink-0 ${perm?.startsWith('Cannot') || perm?.startsWith('No ') ? 'text-red-400' : 'text-green-400'}`}
                    />
                    <p className="text-sm text-muted-foreground">{perm}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Role permissions are enforced via Supabase RLS policies at the database level and route guards at the application level. Changes to role assignments take effect immediately.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoleConfigPanel;
