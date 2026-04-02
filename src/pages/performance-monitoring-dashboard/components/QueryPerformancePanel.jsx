import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const slowestQueries = [
  { rank: 1, query: 'SELECT * FROM Contacts WHERE engagement_score < 20 ORDER BY last_seen', duration: 3240, calls: 142, table: 'Contacts' },
  { rank: 2, query: 'UPDATE Campaign_Queue SET status = ? WHERE campaign_id IN (...)', duration: 2180, calls: 89, table: 'Campaign_Queue' },
  { rank: 3, query: 'SELECT c.*, s.reputation_score FROM Campaigns c JOIN Servers s ON...', duration: 1890, calls: 234, table: 'Campaigns' },
  { rank: 4, query: 'INSERT INTO System_Logs (level, message, metadata) VALUES (...)', duration: 1450, calls: 1203, table: 'System_Logs' },
  { rank: 5, query: 'SELECT domain, COUNT(*) FROM Domains GROUP BY domain HAVING...', duration: 1120, calls: 67, table: 'Domains' },
  { rank: 6, query: 'DELETE FROM Contacts WHERE status = \'bounced\' AND created_at < NOW()', duration: 980, calls: 12, table: 'Contacts' },
  { rank: 7, query: 'SELECT * FROM Anomalies WHERE severity IN (\'critical\',\'high\') ORDER BY...', duration: 760, calls: 445, table: 'Anomalies' },
];

const histogramData = [
  { range: '<100ms', count: 4820 },
  { range: '100-250ms', count: 2340 },
  { range: '250-500ms', count: 890 },
  { range: '500ms-1s', count: 340 },
  { range: '1-2s', count: 128 },
  { range: '2-5s', count: 43 },
  { range: '>5s', count: 8 },
];

const getDurationColor = (ms) => {
  if (ms > 2000) return 'text-red-400';
  if (ms > 1000) return 'text-yellow-400';
  return 'text-green-400';
};

const QueryPerformancePanel = () => {
  const [tab, setTab] = useState('table');

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Query Performance</h3>
          <p className="text-gray-400 text-xs mt-0.5">Slowest queries & distribution</p>
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
          <button onClick={() => setTab('table')} className={`px-3 py-1 text-xs rounded-md transition-colors ${tab === 'table' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Slowest</button>
          <button onClick={() => setTab('histogram')} className={`px-3 py-1 text-xs rounded-md transition-colors ${tab === 'histogram' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Distribution</button>
        </div>
      </div>
      {tab === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 pb-2 pr-3">#</th>
                <th className="text-left text-gray-400 pb-2 pr-3">Query</th>
                <th className="text-right text-gray-400 pb-2 pr-3">Avg Duration</th>
                <th className="text-right text-gray-400 pb-2 pr-3">Calls</th>
                <th className="text-left text-gray-400 pb-2">Table</th>
              </tr>
            </thead>
            <tbody>
              {slowestQueries?.map((q) => (
                <tr key={q?.rank} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-2 pr-3 text-gray-500">{q?.rank}</td>
                  <td className="py-2 pr-3 text-gray-300 max-w-xs">
                    <span className="truncate block" title={q?.query}>{q?.query?.substring(0, 55)}...</span>
                  </td>
                  <td className={`py-2 pr-3 text-right font-mono font-semibold ${getDurationColor(q?.duration)}`}>{q?.duration}ms</td>
                  <td className="py-2 pr-3 text-right text-gray-400">{q?.calls?.toLocaleString()}</td>
                  <td className="py-2">
                    <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-xs">{q?.table}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={histogramData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default QueryPerformancePanel;
