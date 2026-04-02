import { useState } from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const initialMockContacts = [
  { id: 1, email: 'john.doe@example.com', tier: 'platinum', engagementScore: 98, verificationStatus: 'Deliverable_High_Conf', lastActivity: '2026-02-24', status: 'Active' },
  { id: 2, email: 'jane.smith@company.com', tier: 'platinum', engagementScore: 96, verificationStatus: 'Deliverable_High_Conf', lastActivity: '2026-02-23', status: 'Active' },
  { id: 3, email: 'bob.wilson@business.com', tier: 'gold', engagementScore: 92, verificationStatus: 'Deliverable_High_Conf', lastActivity: '2026-02-22', status: 'Active' },
  { id: 4, email: 'alice.brown@email.com', tier: 'gold', engagementScore: 88, verificationStatus: 'Deliverable_Low_Conf', lastActivity: '2026-02-20', status: 'Active' },
  { id: 5, email: 'charlie.davis@mail.com', tier: 'silver', engagementScore: 75, verificationStatus: 'Deliverable_High_Conf', lastActivity: '2026-02-18', status: 'Active' },
  { id: 6, email: 'diana.evans@test.com', tier: 'silver', engagementScore: 72, verificationStatus: 'Unknown_Greylisted', lastActivity: '2026-02-15', status: 'Bounced' },
  { id: 7, email: 'frank.garcia@sample.com', tier: 'bronze', engagementScore: 58, verificationStatus: 'Deliverable_Low_Conf', lastActivity: '2026-02-10', status: 'Unsubscribed' },
  { id: 8, email: 'grace.harris@demo.com', tier: 'bronze', engagementScore: 55, verificationStatus: 'Undeliverable', lastActivity: '2026-02-05', status: 'Bounced' },
  { id: 9, email: 'henry.jackson@new.com', tier: 'lead', engagementScore: 12, verificationStatus: null, lastActivity: null, status: 'Zombie' },
  { id: 10, email: 'iris.king@fresh.com', tier: 'lead', engagementScore: 8, verificationStatus: null, lastActivity: null, status: 'Complained' },
];

const getTierColor = (tier) => {
  switch (tier) {
    case 'platinum': return 'bg-purple-500 text-white';
    case 'gold': return 'bg-yellow-500 text-white';
    case 'silver': return 'bg-slate-400 text-white';
    case 'bronze': return 'bg-orange-600 text-white';
    case 'lead': return 'bg-slate-600 text-white';
    default: return 'bg-slate-500 text-white';
  }
};

const getVerificationColor = (status) => {
  switch (status) {
    case 'Deliverable_High_Conf': return 'bg-success/10 text-success border-success/20';
    case 'Deliverable_Low_Conf': return 'bg-warning/10 text-warning border-warning/20';
    case 'Undeliverable': return 'bg-error/10 text-error border-error/20';
    case 'Unknown_Greylisted': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Active': return 'text-success bg-success/10';
    case 'Bounced': return 'text-error bg-error/10';
    case 'Unsubscribed': return 'text-warning bg-warning/10';
    case 'Complained': return 'text-red-400 bg-red-500/10';
    case 'Zombie': return 'text-muted-foreground bg-muted';
    default: return 'text-muted-foreground bg-muted';
  }
};

