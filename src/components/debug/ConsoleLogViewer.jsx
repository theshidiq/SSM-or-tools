/**
 * ConsoleLogViewer.jsx
 * 
 * Real-time console log viewer component
 * Shows captured console logs with filtering and export capabilities
 */

import React, { useState, useEffect } from 'react';

const ConsoleLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [isVisible, setIsVisible] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    // Check if console logger is available
    if (!window.consoleLogger) {
      console.log('⏳ Waiting for console logger...');
      const checkInterval = setInterval(() => {
        if (window.consoleLogger) {
          clearInterval(checkInterval);
          loadLogs();
        }
      }, 100);
      return () => clearInterval(checkInterval);
    } else {
      loadLogs();
    }

    // Set up periodic refresh
    const refreshInterval = setInterval(loadLogs, 1000);
    return () => clearInterval(refreshInterval);
  }, []);

  const loadLogs = () => {
    if (window.consoleLogger) {
      const allLogs = window.consoleLogger.getLogs();
      setLogs(allLogs);
      setSummary(window.consoleLogger.getSummary());
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.level === filter;
  });

  const getLogColor = (level) => {
    switch (level) {
      case 'ERROR': return 'text-red-600 bg-red-50';
      case 'WARN': return 'text-yellow-700 bg-yellow-50';
      case 'INFO': return 'text-blue-600 bg-blue-50';
      case 'LOG': return 'text-gray-700 bg-gray-50';
      case 'DEBUG': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-white';
    }
  };

  const handleExport = () => {
    if (window.exportConsoleLogs) {
      window.exportConsoleLogs();
    }
  };

  const handleClear = () => {
    if (window.clearConsoleLogs) {
      window.clearConsoleLogs();
      setLogs([]);
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 left-4 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm z-50 hover:bg-gray-700"
      >
        📋 Console Logs {logs.length > 0 && `(${logs.length})`}
        {summary?.recentErrors?.length > 0 && (
          <span className="ml-1 bg-red-500 text-white px-1 py-0.5 rounded text-xs">
            {summary.recentErrors.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 bg-white border border-gray-300 rounded-lg shadow-lg w-96 max-h-96 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-900">📋 Console Logs</span>
          {summary && (
            <span className="text-xs text-gray-600">
              ({summary.total} total)
            </span>
          )}
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-2 p-2 border-b border-gray-100">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1"
        >
          <option value="ALL">All ({logs.length})</option>
          <option value="ERROR">Errors ({logs.filter(l => l.level === 'ERROR').length})</option>
          <option value="WARN">Warnings ({logs.filter(l => l.level === 'WARN').length})</option>
          <option value="INFO">Info ({logs.filter(l => l.level === 'INFO').length})</option>
          <option value="LOG">Logs ({logs.filter(l => l.level === 'LOG').length})</option>
          <option value="DEBUG">Debug ({logs.filter(l => l.level === 'DEBUG').length})</option>
        </select>

        <label className="flex items-center text-xs">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="mr-1"
          />
          Auto-scroll
        </label>

        <button
          onClick={handleExport}
          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
        >
          Export
        </button>

        <button
          onClick={handleClear}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
        >
          Clear
        </button>
      </div>

      {/* Summary */}
      {summary && summary.recentErrors.length > 0 && (
        <div className="p-2 bg-red-50 border-b border-red-200">
          <div className="text-xs font-medium text-red-800">
            ⚠️ Recent Errors ({summary.recentErrors.length}):
          </div>
          {summary.recentErrors.slice(0, 2).map((error, index) => (
            <div key={index} className="text-xs text-red-700 mt-1">
              {new Date(error.timestamp).toLocaleTimeString()}: {error.message.substring(0, 50)}...
            </div>
          ))}
        </div>
      )}

      {/* Log List */}
      <div className="flex-1 overflow-y-auto max-h-64">
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No logs to display
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.slice(-50).map((log, index) => (
              <div
                key={index}
                className={`px-2 py-1 text-xs border-l-2 ${getLogColor(log.level)} border-l-current`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`text-xs font-medium px-1 rounded ${
                    log.level === 'ERROR' ? 'bg-red-200 text-red-800' :
                    log.level === 'WARN' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {log.level}
                  </span>
                </div>
                <div className="mt-1 break-words">
                  {log.message}
                </div>
                {log.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-gray-500 text-xs">
                      Show stack trace
                    </summary>
                    <pre className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                      {log.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsoleLogViewer;