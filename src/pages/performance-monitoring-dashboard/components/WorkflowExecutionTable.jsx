import React from 'react';

const formatDuration = (ms) => {
  if (ms >= 60000) return `${(ms / 60000)?.toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000)?.toFixed(1)}s`;
  return `${ms}ms`;
};

const WorkflowExecutionTable = ({ workflows }) => {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Workflow Execution Durations</h3>
          <p className="text-gray-400 text-xs mt-0.5">All 9 system workflows · avg runtime & success rates</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">{workflows?.filter(w => w?.status === 'running')?.length} running</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 pb-2 pr-4">Workflow</th>
              <th className="text-left text-gray-400 pb-2 pr-4">Schedule</th>
              <th className="text-right text-gray-400 pb-2 pr-4">Avg Runtime</th>
              <th className="text-left text-gray-400 pb-2 pr-4">Last Run</th>
              <th className="text-right text-gray-400 pb-2 pr-4">Success Rate</th>
              <th className="text-right text-gray-400 pb-2">Failures</th>
            </tr>
          </thead>
          <tbody>
            {workflows?.map((w) => (
              <tr key={w?.name} className="border-b border-gray-800 hover:bg-gray-800/40">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${w?.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                    <span className="text-gray-200 font-medium">{w?.name}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-gray-400">{w?.schedule}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-blue-400 font-semibold">{formatDuration(w?.avgRuntime)}</td>
                <td className="py-2.5 pr-4 text-gray-400">{w?.lastRun}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className={`font-semibold ${w?.successRate >= 99 ? 'text-green-400' : w?.successRate >= 97 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {w?.successRate}%
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <span className={`${w?.failures === 0 ? 'text-gray-500' : w?.failures > 20 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {w?.failures}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkflowExecutionTable;
