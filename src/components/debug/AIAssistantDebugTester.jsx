/**
 * AIAssistantDebugTester.jsx
 * 
 * Temporary debug component to test AI assistant flow and identify bottlenecks
 */

import React, { useState } from 'react';
import { useAIAssistantDebug } from '../../hooks/useAIAssistantDebug';

const AIAssistantDebugTester = ({ scheduleData, staffMembers, currentMonthIndex, updateSchedule }) => {
  const [debugResults, setDebugResults] = useState(null);
  const [isDebugging, setIsDebugging] = useState(false);

  const {
    isInitialized,
    isProcessing,
    initializeAI,
    autoFillSchedule,
    systemType,
    systemHealth,
    errorHistory,
    configurationStatus,
    startDebugging,
    stopDebugging,
    exportDebugReport,
    debugLog,
    isAvailable
  } = useAIAssistantDebug(scheduleData, staffMembers, currentMonthIndex, updateSchedule);

  const handleStartDebugSession = async () => {
    setIsDebugging(true);
    setDebugResults(null);
    
    // Start debugging trace
    startDebugging();
    debugLog('USER_TEST_SESSION_START', 'User initiated debug test session');
    
    try {
      // Test AI initialization
      debugLog('USER_TEST_INIT', 'Testing AI initialization');
      await initializeAI();
      
      // Test auto-fill
      debugLog('USER_TEST_AUTO_FILL', 'Testing auto-fill functionality');
      const result = await autoFillSchedule();
      
      debugLog('USER_TEST_COMPLETE', 'Debug test completed', {
        result: result.success ? 'success' : 'failed',
        message: result.message
      });
      
      // Stop debugging and get report
      const report = stopDebugging();
      setDebugResults({
        aiResult: result,
        debugReport: report,
        timestamp: Date.now()
      });
      
    } catch (error) {
      debugLog('USER_TEST_ERROR', 'Debug test failed', {
        error: error.message,
        stack: error.stack
      });
      
      const report = stopDebugging();
      setDebugResults({
        aiResult: { success: false, error: error.message },
        debugReport: report,
        timestamp: Date.now()
      });
    } finally {
      setIsDebugging(false);
    }
  };

  const handleExportReport = () => {
    exportDebugReport();
  };

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80 z-50">
      <div className="text-sm font-medium text-gray-900 mb-3">
        🔍 AI Assistant Debug Tester
      </div>
      
      {/* System Status */}
      <div className="bg-gray-50 rounded p-2 mb-3 text-xs">
        <div>Status: <span className={`font-medium ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
          {systemType}
        </span></div>
        <div>Initialized: <span className={isInitialized ? 'text-green-600' : 'text-red-600'}>
          {isInitialized ? 'Yes' : 'No'}
        </span></div>
        <div>Config: <span className="font-medium">{configurationStatus}</span></div>
        <div>Processing: <span className={isProcessing ? 'text-yellow-600' : 'text-gray-600'}>
          {isProcessing ? 'Yes' : 'No'}
        </span></div>
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <button
          onClick={handleStartDebugSession}
          disabled={isDebugging}
          className={`w-full px-3 py-2 text-sm rounded ${
            isDebugging
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isDebugging ? 'Testing in Progress...' : 'Start Debug Test'}
        </button>

        {debugResults && (
          <button
            onClick={handleExportReport}
            className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export Debug Report
          </button>
        )}
      </div>

      {/* Error History */}
      {errorHistory.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-red-800 mb-1">Recent Errors:</div>
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs max-h-20 overflow-y-auto">
            {errorHistory.slice(-3).map((error, index) => (
              <div key={index} className="text-red-700">
                {new Date(error.timestamp).toLocaleTimeString()}: {error.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug Results */}
      {debugResults && (
        <div className="mt-3">
          <div className="text-xs font-medium text-gray-800 mb-1">Debug Results:</div>
          <div className="bg-gray-50 border rounded p-2 text-xs max-h-32 overflow-y-auto">
            <div className={`font-medium ${
              debugResults.aiResult.success ? 'text-green-700' : 'text-red-700'
            }`}>
              AI Result: {debugResults.aiResult.success ? 'SUCCESS' : 'FAILED'}
            </div>
            {debugResults.aiResult.message && (
              <div className="text-gray-700 mt-1">{debugResults.aiResult.message}</div>
            )}
            
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="font-medium text-gray-800">Debug Report Summary:</div>
              <div>Total Time: {debugResults.debugReport.totalTime}ms</div>
              <div>Total Logs: {debugResults.debugReport.totalLogs}</div>
              <div>Timeouts: {debugResults.debugReport.timeouts.length}</div>
              <div>Errors: {debugResults.debugReport.errors.length}</div>
              <div>Hang Points: {debugResults.debugReport.possibleHangPoints.length}</div>
            </div>

            {debugResults.debugReport.possibleHangPoints.length > 0 && (
              <div className="mt-2 pt-2 border-t border-red-200 bg-red-50">
                <div className="font-medium text-red-800">Potential Hang Points:</div>
                {debugResults.debugReport.possibleHangPoints.map((hang, index) => (
                  <div key={index} className="text-red-700">
                    {hang.phase}: {hang.hangTime}ms - {hang.possibleCause}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistantDebugTester;