const permissions = [
  { feature: 'System Overview', admin: 'Full', manager: 'Full', operator: 'Full', viewer: 'Full' },
  { feature: 'War Room Dashboard', admin: 'Full', manager: 'Full', operator: 'Full', viewer: 'Read' },
  { feature: 'Campaign Manager', admin: 'Full', manager: 'Full', operator: 'Execute', viewer: 'Read' },
  { feature: 'Create Campaigns', admin: 'Full', manager: 'Full', operator: 'None', viewer: 'None' },
  { feature: 'Delete Campaigns', admin: 'Full', manager: 'None', operator: 'None', viewer: 'None' },
  { feature: 'Server Management', admin: 'Full', manager: 'Read', operator: 'Monitor', viewer: 'Read' },
  { feature: 'Add/Remove Servers', admin: 'Full', manager: 'None', operator: 'None', viewer: 'None' },
  { feature: 'Contact Lists', admin: 'Full', manager: 'Full', operator: 'Read', viewer: 'Read' },
  { feature: 'Delete Contacts', admin: 'Full', manager: 'Full', operator: 'None', viewer: 'None' },
  { feature: 'User Management', admin: 'Full', manager: 'None', operator: 'None', viewer: 'None' },
  { feature: 'Assign Roles', admin: 'Full', manager: 'None', operator: 'None', viewer: 'None' },
  { feature: 'Cost Management', admin: 'Full', manager: 'Read', operator: 'None', viewer: 'Read' },
  { feature: 'Approve Budgets', admin: 'Full', manager: 'None', operator: 'None', viewer: 'None' },
  { feature: 'Anomaly Detection', admin: 'Full', manager: 'Full', operator: 'Full', viewer: 'Read' },
  { feature: 'Remediation Actions', admin: 'Full', manager: 'Full', operator: 'Execute', viewer: 'None' },
  { feature: 'Backup & Restore', admin: 'Full', manager: 'Read', operator: 'None', viewer: 'None' },
  { feature: 'System Logs', admin: 'Full', manager: 'Read', operator: 'Read', viewer: 'Read' },
  { feature: 'Automation Hub', admin: 'Full', manager: 'Full', operator: 'Execute', viewer: 'Read' },
  { feature: 'Data Intelligence', admin: 'Full', manager: 'Full', operator: 'Read', viewer: 'Read' },
  { feature: 'Financial Management', admin: 'Full', manager: 'Read', operator: 'None', viewer: 'Read' },
];

const accessColors = {
  Full: 'bg-green-500/20 text-green-400 border border-green-500/30',
  Read: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Execute: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  Monitor: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  Limited: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  None: 'bg-muted/30 text-muted-foreground border border-border',
};

const PermissionMatrix = () => {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-foreground font-semibold">Permission Matrix</h3>
        <p className="text-xs text-muted-foreground mt-1">Role-based access control across all system features</p>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Object.entries(accessColors)?.map(([level, cls]) => (
          <div key={level} className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{level}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase min-w-48">Feature / Screen</th>
              {['Admin', 'Manager', 'Operator', 'Viewer']?.map(role => (
                <th key={role} className="p-3 text-center text-xs font-medium text-muted-foreground uppercase min-w-24">{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions?.map((row, i) => (
              <tr key={i} className="border-b border-border hover:bg-muted/10 transition-colors">
                <td className="p-3 text-sm text-foreground">{row?.feature}</td>
                {['admin', 'manager', 'operator', 'viewer']?.map(role => (
                  <td key={role} className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${accessColors?.[row?.[role]] || accessColors?.None}`}>
                      {row?.[role]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissionMatrix;
