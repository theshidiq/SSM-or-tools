/**
 * Schedule Import Modal
 *
 * User interface for importing HTML schedule files with:
 * - File upload/paste
 * - Staff name mapping for unmatched names
 * - Validation results preview
 * - Conflict resolution
 * - Import execution
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
  FileText,
  Users,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useScheduleImport } from '../../hooks/useScheduleImport';
import { getValidationSummary } from '../../utils/scheduleValidator';

const ScheduleImportModal = ({
  isOpen,
  onClose,
  targetPeriodIndex,
  targetPeriod,
  onImportSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [manualMappings, setManualMappings] = useState({});
  const [currentStep, setCurrentStep] = useState(0); // 0: upload, 1: mapping, 2: validation, 3: confirm
  const fileInputRef = useRef(null);

  const {
    importState,
    progress,
    error,
    isLoading,
    isReady,
    isSuccess,
    needsManualMapping,
    parsedData,
    matchResults,
    validationResults,
    parseHTMLStep,
    matchStaffStep,
    applyManualMappingsStep,
    validateStep,
    executeImport,
    reset,
    IMPORT_STATES
  } = useScheduleImport(targetPeriodIndex, targetPeriod);

  // Handle file selection
  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setCurrentStep(0);

    try {
      const parsed = await parseHTMLStep(file);

      // Automatically proceed to matching
      if (parsed) {
        // Use a small delay to ensure state is updated
        setTimeout(() => {
          setCurrentStep(1);
        }, 100);
      }
    } catch (err) {
      console.error('File parse error:', err);
    }
  }, [parseHTMLStep]);

  // Handle manual mapping changes
  const handleMappingChange = useCallback((htmlName, staffId) => {
    setManualMappings(prev => ({
      ...prev,
      [htmlName]: staffId
    }));
  }, []);

  // Apply manual mappings and proceed
  const handleApplyMappings = useCallback(() => {
    try {
      applyManualMappingsStep(manualMappings);

      // Check if all are mapped now
      if (importState !== IMPORT_STATES.PENDING_MANUAL_MAPPING) {
        // Proceed to validation
        validateStep();
        setCurrentStep(2);
      }
    } catch (err) {
      console.error('Mapping error:', err);
    }
  }, [manualMappings, applyManualMappingsStep, validateStep, importState, IMPORT_STATES]);

  // Skip manual mapping (for already matched)
  const handleSkipMapping = useCallback(() => {
    validateStep();
    setCurrentStep(2);
  }, [validateStep]);

  // Execute final import
  const handleConfirmImport = useCallback(async () => {
    try {
      await executeImport(true); // Override conflicts
      setCurrentStep(3);

      // Auto-close and notify parent after success
      setTimeout(() => {
        onImportSuccess?.();
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Import error:', err);
    }
  }, [executeImport, onImportSuccess]);

  // Reset and close
  const handleClose = useCallback(() => {
    reset();
    setSelectedFile(null);
    setManualMappings({});
    setCurrentStep(0);
    onClose();
  }, [reset, onClose]);

  // Trigger file input
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Auto-trigger matching when moving to step 1
  useEffect(() => {
    if (currentStep === 1 && parsedData && !matchResults) {
      console.log('🔄 Auto-triggering staff matching...');
      matchStaffStep(parsedData);
    }
  }, [currentStep, parsedData, matchResults, matchStaffStep]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            HTMLスケジュールインポート
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            disabled={isLoading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span className={currentStep >= 0 ? 'font-semibold' : ''}>ファイル選択</span>
            <span className={currentStep >= 1 ? 'font-semibold' : ''}>スタッフマッピング</span>
            <span className={currentStep >= 2 ? 'font-semibold' : ''}>検証</span>
            <span className={currentStep >= 3 ? 'font-semibold' : ''}>完了</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: '400px' }}>
          {/* Step 0: File Upload */}
          {currentStep === 0 && (
            <div className="text-center py-8" style={{ minHeight: '300px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-blue-500 cursor-pointer transition-colors"
                onClick={handleUploadClick}
              >
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-lg text-gray-700 mb-2">
                  HTMLファイルをアップロード
                </p>
                <p className="text-sm text-gray-500">
                  クリックしてファイルを選択、またはここにドラッグ
                </p>
              </div>

              {selectedFile && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <FileText size={16} />
                  <span>{selectedFile.name}</span>
                </div>
              )}

              {error && error.step === 'parsing' && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg text-left">
                  <div className="flex items-start gap-2">
                    <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-semibold text-red-800">解析エラー</p>
                      <p className="text-sm text-red-600 mt-1">{error.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Staff Mapping */}
          {currentStep === 1 && matchResults && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  スタッフマッピング
                </h3>
                <p className="text-sm text-gray-600">
                  {matchResults.matched.length} / {matchResults.summary.total} 名のスタッフが自動マッピングされました
                </p>
              </div>

              {/* Matched staff */}
              {matchResults.matched.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <CheckCircle size={16} />
                    マッチしたスタッフ ({matchResults.matched.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {matchResults.matched.map((match, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-green-600" />
                          <span className="font-medium">{match.htmlName}</span>
                          {match.matchType === 'mapped' && (
                            <span className="text-gray-500">→ {match.mappedName}</span>
                          )}
                        </div>
                        <span className="text-xs text-green-600 px-2 py-1 bg-green-100 rounded">
                          {match.matchType === 'exact' ? '完全一致' : 'マッピング済み'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched staff */}
              {matchResults.unmatched.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    マッピングが必要 ({matchResults.unmatched.length})
                  </h4>
                  <div className="space-y-3">
                    {matchResults.unmatched.map((unmatch, index) => (
                      <div
                        key={index}
                        className="p-4 bg-orange-50 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-800">
                            {unmatch.htmlName}
                          </span>
                        </div>
                        <select
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={manualMappings[unmatch.htmlName] || ''}
                          onChange={(e) => handleMappingChange(unmatch.htmlName, e.target.value)}
                        >
                          <option value="">スタッフを選択...</option>
                          {unmatch.suggestions?.map((suggestion) => (
                            <option key={suggestion.id} value={suggestion.id}>
                              {suggestion.name} ({(suggestion.similarity * 100).toFixed(0)}% 類似)
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  キャンセル
                </button>
                <button
                  onClick={matchResults.unmatched.length > 0 ? handleApplyMappings : handleSkipMapping}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                  disabled={isLoading || (matchResults.unmatched.length > 0 && Object.keys(manualMappings).length === 0)}
                >
                  次へ
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Validation Results */}
          {currentStep === 2 && validationResults && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  検証結果
                </h3>
              </div>

              {/* Validation summary */}
              <div className="space-y-4">
                {validationResults.scheduleValidation && (
                  <div className={`p-4 rounded-lg ${
                    validationResults.scheduleValidation.isValid
                      ? 'bg-green-50'
                      : 'bg-red-50'
                  }`}>
                    <div className="flex items-start gap-2">
                      {validationResults.scheduleValidation.isValid ? (
                        <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                      ) : (
                        <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                      )}
                      <div className="flex-1">
                        <p className={`font-semibold ${
                          validationResults.scheduleValidation.isValid
                            ? 'text-green-800'
                            : 'text-red-800'
                        }`}>
                          スケジュールデータ検証
                        </p>
                        <pre className="text-xs mt-2 whitespace-pre-wrap font-mono">
                          {getValidationSummary(validationResults.scheduleValidation)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {validationResults.conflicts?.hasConflicts && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                      <div className="flex-1">
                        <p className="font-semibold text-yellow-800">競合が検出されました</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          {validationResults.conflicts.summary.totalConflicts} 件の既存データとの競合があります。
                          インポートを続行すると既存データが上書きされます。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                  disabled={isLoading || !isReady}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      インポート中...
                    </>
                  ) : (
                    <>
                      インポート実行
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {currentStep === 3 && isSuccess && (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                インポート完了！
              </h3>
              <p className="text-gray-600">
                スケジュールが正常にインポートされました
              </p>
            </div>
          )}

          {/* General error */}
          {error && currentStep !== 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-red-800">エラー</p>
                  <p className="text-sm text-red-600 mt-1">{error.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Period info footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>対象期間: {targetPeriod?.label || `期間 ${targetPeriodIndex + 1}`}</span>
            </div>
            {parsedData && (
              <>
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  <span>{parsedData.staffNames.length} 名</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText size={16} />
                  <span>{parsedData.rows.length} 日</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleImportModal;