const ConfirmDeleteModal = ({ isOpen, title, message, count, onConfirm, onCancel, isDeleting }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
            <Icon name="Trash2" size={18} className="text-error" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{message}</p>
        {count > 0 && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-3 mb-4">
            <p className="text-sm font-semibold text-error">{count} contact{count !== 1 ? 's' : ''} will be permanently deleted</p>
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-error hover:bg-error/90 rounded-lg transition-colors disabled:opacity-60"
          >
            {isDeleting ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Trash2" size={14} />}
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ClassifiedListViewer = ({ list }) => {
  const [contacts, setContacts] = useState(initialMockContacts);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortField, setSortField] = useState('email');
  const [sortDirection, setSortDirection] = useState('asc');
  const [tierFilter, setTierFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null); // { type, title, message, count, onConfirm }
  const [isDeleting, setIsDeleting] = useState(false);
  const [engagementThreshold, setEngagementThreshold] = useState(20);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const tierOptions = [
    { value: 'all', label: 'All Tiers' },
    { value: 'platinum', label: 'Platinum' },
    { value: 'gold', label: 'Gold' },
    { value: 'silver', label: 'Silver' },
    { value: 'bronze', label: 'Bronze' },
    { value: 'lead', label: 'Lead' }
  ];

  const verificationOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Deliverable_High_Conf', label: 'Deliverable (High)' },
    { value: 'Deliverable_Low_Conf', label: 'Deliverable (Low)' },
    { value: 'Undeliverable', label: 'Undeliverable' },
    { value: 'Unknown_Greylisted', label: 'Unknown' },
    { value: 'not_verified', label: 'Not Verified' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Bounced', label: 'Bounced' },
    { value: 'Unsubscribed', label: 'Unsubscribed' },
    { value: 'Complained', label: 'Complained' },
    { value: 'Zombie', label: 'Zombie' },
  ];

  const filteredContacts = contacts?.filter(c => {
    if (tierFilter !== 'all' && c?.tier !== tierFilter) return false;
    if (statusFilter !== 'all' && c?.status !== statusFilter) return false;
    if (verificationFilter !== 'all') {
      if (verificationFilter === 'not_verified' && c?.verificationStatus !== null) return false;
      if (verificationFilter !== 'not_verified' && c?.verificationStatus !== verificationFilter) return false;
    }
    return true;
  });

  const allSelected = filteredContacts?.length > 0 && filteredContacts?.every(c => selectedIds?.has(c?.id));
  const someSelected = selectedIds?.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next?.has(id)) next?.delete(id); else next?.add(id);
      return next;
    });
  };

  const executeDelete = (filterFn, onDone) => {
    setIsDeleting(true);
    setTimeout(() => {
      setContacts(prev => prev?.filter(c => !filterFn(c)));
      setSelectedIds(new Set());
      setIsDeleting(false);
      setModal(null);
      if (onDone) onDone();
    }, 1200);
  };

  // Delete single contact
  const handleDeleteSingle = (contact) => {
    setModal({
      title: 'Delete Contact',
      message: `Are you sure you want to delete ${contact?.email}? This action cannot be undone.`,
      count: 1,
      onConfirm: () => executeDelete(c => c?.id === contact?.id),
    });
  };

  // Delete selected
  const handleDeleteSelected = () => {
    setModal({
      title: 'Delete Selected Contacts',
      message: 'Are you sure you want to delete all selected contacts? This action cannot be undone.',
      count: selectedIds?.size,
      onConfirm: () => executeDelete(c => selectedIds?.has(c?.id)),
    });
  };

  // Delete by status
  const handleDeleteByStatus = (status) => {
    const count = contacts?.filter(c => c?.status === status)?.length;
    setModal({
      title: `Delete All ${status} Contacts`,
      message: `This will permanently delete all contacts with status "${status}".`,
      count,
      onConfirm: () => executeDelete(c => c?.status === status),
    });
  };

  // Delete by tier
  const handleDeleteByTier = (tier) => {
    const count = contacts?.filter(c => c?.tier === tier)?.length;
    setModal({
      title: `Delete All ${tier?.charAt(0)?.toUpperCase() + tier?.slice(1)} Contacts`,
      message: `This will permanently delete all contacts in the ${tier} tier.`,
      count,
      onConfirm: () => executeDelete(c => c?.tier === tier),
    });
  };

  // Delete by engagement threshold
  const handleDeleteByEngagement = () => {
    const count = contacts?.filter(c => c?.engagementScore < engagementThreshold)?.length;
    setModal({
      title: `Delete Low Engagement Contacts`,
      message: `This will delete all contacts with engagement score below ${engagementThreshold}%.`,
      count,
      onConfirm: () => executeDelete(c => c?.engagementScore < engagementThreshold),
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <ConfirmDeleteModal
        isOpen={!!modal}
        title={modal?.title || ''}
        message={modal?.message || ''}
        count={modal?.count || 0}
        onConfirm={modal?.onConfirm}
        onCancel={() => setModal(null)}
        isDeleting={isDeleting}
      />
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-heading font-semibold text-foreground">{list?.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{contacts?.length?.toLocaleString()} contacts</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" iconName="Download">Export</Button>
            <Button variant="outline" size="sm" iconName="RefreshCw">Verify List</Button>
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error text-sm font-medium rounded-lg border border-error/30 transition-colors"
            >
              <Icon name="Trash2" size={14} />
              Delete Tools
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Engagement Score</div>
            <div className="text-xl font-heading font-bold text-foreground">{list?.engagementScore}%</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Verification Coverage</div>
            <div className="text-xl font-heading font-bold text-foreground">{list?.verificationCoverage}%</div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Deliverability Rate</div>
            <div className="text-xl font-heading font-bold text-success">
              {list?.deliverabilityRate > 0 ? `${list?.deliverabilityRate}%` : 'N/A'}
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
            <div className="text-sm font-medium text-foreground">
              {new Date(list?.lastUpdated)?.toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
      {/* Bulk Delete Tools Panel */}
      {showBulkActions && (
        <div className="p-5 border-b border-border bg-error/5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Trash2" size={16} className="text-error" />
            <h3 className="text-sm font-semibold text-foreground">Bulk Delete Tools</h3>
            <button onClick={() => setShowBulkActions(false)} className="ml-auto text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Delete by Status */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delete by Status</h4>
              <div className="space-y-2">
                {['Bounced', 'Unsubscribed', 'Complained', 'Zombie']?.map(status => {
                  const count = contacts?.filter(c => c?.status === status)?.length;
                  return (
                    <button
                      key={status}
                      onClick={() => handleDeleteByStatus(status)}
                      disabled={count === 0}
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-error/10 hover:text-error rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="font-medium">{status}</span>
                      <span className="text-xs bg-error/10 text-error px-2 py-0.5 rounded-full">{count} contacts</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delete by Tier */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delete by Tier</h4>
              <div className="space-y-2">
                {['lead', 'bronze', 'silver', 'gold', 'platinum']?.map(tier => {
                  const count = contacts?.filter(c => c?.tier === tier)?.length;
                  return (
                    <button
                      key={tier}
                      onClick={() => handleDeleteByTier(tier)}
                      disabled={count === 0}
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-error/10 hover:text-error rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="font-medium capitalize">{tier}</span>
                      <span className="text-xs bg-error/10 text-error px-2 py-0.5 rounded-full">{count} contacts</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delete by Engagement Threshold */}
            <div className="bg-card rounded-lg border border-border p-4 md:col-span-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delete by Engagement Score Threshold</h4>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Delete contacts with score below:</span>
                    <span className="text-sm font-bold text-error">{engagementThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={engagementThreshold}
                    onChange={e => setEngagementThreshold(Number(e?.target?.value))}
                    className="w-full accent-error"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
                <button
                  onClick={handleDeleteByEngagement}
                  className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error/20 text-error text-sm font-medium rounded-lg border border-error/30 transition-colors flex-shrink-0"
                >
                  <Icon name="Trash2" size={14} />
                  Delete {contacts?.filter(c => c?.engagementScore < engagementThreshold)?.length} contacts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Tier Breakdown */}
      <div className="p-6 border-b border-border">
        <h3 className="text-sm font-medium text-foreground mb-4">Tier Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(list?.tierBreakdown || {})?.map(([tier, count]) => (
            <div key={tier} className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${getTierColor(tier)?.split(' ')?.[0]}`} />
                <span className="text-xs font-medium text-foreground capitalize">{tier}</span>
              </div>
              <div className="text-lg font-heading font-bold text-foreground">{count?.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{((count / list?.totalContacts) * 100)?.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
      {/* Filters */}
      <div className="p-6 border-b border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select label="Filter by Tier" options={tierOptions} value={tierFilter} onChange={setTierFilter} />
          <Select label="Filter by Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          <Select label="Filter by Verification" options={verificationOptions} value={verificationFilter} onChange={setVerificationFilter} />
        </div>
      </div>
      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="px-6 py-3 bg-primary/5 border-b border-primary/20 flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{selectedIds?.size} contact{selectedIds?.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error text-sm font-medium rounded-lg border border-error/30 transition-colors"
          >
            <Icon name="Trash2" size={14} />
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}
      {/* Contact Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Verification</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Activity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredContacts?.map(contact => (
              <tr key={contact?.id} className={`hover:bg-muted/50 transition-colors ${selectedIds?.has(contact?.id) ? 'bg-primary/5' : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(contact?.id)}
                    onChange={() => toggleSelect(contact?.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-foreground">{contact?.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(contact?.tier)}`}>
                    {contact?.tier?.charAt(0)?.toUpperCase() + contact?.tier?.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contact?.status)}`}>
                    {contact?.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-foreground">{contact?.engagementScore}%</div>
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${contact?.engagementScore}%` }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getVerificationColor(contact?.verificationStatus)}`}>
                    {contact?.verificationStatus ? contact?.verificationStatus?.replace(/_/g, ' ') : 'Not Verified'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {contact?.lastActivity ? new Date(contact.lastActivity)?.toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDeleteSingle(contact)}
                    className="p-1.5 text-muted-foreground hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                    title="Delete contact"
                  >
                    <Icon name="Trash2" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="p-6 border-t border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredContacts?.length} of {contacts?.length} contacts
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconName="ChevronLeft" disabled>Previous</Button>
          <Button variant="outline" size="sm" iconName="ChevronRight">Next</Button>
        </div>
      </div>
    </div>
  );
};

export default ClassifiedListViewer;