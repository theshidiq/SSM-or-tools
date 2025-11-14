/**
 * ModelTrainingModal.jsx
 *
 * Dedicated modal for ML model training
 * Separate from AI Assistant - allows training independently
 */

import React, { useState, useEffect } from 'react';
import { useModelTraining } from '../../hooks/useModelTraining';
import { formatPeriodList } from '../../utils/periodDetection';

export const ModelTrainingModal = ({ isOpen, onClose }) => {
  const {
    modelStatus,
    trainingProgress,
    periodComparison,
    startTraining,
    cancelTraining,
    getModelInfo,
    isTraining,
    needsRetraining,
  } = useModelTraining();

  const [showDetails, setShowDetails] = useState(false);
  const [trainingStarted, setTrainingStarted] = useState(false);

  const modelInfo = getModelInfo();

  // Handle training start
  const handleStartTraining = async () => {
    setTrainingStarted(true);
    const result = await startTraining();

    if (result.success) {
      // Show success message for 2 seconds, then close modal to refresh period info
      setTimeout(() => {
        setTrainingStarted(false);
        // Close and reopen modal to refresh period comparison
        onClose();
      }, 2000);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (isTraining) {
      cancelTraining();
    }
    setTrainingStarted(false);
  };

  // Format time remaining
  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return '計算中...';

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (minutes > 0) {
      return `約${minutes}分${secs}秒`;
    }
    return `約${secs}秒`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              🧠 AIモデルトレーニング
            </h2>
            <button
              onClick={onClose}
              disabled={isTraining}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Model Status */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">モデル状態</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">ステータス:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  modelInfo.status === 'ready'
                    ? 'bg-green-100 text-green-800'
                    : modelInfo.status === 'needs_retraining'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {modelInfo.status === 'ready' && '✅ トレーニング済み'}
                  {modelInfo.status === 'needs_retraining' && '⚠️ 再トレーニング推奨'}
                  {modelInfo.status === 'not_trained' && '❌ 未トレーニング'}
                </span>
              </div>

              {modelStatus.metadata && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">使用期間:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatPeriodList(modelStatus.metadata.periodsUsed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">精度:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(modelStatus.metadata.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">トレーニング日時:</span>
                    <span className="text-sm text-gray-500">
                      {formatDate(modelStatus.metadata.trainedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">サンプル数:</span>
                    <span className="text-sm text-gray-500">
                      {modelStatus.metadata.trainingSamples?.toLocaleString()} サンプル
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Period Comparison */}
          {periodComparison && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">期間検出</h3>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">現在の期間:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPeriodList(periodComparison.currentPeriods)}
                  </span>
                </div>
                {periodComparison.newPeriods.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">新しい期間:</span>
                    <span className="text-sm font-medium text-yellow-700">
                      {formatPeriodList(periodComparison.newPeriods)} (未トレーニング)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Training Progress */}
          {(isTraining || trainingStarted) && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">トレーニング進行状況</h3>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                {/* Stage */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {trainingProgress.stage}
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {trainingProgress.percentage.toFixed(0)}%
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${trainingProgress.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Details */}
                {trainingProgress.totalEpochs > 0 && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">エポック:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {trainingProgress.currentEpoch} / {trainingProgress.totalEpochs}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">残り時間:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {formatTimeRemaining(trainingProgress.estimatedTimeRemaining)}
                      </span>
                    </div>
                    {trainingProgress.loss > 0 && (
                      <>
                        <div>
                          <span className="text-gray-600">損失:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {trainingProgress.loss.toFixed(4)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">精度:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {(trainingProgress.accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {modelStatus.error && (
            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  ❌ エラー: {modelStatus.error}
                </p>
              </div>
            </div>
          )}

          {/* Advanced Details Toggle */}
          {modelStatus.metadata && (
            <div className="mb-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showDetails ? '詳細を隠す ▲' : '詳細を表示 ▼'}
              </button>

              {showDetails && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-600">モデルバージョン:</span>
                      <div className="font-medium">{modelStatus.metadata.version}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">トレーニング時間:</span>
                      <div className="font-medium">
                        {(modelStatus.metadata.trainingTime / 1000 / 60).toFixed(1)}分
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">スタッフ数:</span>
                      <div className="font-medium">{modelStatus.metadata.staffCount}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">検証サンプル:</span>
                      <div className="font-medium">
                        {modelStatus.metadata.validationSamples?.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Phase 2 (パターン記憶):</span>
                      <div className="font-medium">
                        {modelStatus.metadata.phase2Enabled ? '✅ 有効' : '❌ 無効'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Phase 3 (適応AI):</span>
                      <div className="font-medium">
                        {modelStatus.metadata.phase3Enabled ? '✅ 有効' : '❌ 無効'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isTraining}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              閉じる
            </button>

            <div className="flex gap-2">
              {isTraining && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  キャンセル
                </button>
              )}

              {!isTraining && (
                <button
                  onClick={handleStartTraining}
                  disabled={trainingStarted}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {needsRetraining ? '🔄 再トレーニング開始' : '🚀 トレーニング開始'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
