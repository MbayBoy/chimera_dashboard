import { useState } from 'react';
import Icon from '../../../components/AppIcon';

const ROLES = ['admin', 'manager', 'operator', 'viewer'];

const InviteUserModal = ({ onClose, onInvited }) => {
  const [form, setForm] = useState({ email: '', fullName: '', role: 'viewer' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form?.email || !form?.fullName) {
      setError('Email and full name are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Simulate invitation (in production, trigger email via Supabase Auth)
      await new Promise(r => setTimeout(r, 1000));
      setSent(true);
      setTimeout(() => {
        onInvited?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to send invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Invite New User</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
            <input
              type="text"
              value={form?.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e?.target?.value }))}
              placeholder="John Doe"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email Address *</label>
            <input
              type="email"
              value={form?.email}
              onChange={e => setForm(f => ({ ...f, email: e?.target?.value }))}
              placeholder="user@example.com"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Role Assignment</label>
            <select
              value={form?.role}
              onChange={e => setForm(f => ({ ...f, role: e?.target?.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {ROLES?.map(r => (
                <option key={r} value={r} className="capitalize">{r?.charAt(0)?.toUpperCase() + r?.slice(1)}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              An invitation email with a temporary password will be sent to the provided address.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || sent}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                sent
                  ? 'bg-green-500 text-white' :'bg-primary text-primary-foreground hover:bg-primary/90'
              } disabled:opacity-70`}
            >
              {sent ? '✓ Invitation Sent' : loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserModal;
