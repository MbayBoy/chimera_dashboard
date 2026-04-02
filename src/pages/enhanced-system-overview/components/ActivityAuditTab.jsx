import { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const AUDIT_SOURCES = [
  'Export_Report', 'Backup_System', 'Remediation_Action',
  'Anomaly_Detection', 'User_Operation', 'Campaign_Queue', 'Verification_Job'
];

const PAGE_SIZE = 50;

const DATE_RANGES = [
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

const getDateFrom = (range) => {
  const now = new Date();
  if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000)?.toISOString();
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000)?.toISOString();
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000)?.toISOString();
  return null;
};

const StatusBadge = ({ status }) => {
  const isSuccess = status === 'Success' || status === 'INFO' || status === 'completed';
  const isWarn = status === 'WARN';
  const isError = status === 'Failed' || status === 'ERROR' || status === 'CRITICAL';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      isSuccess ? 'bg-success/10 text-success' : isWarn ?'bg-warning/10 text-warning': isError ?'bg-error/10 text-error': 'bg-muted text-muted-foreground'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        isSuccess ? 'bg-success' : isWarn ? 'bg-warning' : isError ? 'bg-error' : 'bg-muted-foreground'
      }`} />
      {isSuccess ? 'Success' : isError ? 'Failed' : status}
    </span>
  );
};

const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <Icon name="ChevronsUpDown" size={12} className="text-muted-foreground" />;
  return <Icon name={sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={12} className="text-primary" />;
};

const ActivityAuditTab = () => {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('log_timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [dateRange, setDateRange] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchAudit = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      let query = supabase?.from('system_logs')?.select('*', { count: 'exact' })?.in('source', AUDIT_SOURCES)?.order(sortField, { ascending: sortDir === 'asc' })?.range((pg - 1) * PAGE_SIZE, pg * PAGE_SIZE - 1);

      const from = dateRange === 'custom' ? customFrom : getDateFrom(dateRange);
      if (from) query = query?.gte('log_timestamp', from);
      if (dateRange === 'custom' && customTo) query = query?.lte('log_timestamp', customTo);
      if (selectedTypes?.length > 0) query = query?.in('source', selectedTypes);
      if (statusFilter === 'success') query = query?.in('log_level', ['INFO']);
      if (statusFilter === 'failed') query = query?.in('log_level', ['ERROR', 'CRITICAL', 'WARN']);
      if (searchText) query = query?.ilike('message', `%${searchText}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      setEntries(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [sortField, sortDir, dateRange, customFrom, customTo, selectedTypes, statusFilter, searchText]);

  useEffect(() => {
    setPage(1);
    fetchAudit(1);
  }, [fetchAudit]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleType = (type) => {
    setSelectedTypes(prev =>
      prev?.includes(type) ? prev?.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let query = supabase?.from('system_logs')?.select('*')?.in('source', selectedTypes?.length > 0 ? selectedTypes : AUDIT_SOURCES)?.order(sortField, { ascending: sortDir === 'asc' })?.limit(5000);

      const from = dateRange === 'custom' ? customFrom : getDateFrom(dateRange);
      if (from) query = query?.gte('log_timestamp', from);
      if (dateRange === 'custom' && customTo) query = query?.lte('log_timestamp', customTo);
      if (statusFilter === 'success') query = query?.in('log_level', ['INFO']);
      if (statusFilter === 'failed') query = query?.in('log_level', ['ERROR', 'CRITICAL', 'WARN']);
      if (searchText) query = query?.ilike('message', `%${searchText}%`);

      const { data } = await query;
      const rows = (data || [])?.map(e => [
        `"${new Date(e.log_timestamp)?.toISOString()}"`,
        `"${e?.source || ''}"`,
        `"${e?.user_id || ''}"`,
        `"${(e?.message || '')?.replace(/"/g, "'")}"`,
        `"${e?.log_level || ''}"`,
        `"${e?.metadata?.duration || ''}"`,
        `"${e?.server_id || e?.related_campaign_id || ''}"`,
      ]?.join(','));
      const csv = [
        'Timestamp,Activity Type,User,Action Description,Status,Duration,Affected Entity',
        ...rows
      ]?.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-audit-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
      a?.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getStatusFromLevel = (level) => {
    if (level === 'INFO') return 'Success';
    if (level === 'WARN') return 'Warning';
    return 'Failed';
  };

  const columns = [
    { key: 'log_timestamp', label: 'Timestamp', sortable: true },
    { key: 'source', label: 'Activity Type', sortable: true },
    { key: 'user_id', label: 'User', sortable: false },
    { key: 'message', label: 'Action Description', sortable: false },
    { key: 'log_level', label: 'Status', sortable: true },
    { key: 'duration', label: 'Duration', sortable: false },
    { key: 'entity', label: 'Affected Entity', sortable: false },
    { key: 'details', label: 'Details', sortable: false },
  ];

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Icon name="Calendar" size={14} className="text-muted-foreground" />
            <select
              value={dateRange}
              onChange={e => setDateRange(e?.target?.value)}
              className="text-sm bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground"
            >
              {DATE_RANGES?.map(r => <option key={r?.value} value={r?.value}>{r?.label}</option>)}
            </select>
          </div>
          {dateRange === 'custom' && (
            <>
              <input type="datetime-local" value={customFrom} onChange={e => setCustomFrom(e?.target?.value)}
                className="text-sm bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground" />
              <span className="text-muted-foreground text-sm">to</span>
              <input type="datetime-local" value={customTo} onChange={e => setCustomTo(e?.target?.value)}
                className="text-sm bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground" />
            </>
          )}
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e?.target?.value)}
            className="text-sm bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success Only</option>
            <option value="failed">Failed Only</option>
          </select>
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Icon name="Search" size={14} className="text-muted-foreground" />
            <input
              type="text"
              placeholder="Search descriptions..."
              value={searchText}
              onChange={e => setSearchText(e?.target?.value)}
              className="flex-1 text-sm bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {/* Export */}
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors ml-auto"
          >
            <Icon name={exporting ? 'Loader' : 'Download'} size={14} className={exporting ? 'animate-spin' : ''} />
            Export CSV
          </button>
        </div>
        {/* Activity Type Multi-Select */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Filter by type:</span>
          {AUDIT_SOURCES?.map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedTypes?.includes(type)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {type?.replace(/_/g, ' ')}
            </button>
          ))}
          {selectedTypes?.length > 0 && (
            <button onClick={() => setSelectedTypes([])}
              className="px-2 py-1 rounded-md text-xs text-error hover:bg-error/10 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>
      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `${total?.toLocaleString()} entries found`}
        </p>
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages || 1}
        </p>
      </div>
      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {columns?.map(col => (
                  <th
                    key={col?.key}
                    onClick={() => col?.sortable && handleSort(col?.key)}
                    className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                      col?.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {col?.label}
                      {col?.sortable && <SortIcon field={col?.key} sortField={sortField} sortDir={sortDir} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 8 })?.map((_, i) => (
                  <tr key={i}>
                    {columns?.map(c => (
                      <td key={c?.key} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries?.length === 0 ? (
                <tr>
                  <td colSpan={columns?.length} className="px-4 py-12 text-center text-muted-foreground">
                    <Icon name="ClipboardList" size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No audit entries found for the selected filters</p>
                  </td>
                </tr>
              ) : (
                entries?.map(entry => (
                  <>
                    <tr
                      key={entry?.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(entry.log_timestamp)?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                          {(entry?.source || '')?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {entry?.user_id ? entry?.user_id?.slice(0, 8) + '...' : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-xs">
                        <p className="truncate" title={entry?.message}>{entry?.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={getStatusFromLevel(entry?.log_level)} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {entry?.metadata?.duration ? `${entry?.metadata?.duration}ms` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {entry?.server_id ? `srv:${entry?.server_id?.slice(0, 6)}` :
                         entry?.related_campaign_id ? `cmp:${entry?.related_campaign_id?.slice(0, 6)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {entry?.metadata && Object.keys(entry?.metadata)?.length > 0 && (
                          <button
                            onClick={() => setExpandedRow(expandedRow === entry?.id ? null : entry?.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Icon name={expandedRow === entry?.id ? 'ChevronUp' : 'ChevronDown'} size={12} />
                            {expandedRow === entry?.id ? 'Hide' : 'View'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRow === entry?.id && (
                      <tr key={`${entry?.id}-expanded`} className="bg-muted/10">
                        <td colSpan={columns?.length} className="px-4 py-3">
                          <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 overflow-x-auto max-h-40">
                            {JSON.stringify(entry?.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => { setPage(p => Math.max(1, p - 1)); fetchAudit(Math.max(1, page - 1)); }}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <Icon name="ChevronLeft" size={14} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            return (
              <button
                key={pg}
                onClick={() => { setPage(pg); fetchAudit(pg); }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  pg === page ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {pg}
              </button>
            );
          })}
          <button
            onClick={() => { setPage(p => Math.min(totalPages, p + 1)); fetchAudit(Math.min(totalPages, page + 1)); }}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <Icon name="ChevronRight" size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityAuditTab;
