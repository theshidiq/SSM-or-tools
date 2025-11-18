/**
 * AIAssistantModal.jsx
 *
 * Simple AI Assistant modal that integrates with the sparkle button
 * without changing any existing UI/UX or features.
 */

import React, { useState, useEffect } from "react";
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
  Database,
} from "lucide-react";
import { useAISettings } from "../../hooks/useAISettings";

// ShadCN UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const AIAssistantModal = ({
  isOpen,
  onClose,
  onAutoFillSchedule, // generateAIPredictions with save logic
  scheduleData, // Schedule data for AI generation
  staffMembers, // Staff members array
  currentMonthIndex, // Current month index
  saveSchedule, // Save schedule function
  isProcessing,
  systemStatus, // New prop for system status
}) => {
  const [results, setResults] = useState(null);
  const [trainingProgress, setTrainingProgress] = useState(null);
  const [progressStage, setProgressStage] = useState("idle");

  // Get AI settings for live status
  const aiSettings = useAISettings();

  // Debug: Monitor trainingProgress state changes
  useEffect(() => {
    console.log(`🔄 [REACT-STATE] trainingProgress changed:`, trainingProgress);
  }, [trainingProgress]);

  // Debug: Monitor isOpen changes
  useEffect(() => {
    console.log(`🚪 [MODAL] isOpen changed: ${isOpen}`);
    if (!isOpen) {
      console.log(`🧹 [MODAL] Cleaning up state (modal closed)`);
      setResults(null);
      setTrainingProgress(null);
      setProgressStage("idle");
    }
  }, [isOpen]);

  const [isProcessingInternal, setIsProcessingInternal] = useState(false);

  const handleAutoFillSchedule = async () => {
    console.log("🎯 [DEBUG] AI Button clicked");
    console.log(`🔍 [DEBUG] Props received - onAutoFillSchedule: ${typeof onAutoFillSchedule}`);
    console.log(`🔍 [DEBUG] isProcessing prop: ${isProcessing}, isProcessingInternal: ${isProcessingInternal}`);
    setIsProcessingInternal(true);
    setProgressStage("starting");
    console.log(`📝 [SET-STATE] Setting trainingProgress to 0% (initialization)`);
    setTrainingProgress({ progress: 0, message: "AIシステム初期化中..." });

    try {
      let result;

      // ✅ Always use onAutoFillSchedule (which is generateAIPredictions with save logic)
      console.log("✅ Using generateAIPredictions path (with save logic)");
      result = await onAutoFillSchedule((progress) => {
        console.log(`🎨 [UI-PROGRESS] AIAssistantModal received:`, progress);
        console.log(`📝 [SET-STATE] Setting trainingProgress to ${progress.progress}%`);
        setProgressStage(progress.stage || "processing");
        setTrainingProgress(progress);
        console.log(`✅ [SET-STATE] setTrainingProgress called`);
      });

      console.log("🎯 [DEBUG] AI generation completed with result:", result);
      setResults(result);
      setProgressStage("completed");
    } catch (error) {
      console.error("❌ AI generation failed:", error);
      setResults({ success: false, error: error.message });
      setProgressStage("error");
    } finally {
      setIsProcessingInternal(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px] max-h-[600px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-violet-600">
            <Sparkles size={20} className="text-yellow-500" />
            AI アシスタント
          </DialogTitle>
          <DialogDescription>
            スケジュールの自動生成とAI最適化
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[500px] overflow-y-auto space-y-4">
          {/* Settings Status */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Database size={16} className={aiSettings.isConnected ? "text-green-600" : "text-gray-400"} />
                <span className="text-sm font-medium">
                  Settings: {aiSettings.isConnected ? (
                    <Badge variant="default" className="bg-green-600">
                      {aiSettings.backendMode === "websocket-multitable" ? "Live (WebSocket)" : "Local Storage"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Loading...</Badge>
                  )}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span>Staff Groups:</span>
                  <Badge variant="secondary">{aiSettings.staffGroups?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Daily Limits:</span>
                  <Badge variant="secondary">{aiSettings.dailyLimits?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Weekly Limits:</span>
                  <Badge variant="secondary">{aiSettings.weeklyLimits?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Priority Rules:</span>
                  <Badge variant="secondary">{aiSettings.priorityRules?.length || 0}</Badge>
                </div>
                {aiSettings.hasSettings && (
                  <div className="mt-2 pt-2 border-t flex items-center gap-1 text-green-600">
                    <CheckCircle size={12} />
                    <span>Business rules configured</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Status Display */}
          {systemStatus && systemStatus.type === "enhanced" && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={16} className="text-primary" />
                  <Badge variant="secondary">
                    ハイブリッドAIシステム (
                    {systemStatus.initialized ? "初期化済み" : "初期化中"})
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  MLモデル:{" "}
                  <Badge
                    variant={
                      systemStatus.health?.mlModel?.ready
                        ? "default"
                        : "outline"
                    }
                  >
                    {systemStatus.health?.mlModel?.ready
                      ? "準備完了"
                      : "トレーニング必要"}
                  </Badge>
                  {systemStatus.health?.mlModel?.accuracy > 0 && (
                    <span>
                      {" "}
                      (精度:{" "}
                      {(systemStatus.health.mlModel.accuracy * 100).toFixed(1)}
                      %)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Training Progress */}
          {(isProcessing || isProcessingInternal) && trainingProgress && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-yellow-600 animate-pulse" />
                <span className="text-sm font-medium text-yellow-900">
                  {trainingProgress.message || "AI処理中..."}
                </span>
              </div>
              <div className="w-full bg-yellow-200 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${trainingProgress.progress || 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-yellow-700 mt-1">
                {trainingProgress.progress || 0}% 完了
              </div>
            </div>
          )}

          <div className="text-center">
            <Sparkles size={32} className="text-violet-600 mx-auto mb-2" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              AI スケジュール自動入力
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              ハイブリッドAIが機械学習とビジネスルールで最適なシフトを予測します
            </p>
            <button
              onClick={handleAutoFillSchedule}
              disabled={isProcessing || isProcessingInternal}
              className="bg-violet-600 text-white px-6 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto"
            >
              <Sparkles
                size={16}
                className={isProcessing || isProcessingInternal ? "animate-spin" : ""}
              />
              {isProcessing || isProcessingInternal ? "AI処理中..." : "AI 自動入力を実行"}
            </button>
          </div>

          {results && (
            <div className="mt-6 space-y-4">
              <div
                className={`border rounded-lg p-4 ${
                  results.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle
                    size={16}
                    className={
                      results.success ? "text-green-600" : "text-red-600"
                    }
                  />
                  <span
                    className={`font-medium ${results.success ? "text-green-900" : "text-red-900"}`}
                  >
                    {results.success ? "自動入力完了" : "エラー"}
                  </span>
                </div>
                <p
                  className={`text-sm ${results.success ? "text-green-800" : "text-red-800"}`}
                >
                  {results.message}
                </p>
              </div>

              {results.success && results.data && (
                <div className="space-y-3">
                  {/* Main Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <Target size={12} />
                        入力されたセル数
                      </div>
                      <div className="text-2xl font-bold text-violet-600">
                        {results.data.filledCells || 0}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <TrendingUp size={12} />
                        予測精度
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {results.data.accuracy || 0}%
                      </div>
                    </div>
                  </div>

                  {/* ML System Details */}
                  {results.data.mlUsed && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-1">
                        <Brain size={14} />
                        機械学習情報
                      </div>
                      <div className="space-y-1 text-xs text-blue-800">
                        <div>
                          モデル精度: {results.data.modelAccuracy || 0}%
                        </div>
                        <div>
                          予測手法: {results.data.hybridMethod || "hybrid"}
                        </div>
                        <div>
                          ルール適用:{" "}
                          {results.data.rulesApplied ? "あり" : "なし"}
                        </div>
                        {results.data.processingTime && (
                          <div className="flex items-center gap-1">
                            <Clock size={10} />
                            処理時間: {results.data.processingTime}ms
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  {systemStatus?.health?.mlModel && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                        <BarChart3 size={14} />
                        パフォーマンス
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                        <div>
                          メモリ使用量:{" "}
                          {Math.round(
                            (systemStatus.health.mlModel.memoryUsage?.total ||
                              0) /
                              1024 /
                              1024,
                          )}
                          MB
                        </div>
                        <div>
                          テンソル数:{" "}
                          {systemStatus.health.mlModel.memoryUsage
                            ?.numTensors || 0}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Information */}
                  {results.error && results.canRetry && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-orange-900 mb-1">
                        エラー情報
                      </div>
                      <div className="text-xs text-orange-800 mb-2">
                        {results.error.error}
                      </div>
                      {results.recommendedAction && (
                        <div className="text-xs text-orange-700">
                          推奨アクション: {results.recommendedAction}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Violations and Corrections */}
                  {results.data.violations &&
                    results.data.violations.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div className="text-sm font-medium text-orange-900 mb-2">
                          ルール違反と修正: {results.data.violations.length}件
                        </div>
                        <div className="text-xs text-orange-800">
                          AIが自動で修正し、ビジネスルールに適合したスケジュールを生成しました。
                        </div>
                      </div>
                    )}

                  {results.data.patterns &&
                    results.data.patterns.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                          <Lightbulb size={16} className="text-yellow-500" />
                          学習されたパターン
                        </div>
                        <div className="space-y-2">
                          {results.data.patterns
                            .slice(0, 3)
                            .map((pattern, index) => (
                              <div
                                key={index}
                                className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                              >
                                <div className="text-sm text-blue-900">
                                  {pattern.description}
                                </div>
                                <div className="text-xs text-blue-600 mt-1">
                                  信頼度: {pattern.confidence}%
                                </div>
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

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            ハイブリッドAIアシスタント - TensorFlow + ビジネスルール v3.0
          </div>
          {systemStatus?.type === "enhanced" &&
            systemStatus?.health?.mlModel && (
              <div className="text-xs text-gray-400 text-center mt-1">
                MLモデル: {systemStatus.health.mlModel.parameters}パラメータ,
                メモリ使用量:{" "}
                {Math.round(
                  (systemStatus.health.mlModel.memoryUsage?.total || 0) /
                    1024 /
                    1024,
                )}
                MB
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAssistantModal;
