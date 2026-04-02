import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SeedListManager = () => {
  const [seeds, setSeeds] = useState([
    { id: 1, competitor: 'CompetitorAlpha', email: 'newsletter@alpha-mail.com', status: 'Active', lastReceived: '2 hours ago', totalReceived: 47, industry: 'SaaS' },
    { id: 2, competitor: 'CompetitorBeta', email: 'updates@beta-solutions.io', status: 'Active', lastReceived: '1 day ago', totalReceived: 23, industry: 'SaaS' },
    { id: 3, competitor: 'CompetitorGamma', email: 'news@gamma-tech.com', status: 'Active', lastReceived: '3 hours ago', totalReceived: 61, industry: 'E-commerce' },
    { id: 4, competitor: 'CompetitorDelta', email: 'marketing@delta-corp.com', status: 'Inactive', lastReceived: '5 days ago', totalReceived: 12, industry: 'Finance' },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSeed, setNewSeed] = useState({ competitor: '', email: '', industry: 'SaaS' });

  const handleAdd = () => {
    if (!newSeed?.competitor || !newSeed?.email) return;
    setSeeds(prev => [...prev, { id: Date.now(), ...newSeed, status: 'Active', lastReceived: 'Never', totalReceived: 0 }]);
    setNewSeed({ competitor: '', email: '', industry: 'SaaS' });
    setShowAdd(false);
  };

  const handleRemove = (id) => setSeeds(prev => prev?.filter(s => s?.id !== id));
  const handleToggle = (id) => setSeeds(prev => prev?.map(s => s?.id === id ? { ...s, status: s?.status === 'Active' ? 'Inactive' : 'Active' } : s));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Competitor Seed Lists</h3>
          <p className="text-sm text-muted-foreground mt-1">Email addresses subscribed to competitor newsletters for monitoring</p>
        </div>
        <Button variant="default" size="sm" iconName="Plus" iconPosition="left" onClick={() => setShowAdd(true)}>
          Add Seed
        </Button>
      </div>
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-xl p-5">
          <h4 className="font-medium text-foreground mb-4">Add Competitor Seed</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Competitor Name</label>
              <input
                type="text"
                value={newSeed?.competitor}
                onChange={e => setNewSeed(p => ({ ...p, competitor: e?.target?.value }))}
                placeholder="e.g. CompetitorX"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Seed Email Address</label>
              <input
                type="email"
                value={newSeed?.email}
                onChange={e => setNewSeed(p => ({ ...p, email: e?.target?.value }))}
                placeholder="monitor@yourcompany.com"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Industry</label>
              <select
                value={newSeed?.industry}
                onChange={e => setNewSeed(p => ({ ...p, industry: e?.target?.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary"
              >
                {['SaaS', 'E-commerce', 'Finance', 'Healthcare', 'Education', 'Other']?.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="default" size="sm" onClick={handleAdd}>Add Seed</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {['Competitor', 'Seed Email', 'Industry', 'Status', 'Last Received', 'Total', 'Actions']?.map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seeds?.map(seed => (
              <tr key={seed?.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{seed?.competitor}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{seed?.email}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{seed?.industry}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    seed?.status === 'Active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {seed?.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{seed?.lastReceived}</td>
                <td className="px-4 py-3 text-sm font-mono text-foreground">{seed?.totalReceived}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(seed?.id)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title={seed?.status === 'Active' ? 'Pause' : 'Activate'}
                    >
                      <Icon name={seed?.status === 'Active' ? 'Pause' : 'Play'} size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleRemove(seed?.id)}
                      className="p-1.5 rounded hover:bg-error/10 transition-colors"
                      title="Remove"
                    >
                      <Icon name="Trash2" size={14} className="text-error" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SeedListManager;
