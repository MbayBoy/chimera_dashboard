import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/ui/Sidebar';
import Header from '../../components/ui/Header';
import UserDirectory from './components/UserDirectory';
import PermissionMatrix from './components/PermissionMatrix';
import RoleConfigPanel from './components/RoleConfigPanel';
import InviteUserModal from './components/InviteUserModal';

const ROLES = ['admin', 'manager', 'operator', 'viewer'];

const UserManagementRBAC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('directory');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase?.from('user_profiles')?.select('*')?.order('created_at', { ascending: false });
      if (!error && data) setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRoleChange = async (userId, newRole) => {
    setSaving(true);
    try {
      const { error } = await supabase?.from('user_profiles')?.update({ role: newRole, updated_at: new Date()?.toISOString() })?.eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev?.map(u => u?.id === userId ? { ...u, role: newRole } : u));

      // Log role change
      await supabase?.from('system_logs')?.insert({
        log_level: 'INFO',
        source: 'RBAC',
        message: `User role updated to '${newRole}' for user ID: ${userId}`
      });

      showToast(`Role updated to ${newRole} successfully`);
    } catch (err) {
      showToast('Failed to update role', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const { error } = await supabase?.from('user_profiles')?.update({ is_active: !currentStatus, updated_at: new Date()?.toISOString() })?.eq('id', userId);

      if (error) throw error;
      setUsers(prev => prev?.map(u => u?.id === userId ? { ...u, is_active: !currentStatus } : u));
      showToast(`Account ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      showToast('Failed to update account status', 'error');
    }
  };

  const roleCounts = ROLES?.reduce((acc, role) => {
    acc[role] = users?.filter(u => u?.role === role)?.length || 0;
    return acc;
  }, {});

  const tabs = [
    { id: 'directory', label: 'User Directory' },
    { id: 'matrix', label: 'Permission Matrix' },
    { id: 'roles', label: 'Role Configuration' },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header title="User Management & RBAC" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
              toast?.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {toast?.message}
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold text-foreground">{users?.length}</p>
            </div>
            {ROLES?.map(role => (
              <div key={role} className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground capitalize">{role}s</p>
                <p className="text-2xl font-bold text-foreground">{roleCounts?.[role]}</p>
              </div>
            ))}
          </div>

          {/* Tabs + Invite Button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1 bg-muted/30 p-1 rounded-lg">
              {tabs?.map(tab => (
                <button
                  key={tab?.id}
                  onClick={() => setActiveTab(tab?.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab?.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              + Invite User
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'directory' && (
            <UserDirectory
              users={users}
              loading={loading}
              saving={saving}
              onRoleChange={handleRoleChange}
              onToggleActive={handleToggleActive}
              onSelectUser={setSelectedUser}
              selectedUser={selectedUser}
            />
          )}
          {activeTab === 'matrix' && <PermissionMatrix />}
          {activeTab === 'roles' && <RoleConfigPanel />}
        </main>
      </div>
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onInvited={fetchUsers}
        />
      )}
    </div>
  );
};

export default UserManagementRBAC;
