import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const ROLES = ['admin', 'manager', 'operator', 'viewer'];

const roleColors = {
  admin: 'text-red-400 bg-red-400/10 border-red-400/30',
  manager: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  operator: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  viewer: 'text-green-400 bg-green-400/10 border-green-400/30',
  user: 'text-muted-foreground bg-muted/30 border-border',
};

const UserDirectory = ({ users, loading, saving, onRoleChange, onToggleActive, onSelectUser, selectedUser }) => {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkRole, setBulkRole] = useState('');

  const filtered = users?.filter(u => {
    const matchSearch = u?.email?.toLowerCase()?.includes(search?.toLowerCase()) ||
      u?.full_name?.toLowerCase()?.includes(search?.toLowerCase());
    const matchRole = filterRole === 'all' || u?.role === filterRole;
    return matchSearch && matchRole;
  });

  const toggleBulk = (id) => {
    setBulkSelected(prev => prev?.includes(id) ? prev?.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkRoleAssign = () => {
    if (!bulkRole) return;
    bulkSelected?.forEach(id => onRoleChange(id, bulkRole));
    setBulkSelected([]);
    setBulkRole('');
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        {[...Array(5)]?.map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-border animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg">
      {/* Filters */}
      <div className="p-4 border-b border-border flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e?.target?.value)}
            className="w-full pl-8 pr-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e?.target?.value)}
          className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All Roles</option>
          {ROLES?.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
        </select>

        {bulkSelected?.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{bulkSelected?.length} selected</span>
            <select
              value={bulkRole}
              onChange={e => setBulkRole(e?.target?.value)}
              className="bg-muted border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
            >
              <option value="">Assign role...</option>
              {ROLES?.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
            <button
              onClick={handleBulkRoleAssign}
              disabled={!bulkRole}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 text-left w-10">
                <input
                  type="checkbox"
                  onChange={e => setBulkSelected(e?.target?.checked ? filtered?.map(u => u?.id) : [])}
                  checked={bulkSelected?.length === filtered?.length && filtered?.length > 0}
                  className="rounded"
                />
              </th>
              <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
              <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
              <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">Joined</th>
              <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map(user => (
              <tr
                key={user?.id}
                className={`border-b border-border hover:bg-muted/20 cursor-pointer transition-colors ${
                  selectedUser?.id === user?.id ? 'bg-primary/5' : ''
                }`}
                onClick={() => onSelectUser(user)}
              >
                <td className="p-4" onClick={e => e?.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={bulkSelected?.includes(user?.id)}
                    onChange={() => toggleBulk(user?.id)}
                    className="rounded"
                  />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                      {user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4" onClick={e => e?.stopPropagation()}>
                  <select
                    value={user?.role || 'viewer'}
                    onChange={e => onRoleChange(user?.id, e?.target?.value)}
                    disabled={saving}
                    className={`text-xs px-2 py-1 rounded-full border font-medium bg-transparent cursor-pointer ${
                      roleColors?.[user?.role] || roleColors?.viewer
                    }`}
                  >
                    {ROLES?.map(r => <option key={r} value={r} className="capitalize bg-card">{r}</option>)}
                  </select>
                </td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user?.is_active ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                  }`}>
                    {user?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-xs text-muted-foreground">
                    {user?.created_at ? new Date(user?.created_at)?.toLocaleDateString() : 'N/A'}
                  </span>
                </td>
                <td className="p-4" onClick={e => e?.stopPropagation()}>
                  <button
                    onClick={() => onToggleActive(user?.id, user?.is_active)}
                    className="text-xs px-2 py-1 bg-muted hover:bg-muted/70 rounded text-muted-foreground transition-colors"
                  >
                    {user?.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered?.length === 0 && (
          <div className="text-center py-12">
            <Icon name="Users" size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDirectory;
