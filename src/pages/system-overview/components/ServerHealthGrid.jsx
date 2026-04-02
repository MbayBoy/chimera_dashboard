import { useState } from 'react';
import Icon from '../../../components/AppIcon';
import ServerHealthRow from './ServerHealthRow';

const ServerHealthGrid = ({ servers }) => {
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return 'ChevronsUpDown';
    return sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown';
  };

  const filteredServers = servers?.filter(server => {
    if (statusFilter === 'all') return true;
    return server?.status?.toLowerCase() === statusFilter?.toLowerCase();
  });

  const sortedServers = [...filteredServers]?.sort((a, b) => {
    let aValue = a?.[sortField];
    let bValue = b?.[sortField];

    if (sortField === 'name' || sortField === 'ip') {
      aValue = aValue?.toLowerCase();
      bValue = bValue?.toLowerCase();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const statusCounts = {
    all: servers?.length,
    online: servers?.filter(s => s?.status?.toLowerCase() === 'online')?.length,
    warning: servers?.filter(s => s?.status?.toLowerCase() === 'warning')?.length,
    offline: servers?.filter(s => s?.status?.toLowerCase() === 'offline')?.length
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-heading font-semibold text-foreground mb-1">
              Server Health Grid
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitor your email delivery fleet status and performance
            </p>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2 lg:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth ${
                statusFilter === 'all' ?'bg-primary text-primary-foreground' :'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All ({statusCounts?.all})
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth ${
                statusFilter === 'online' ?'bg-success text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Online ({statusCounts?.online})
            </button>
            <button
              onClick={() => setStatusFilter('warning')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth ${
                statusFilter === 'warning' ?'bg-warning text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Warning ({statusCounts?.warning})
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-smooth ${
                statusFilter === 'offline' ?'bg-error text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Offline ({statusCounts?.offline})
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[800px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
                >
                  Server
                  <Icon name={getSortIcon('name')} size={16} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
                >
                  Status
                  <Icon name={getSortIcon('status')} size={16} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('reputation')}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
                >
                  Reputation
                  <Icon name={getSortIcon('reputation')} size={16} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('dailySent')}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
                >
                  Daily Progress
                  <Icon name={getSortIcon('dailySent')} size={16} />
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button
                  onClick={() => handleSort('blacklistCount')}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth mx-auto"
                >
                  Blacklists
                  <Icon name={getSortIcon('blacklistCount')} size={16} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedServers?.map(server => (
              <ServerHealthRow key={server?.id} server={server} />
            ))}
          </tbody>
        </table>
      </div>
      {sortedServers?.length === 0 && (
        <div className="p-12 text-center">
          <Icon name="Server" size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No servers found matching the selected filter</p>
        </div>
      )}
    </div>
  );
};

export default ServerHealthGrid;