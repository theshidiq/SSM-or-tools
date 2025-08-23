/**
 * EnhancedAIAssistantModal.jsx
 * 
 * Enhanced AI Assistant modal with performance optimizations, cancellation support,
 * streaming results, and improved user experience.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Sparkles,
  TrendingUp,
  BarChart3,
  Lightbulb,
  CheckCircle,
  Brain,
  Zap,
  Clock,
  Target,
  AlertTriangle,
  Pause,
  Play,
  Square,
  Activity,
  Cpu,
  MemoryStick,
  Gauge,
  Settings,
  Download,
  Upload
} from "lucide-react";

const EnhancedAIAssistantModal = ({
  isOpen,
  onClose,
  onAutoFillSchedule,
  isProcessing,
  systemStatus,
  performanceMonitor,
  streamingManager,
  onCancel,
  onPause,
  onResume
}) => {
  // State management
  const [results, setResults] = useState(null);
  const [streamingResults, setStreamingResults] = useState([]);
  const [progressState, setProgressState] = useState({
    progress: 0,
    stage: 'idle',
    message: '',
    stats: {},
    canCancel: false,
    canPause: false,
    isPaused: false
  });
  
  // Performance monitoring state
  const [performanceMetrics, setPerformanceMetrics] = useState({});
  const [memoryUsage, setMemoryUsage] = useState({});
  const [alerts, setAlerts] = useState([]);
  
  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);
  const [showStreamingView, setShowStreamingView] = useState(false);
  
  // Refs for performance monitoring
  const performanceUpdateRef = useRef(null);
  const streamSubscriptionRef = useRef(null);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen]);

  // Setup performance monitoring
  useEffect(() => {
    if (isOpen && performanceMonitor) {
      setupPerformanceMonitoring();
    }
    return cleanup;
  }, [isOpen, performanceMonitor]);

  // Setup streaming results
  useEffect(() => {
    if (isOpen && streamingManager && isProcessing) {
      setupStreamingSubscription();
    }
    return () => {
      if (streamSubscriptionRef.current) {
        streamSubscriptionRef.current();
        streamSubscriptionRef.current = null;
      }
    };
  }, [isOpen, streamingManager, isProcessing]);

  /**
   * Setup performance monitoring
   */
  const setupPerformanceMonitoring = useCallback(() => {
    if (!performanceMonitor) return;

    // Subscribe to performance updates
    const updatePerformance = () => {
      const metrics = performanceMonitor.getPerformanceReport();
      setPerformanceMetrics(metrics);
      
      // Update memory usage if available
      if (metrics.metrics?.memoryUsage) {
        setMemoryUsage(metrics.metrics.memoryUsage);
      }
      
      // Update alerts
      if (metrics.recentAlerts) {
        setAlerts(prev => {
          const newAlerts = metrics.recentAlerts.filter(
            alert => !prev.find(p => p.timestamp === alert.timestamp)
          );
          return [...prev, ...newAlerts].slice(-5); // Keep last 5 alerts
        });
      }
    };

    // Update immediately and then every 2 seconds
    updatePerformance();
    performanceUpdateRef.current = setInterval(updatePerformance, 2000);

    // Subscribe to alerts
    const alertUnsubscribe = performanceMonitor.onAlert((alert) => {
      setAlerts(prev => [...prev, alert].slice(-5));
    });

    return () => {
      if (performanceUpdateRef.current) {
        clearInterval(performanceUpdateRef.current);
      }
      alertUnsubscribe();
    };
  }, [performanceMonitor]);

  /**
   * Setup streaming subscription
   */
  const setupStreamingSubscription = useCallback(() => {
    if (!streamingManager || !isProcessing) return;

    // Subscribe to streaming results
    const streamId = 'ml_processing_' + Date.now();
    
    streamSubscriptionRef.current = streamingManager.subscribeToStream(
      streamId,
      (data, metadata) => {
        if (metadata.type === 'chunk') {
          setStreamingResults(prev => [...prev, ...data].slice(-100)); // Keep last 100 results
        } else if (metadata.type === 'complete') {
          console.log('Streaming completed:', data);
        }
      },
      {
        includePartial: true,
        throttle: 100 // Throttle updates to 100ms
      }
    );
  }, [streamingManager, isProcessing]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    // Clear performance monitoring
    if (performanceUpdateRef.current) {
      clearInterval(performanceUpdateRef.current);
      performanceUpdateRef.current = null;
    }

    // Clear streaming subscription
    if (streamSubscriptionRef.current) {
      streamSubscriptionRef.current();
      streamSubscriptionRef.current = null;
    }

    // Reset state
    setResults(null);
    setStreamingResults([]);
    setProgressState({
      progress: 0,
      stage: 'idle',
      message: '',
      stats: {},
      canCancel: false,
      canPause: false,
      isPaused: false
    });
    setAlerts([]);
  }, []);

  /**
   * Handle auto-fill schedule with enhanced features
   */
  const handleAutoFillSchedule = useCallback(async () => {
    setProgressState(prev => ({
      ...prev,
      stage: "starting",
      message: "AIシステムを初期化中...",
      progress: 0,
      canCancel: true,
      canPause: false
    }));

    try {
      const result = await onAutoFillSchedule((progress) => {
        setProgressState(prev => ({
          ...prev,
          ...progress,
          canCancel: progress.stage !== 'completed',
          canPause: progress.stage === 'processing' || progress.stage === 'ml_processing'
        }));
      });

      setResults(result);
      setProgressState(prev => ({
        ...prev,
        stage: "completed",
        progress: 100,
        canCancel: false,
        canPause: false
      }));

    } catch (error) {
      setResults({
        success: false,
        error: error.message,
        canRetry: true
      });
      setProgressState(prev => ({
        ...prev,
        stage: "error",
        message: `エラー: ${error.message}`,
        canCancel: false,
        canPause: false
      }));
    }
  }, [onAutoFillSchedule]);

  /**
   * Handle cancellation
   */
  const handleCancel = useCallback(async () => {
    if (onCancel) {
      await onCancel();
      setProgressState(prev => ({
        ...prev,
        stage: "cancelled",
        message: "処理がキャンセルされました",
        canCancel: false,
        canPause: false
      }));
    }
  }, [onCancel]);

  /**
   * Handle pause/resume
   */
  const handlePauseResume = useCallback(async () => {
    if (progressState.isPaused) {
      if (onResume) {
        await onResume();
        setProgressState(prev => ({
          ...prev,
          isPaused: false,
          message: "処理を再開しました"
        }));
      }
    } else {
      if (onPause) {
        await onPause();
        setProgressState(prev => ({
          ...prev,
          isPaused: true,
          message: "処理を一時停止しました"
        }));
      }
    }
  }, [progressState.isPaused, onPause, onResume]);

  /**
   * Export performance data
   */
  const handleExportPerformance = useCallback(() => {
    if (performanceMonitor) {
      const data = performanceMonitor.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai_performance_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [performanceMonitor]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-yellow-300" />
              <h2 className="text-lg font-medium">Enhanced AI アシスタント</h2>
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm">
                  <Activity size={16} className="animate-pulse" />
                  <span>処理中</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Performance indicator */}
              {performanceMetrics.metrics && (
                <div className="flex items-center gap-1 text-xs bg-white/20 rounded px-2 py-1">
                  <Gauge size={12} />
                  <span>
                    {Math.round(performanceMetrics.metrics.uiResponsiveness?.averageFrameTime || 16)}ms
                  </span>
                </div>
              )}
              
              {/* Memory indicator */}
              {memoryUsage.current && (
                <div className="flex items-center gap-1 text-xs bg-white/20 rounded px-2 py-1">
                  <MemoryStick size={12} />
                  <span>{Math.round(memoryUsage.current / 1024 / 1024)}MB</span>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
                disabled={isProcessing && !progressState.canCancel}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Progress bar */}
          {isProcessing && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{progressState.message || "処理中..."}</span>
                <span>{progressState.progress || 0}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-yellow-300 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressState.progress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {alerts.slice(-3).map((alert, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg border text-sm ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : alert.severity === 'warning'
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>{alert.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Main controls */}
          <div className="space-y-4">
            {/* Processing controls */}
            {isProcessing ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-yellow-600 animate-pulse" />
                    <span className="font-medium text-yellow-900">AI処理中</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Pause/Resume button */}
                    {progressState.canPause && (
                      <button
                        onClick={handlePauseResume}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        {progressState.isPaused ? <Play size={14} /> : <Pause size={14} />}
                        {progressState.isPaused ? '再開' : '一時停止'}
                      </button>
                    )}
                    
                    {/* Cancel button */}
                    {progressState.canCancel && (
                      <button
                        onClick={handleCancel}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        <Square size={14} />
                        キャンセル
                      </button>
                    )}
                  </div>
                </div>

                {/* Processing details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-yellow-700">進捗:</span>
                    <span className="ml-2 font-medium">{progressState.progress}%</span>
                  </div>
                  <div>
                    <span className="text-yellow-700">ステージ:</span>
                    <span className="ml-2 font-medium">{progressState.stage}</span>
                  </div>
                  {progressState.stats?.totalWork && (
                    <>
                      <div>
                        <span className="text-yellow-700">処理済み:</span>
                        <span className="ml-2 font-medium">
                          {progressState.stats.completedWork || 0} / {progressState.stats.totalWork}
                        </span>
                      </div>
                      <div>
                        <span className="text-yellow-700">処理時間:</span>
                        <span className="ml-2 font-medium">
                          {Math.round((progressState.stats.processingTime || 0) / 1000)}s
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Start processing section */
              <div className="text-center">
                <Sparkles size={48} className="text-violet-600 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Enhanced AI スケジュール自動入力
                </h3>
                <p className="text-gray-600 text-sm mb-6">
                  高性能AIがメモリ最適化とストリーミング処理で最適なシフトを予測します
                </p>
                
                <button
                  onClick={handleAutoFillSchedule}
                  className="bg-violet-600 text-white px-8 py-3 rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Sparkles size={16} />
                  Enhanced AI 自動入力を実行
                </button>
              </div>
            )}

            {/* View toggle buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                <Settings size={14} />
                詳細設定
              </button>
              
              {performanceMonitor && (
                <button
                  onClick={() => setShowPerformanceDetails(!showPerformanceDetails)}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  <Activity size={14} />
                  パフォーマンス
                </button>
              )}
              
              {streamingResults.length > 0 && (
                <button
                  onClick={() => setShowStreamingView(!showStreamingView)}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  <TrendingUp size={14} />
                  ストリーミング結果
                </button>
              )}
              
              {performanceMonitor && (
                <button
                  onClick={handleExportPerformance}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  <Download size={14} />
                  データエクスポート
                </button>
              )}
            </div>

            {/* Advanced settings */}
            {showAdvanced && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium mb-3">詳細設定</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-gray-700 mb-1">メモリ制限</label>
                    <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                      <option value="400">400MB (推奨)</option>
                      <option value="600">600MB (高性能)</option>
                      <option value="200">200MB (省メモリ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1">処理方式</label>
                    <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                      <option value="streaming">ストリーミング (推奨)</option>
                      <option value="batch">バッチ処理</option>
                      <option value="worker">Web Worker</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Performance details */}
            {showPerformanceDetails && performanceMetrics.metrics && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <BarChart3 size={16} />
                  パフォーマンス詳細
                </h4>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">平均処理時間:</span>
                    <span className="ml-2 font-medium">
                      {Math.round(performanceMetrics.metrics.averageProcessingTime || 0)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">成功率:</span>
                    <span className="ml-2 font-medium">
                      {performanceMetrics.metrics.totalProcessingJobs > 0
                        ? Math.round((performanceMetrics.metrics.successfulJobs / performanceMetrics.metrics.totalProcessingJobs) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">フレームレート:</span>
                    <span className="ml-2 font-medium">
                      {Math.round(1000 / (performanceMetrics.metrics.uiResponsiveness?.averageFrameTime || 16))}fps
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">メモリ使用量:</span>
                    <span className="ml-2 font-medium">
                      {Math.round((memoryUsage.current || 0) / 1024 / 1024)}MB
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Streaming results view */}
            {showStreamingView && streamingResults.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp size={16} />
                  リアルタイム結果 ({streamingResults.length})
                </h4>
                
                <div className="max-h-40 overflow-y-auto">
                  <div className="space-y-1 text-xs">
                    {streamingResults.slice(-20).map((result, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-white rounded">
                        <span>{result.staffName}</span>
                        <span>{result.dateKey}</span>
                        <span className="font-mono">{result.prediction}</span>
                        <span className="text-gray-500">{result.confidence}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* System Status */}
            {systemStatus && systemStatus.type === "enhanced" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Enhanced ハイブリッドAIシステム
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs text-blue-800">
                  <div>
                    初期化: {systemStatus.initialized ? "✓" : "⏳"}
                  </div>
                  <div>
                    MLモデル: {systemStatus.health?.mlModel?.ready ? "✓" : "⏳"}
                  </div>
                  <div>
                    メモリ管理: {systemStatus.memoryManager ? "✓" : "⏳"}
                  </div>
                  <div>
                    ストリーミング: {systemStatus.streaming ? "✓" : "⏳"}
                  </div>
                </div>
              </div>
            )}

            {/* Results display */}
            {results && (
              <div className="space-y-4">
                <div className={`border rounded-lg p-4 ${
                  results.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={16} className={
                      results.success ? "text-green-600" : "text-red-600"
                    } />
                    <span className={`font-medium ${
                      results.success ? "text-green-900" : "text-red-900"
                    }`}>
                      {results.success ? "処理完了" : "エラー発生"}
                    </span>
                  </div>
                  
                  <p className={`text-sm ${
                    results.success ? "text-green-800" : "text-red-800"
                  }`}>
                    {results.message || (results.success ? "AI処理が正常に完了しました" : "処理中にエラーが発生しました")}
                  </p>
                </div>

                {/* Enhanced results details */}
                {results.success && results.data && (
                  <div className="space-y-3">
                    {/* Main metrics */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-sm text-gray-600 mb-1">処理セル数</div>
                        <div className="text-2xl font-bold text-violet-600">
                          {results.data.filledCells || 0}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-sm text-gray-600 mb-1">予測精度</div>
                        <div className="text-2xl font-bold text-green-600">
                          {results.data.accuracy || 0}%
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-sm text-gray-600 mb-1">処理時間</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {Math.round((results.data.processingTime || 0) / 1000)}s
                        </div>
                      </div>
                    </div>

                    {/* Enhanced performance info */}
                    {results.data.performanceStats && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <div className="text-sm font-medium text-purple-900 mb-2">
                          Enhanced Performance
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-purple-800">
                          <div>メモリ効率: {results.data.performanceStats.memoryEfficiency || 0}%</div>
                          <div>ストリーミング: {results.data.performanceStats.streamingEnabled ? "有効" : "無効"}</div>
                          <div>Worker使用: {results.data.performanceStats.workerUsed ? "有効" : "無効"}</div>
                          <div>キャッシュヒット: {results.data.performanceStats.cacheHitRate || 0}%</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced footer */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Enhanced ハイブリッドAIアシスタント v4.0
              {systemStatus?.health?.version && ` - ${systemStatus.health.version}`}
            </div>
            
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {memoryUsage.current && (
                <div className="flex items-center gap-1">
                  <MemoryStick size={10} />
                  {Math.round(memoryUsage.current / 1024 / 1024)}MB
                </div>
              )}
              
              {performanceMetrics.metrics?.totalProcessingJobs > 0 && (
                <div className="flex items-center gap-1">
                  <Cpu size={10} />
                  {performanceMetrics.metrics.totalProcessingJobs} jobs
                </div>
              )}
              
              {streamingResults.length > 0 && (
                <div className="flex items-center gap-1">
                  <Activity size={10} />
                  {streamingResults.length} results
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAIAssistantModal;