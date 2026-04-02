import React, { useState } from 'react';

const initialAlerts = [
  { id: 1, type: 'critical', metric: 'API Response Time', message: 'p99 latency exceeded 2s threshold', value: '2.4s', threshold: '2s', time: '2 min ago', acknowledged: false },
  { id: 2, type: 'warning', metric: 'Cache Hit Rate', message: 'Campaign Data cache below 80%', value: '76%', threshold: '80%', time: '8 min ago', acknowledged: false },
  { id: 3, type: 'critical', metric: 'Connection Pool', message: 'Pool utilization above 90%', value: '94%', threshold: '90%', time: '15 min ago', acknowledged: true },
  { id: 4, type: 'warning', metric: 'Query Execution', message: 'Contacts table scan exceeds 1s', value: '3.2s', threshold: '1s', time: '22 min ago', acknowledged: false },
  { id: 5, type: 'info', metric: 'CPU Usage', message: 'CPU spike detected on primary node', value: '87%', threshold: '80%', time: '35 min ago', acknowledged: true },
  { id: 6, type: 'warning', metric: 'Memory Usage', message: 'Heap memory approaching limit', value: '78%', threshold: '75%', time: '1 hr ago', acknowledged: false },
  { id: 7, type: 'info', metric: 'Disk I/O', message: 'Write latency elevated on /data', value: '45ms', threshold: '30ms', time: '2 hrs ago', acknowledged: true },
];

const typeConfig = {
  critical: { bg: 'bg-red-900/30 border-red-700', badge: 'bg-red-600', dot: 'bg-red-400', label: 'CRITICAL' },
  warning: { bg: 'bg-yellow-900/20 border-yellow-700', badge: 'bg-yellow-600', dot: 'bg-yellow-400', label: 'WARNING' },
  info: { bg: 'bg-blue-900/20 border-blue-700', badge: 'bg-blue-600', dot: 'bg-blue-400', label: 'INFO' },
};

const PerformanceAlertsPanel = () => {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? alerts : filter === 'active' ? alerts?.filter(a => !a?.acknowledged) : alerts?.filter(a => a?.type === filter);
  const activeCount = alerts?.filter(a => !a?.acknowledged)?.length;

  const acknowledge = (id) => setAlerts(prev => prev?.map(a => a?.id === id ? { ...a, acknowledged: true } : a));
  const acknowledgeAll = () => setAlerts(prev => prev?.map(a => ({ ...a, acknowledged: true })));

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            Performance Alerts
            {activeCount > 0 && (
              <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">{activeCount}</span>
            )}
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">Real-time degradation detection</p>
        </div>
        {activeCount > 0 && (
          <button onClick={acknowledgeAll} className="text-xs text-blue-400 hover:text-blue-300">Ack All</button>
        )}
      </div>
      <div className="flex gap-1 mb-3 flex-wrap flex-shrink-0">
        {['all', 'active', 'critical', 'warning', 'info']?.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-xs rounded-full capitalize transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-2 overflow-y-auto flex-1">
        {filtered?.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No alerts matching filter</div>
        ) : (
          filtered?.map((alert) => {
            const cfg = typeConfig?.[alert?.type];
            return (
              <div key={alert?.id} className={`border rounded-lg p-3 ${cfg?.bg} ${alert?.acknowledged ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5 ${cfg?.dot} ${!alert?.acknowledged ? 'animate-pulse' : ''}`} />
                    <span className="text-white text-xs font-medium">{alert?.metric}</span>
                  </div>
                  <span className={`text-white text-xs px-1.5 py-0.5 rounded ${cfg?.badge} flex-shrink-0`}>{cfg?.label}</span>
                </div>
                <p className="text-gray-300 text-xs mt-1 ml-3">{alert?.message}</p>
                <div className="flex items-center justify-between mt-2 ml-3">
                  <div className="flex gap-3">
                    <span className="text-xs text-gray-400">Value: <span className="text-white">{alert?.value}</span></span>
                    <span className="text-xs text-gray-400">Threshold: <span className="text-gray-300">{alert?.threshold}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{alert?.time}</span>
                    {!alert?.acknowledged && (
                      <button onClick={() => acknowledge(alert?.id)} className="text-xs text-blue-400 hover:text-blue-300">Ack</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PerformanceAlertsPanel;
