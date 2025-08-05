/**
 * AIAssistantModal.jsx
 * 
 * Simple AI Assistant modal that integrates with the sparkle button
 * without changing any existing UI/UX or features.
 */

import React, { useState, useEffect } from 'react';
import { X, Sparkles, TrendingUp, BarChart3, Lightbulb, CheckCircle } from 'lucide-react';

const AIAssistantModal = ({ 
  isOpen, 
  onClose, 
  onAutoFillSchedule, 
  isProcessing 
}) => {
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setResults(null);
    }
  }, [isOpen]);

  const handleAutoFillSchedule = async () => {
    const result = await onAutoFillSchedule();
    setResults(result);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-yellow-300" />
            <h2 className="text-lg font-medium">AI アシスタント</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Header divider */}
        <div className="border-b border-gray-200"></div>

        {/* Content */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-4">
            <div className="text-center">
              <Sparkles size={32} className="text-violet-600 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                AI スケジュール自動入力
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                AIが既存のパターンを学習し、空のセルに適切なシフトを自動入力します
              </p>
              <button
                onClick={handleAutoFillSchedule}
                disabled={isProcessing}
                className="bg-violet-600 text-white px-6 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto"
              >
                <Sparkles size={16} />
                {isProcessing ? '自動入力中...' : 'AI 自動入力を実行'}
              </button>
            </div>

            {results && (
              <div className="mt-6 space-y-4">
                <div className={`border rounded-lg p-4 ${
                  results.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={16} className={results.success ? 'text-green-600' : 'text-red-600'} />
                    <span className={`font-medium ${results.success ? 'text-green-900' : 'text-red-900'}`}>
                      {results.success ? '自動入力完了' : 'エラー'}
                    </span>
                  </div>
                  <p className={`text-sm ${results.success ? 'text-green-800' : 'text-red-800'}`}>
                    {results.message}
                  </p>
                </div>

                {results.success && results.data && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 mb-1">入力されたセル数</div>
                      <div className="text-2xl font-bold text-violet-600">
                        {results.data.filledCells || 0}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 mb-1">学習データ精度</div>
                      <div className="text-2xl font-bold text-green-600">
                        {results.data.accuracy?.toFixed(1) || '0.0'}%
                      </div>
                    </div>

                    {results.data.patterns && results.data.patterns.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                          <Lightbulb size={16} className="text-yellow-500" />
                          学習されたパターン
                        </div>
                        <div className="space-y-2">
                          {results.data.patterns.slice(0, 3).map((pattern, index) => (
                            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="text-sm text-blue-900">{pattern.description}</div>
                              <div className="text-xs text-blue-600 mt-1">信頼度: {pattern.confidence}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            AI アシスタント - スケジュール自動入力システム v2.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantModal;