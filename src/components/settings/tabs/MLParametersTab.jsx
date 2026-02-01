/**
 * MLParametersTab.jsx (OR-Tools Version)
 *
 * Configuration for OR-Tools constraint solver
 * Replaces legacy TensorFlow ML parameters
 */

import React, { useState } from "react";
import { Settings2, Zap, Scale, Target } from "lucide-react";
import { useSettings } from "../../../contexts/SettingsContext";
import FormField from "../shared/FormField";
import NumberInput from "../shared/NumberInput";
import ToggleSwitch from "../shared/ToggleSwitch";

// OR-Tools quality presets
const ORTOOLS_PRESETS = [
  {
    id: "fast",
    name: "高速モード",
    description: "素早く実行可能な解を見つけます",
    icon: <Zap className="w-6 h-6" />,
    color: "orange",
    config: {
      timeout: 10,
      numWorkers: 2,
      preset: "fast",
    },
  },
  {
    id: "balanced",
    name: "バランス",
    description: "速度と品質のバランスを取ります（推奨）",
    icon: <Scale className="w-6 h-6" />,
    color: "blue",
    config: {
      timeout: 30,
      numWorkers: 4,
      preset: "balanced",
    },
  },
  {
    id: "optimal",
    name: "最適化優先",
    description: "時間をかけて最適解を探します",
    icon: <Target className="w-6 h-6" />,
    color: "green",
    config: {
      timeout: 60,
      numWorkers: 4,
      preset: "optimal",
    },
  },
];

const MLParametersTab = () => {
  const { settings, updateSettings, isSaving } = useSettings();
  const [selectedPreset, setSelectedPreset] = useState(
    settings?.ortoolsConfig?.preset || "balanced"
  );

  const currentConfig = settings?.ortoolsConfig || {
    timeout: 30,
    numWorkers: 4,
    preset: "balanced",
    penaltyWeights: {
      staffGroup: 100,
      dailyLimitMin: 50,
      dailyLimitMax: 50,
      monthlyLimit: 80,
      adjacentConflict: 30,
      fiveDayRest: 200,
    },
  };

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.id);
    updateSettings({
      ortoolsConfig: {
        ...currentConfig,
        ...preset.config,
      },
    });
  };

  const handleConfigChange = (key, value) => {
    updateSettings({
      ortoolsConfig: {
        ...currentConfig,
        [key]: value,
      },
    });
  };

  const handlePenaltyChange = (key, value) => {
    updateSettings({
      ortoolsConfig: {
        ...currentConfig,
        penaltyWeights: {
          ...currentConfig.penaltyWeights,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Settings2 className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-semibold">OR-Tools 最適化設定</h2>
          <p className="text-sm text-gray-500">
            Google OR-Tools CP-SAT ソルバーの設定
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          OR-Tools は Google が開発した制約プログラミングソルバーです。
          機械学習と異なり、トレーニングは不要で、常に数学的に最適な解を探索します。
        </p>
      </div>

      {/* Presets */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4">最適化モード</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ORTOOLS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              disabled={isSaving}
              className={`p-4 text-left rounded-lg border-2 transition-all ${
                selectedPreset === preset.id
                  ? `border-${preset.color}-500 bg-${preset.color}-50`
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-${preset.color}-600`}>{preset.icon}</span>
                <span className="font-medium">{preset.name}</span>
                {selectedPreset === preset.id && (
                  <span className="ml-auto text-green-600">✓</span>
                )}
              </div>
              <p className="text-sm text-gray-600">{preset.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                タイムアウト: {preset.config.timeout}秒
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Solver Settings */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4">ソルバー設定</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="タイムアウト（秒）" hint="最大探索時間">
            <NumberInput
              value={currentConfig.timeout}
              onChange={(v) => handleConfigChange("timeout", v)}
              min={5}
              max={120}
              disabled={isSaving}
            />
          </FormField>

          <FormField label="ワーカー数" hint="並列処理スレッド数">
            <NumberInput
              value={currentConfig.numWorkers}
              onChange={(v) => handleConfigChange("numWorkers", v)}
              min={1}
              max={8}
              disabled={isSaving}
            />
          </FormField>
        </div>
      </div>

      {/* Penalty Weights */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-2">制約ペナルティ重み</h3>
        <p className="text-sm text-gray-500 mb-4">
          ソフト制約違反時のペナルティ値（大きいほど厳しい）
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="スタッフグループ" hint="グループ内の重複休み">
            <NumberInput
              value={currentConfig.penaltyWeights?.staffGroup || 100}
              onChange={(v) => handlePenaltyChange("staffGroup", v)}
              min={0}
              max={1000}
              disabled={isSaving}
            />
          </FormField>

          <FormField label="日次下限" hint="1日の最小休み人数">
            <NumberInput
              value={currentConfig.penaltyWeights?.dailyLimitMin || 50}
              onChange={(v) => handlePenaltyChange("dailyLimitMin", v)}
              min={0}
              max={1000}
              disabled={isSaving}
            />
          </FormField>

          <FormField label="日次上限" hint="1日の最大休み人数">
            <NumberInput
              value={currentConfig.penaltyWeights?.dailyLimitMax || 50}
              onChange={(v) => handlePenaltyChange("dailyLimitMax", v)}
              min={0}
              max={1000}
              disabled={isSaving}
            />
          </FormField>

          <FormField label="月間制限" hint="月間休み日数">
            <NumberInput
              value={currentConfig.penaltyWeights?.monthlyLimit || 80}
              onChange={(v) => handlePenaltyChange("monthlyLimit", v)}
              min={0}
              max={1000}
              disabled={isSaving}
            />
          </FormField>

          <FormField label="連続シフト" hint="連続勤務パターン">
            <NumberInput
              value={currentConfig.penaltyWeights?.adjacentConflict || 30}
              onChange={(v) => handlePenaltyChange("adjacentConflict", v)}
              min={0}
              max={1000}
              disabled={isSaving}
            />
          </FormField>

          <FormField label="5日休息" hint="5日連続勤務制限">
            <NumberInput
              value={currentConfig.penaltyWeights?.fiveDayRest || 200}
              onChange={(v) => handlePenaltyChange("fiveDayRest", v)}
              min={0}
              max={1000}
              disabled={isSaving}
            />
          </FormField>
        </div>
      </div>

      {/* Status */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-medium text-green-800">OR-Tools 準備完了</p>
          <p className="text-sm text-green-600">
            スケジュール生成時に自動的に最適化が実行されます
          </p>
        </div>
      </div>
    </div>
  );
};

export default MLParametersTab;
