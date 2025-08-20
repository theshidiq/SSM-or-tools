import React, { useState, useMemo } from "react";
import {
  Brain,
  Sparkles,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Settings2,
  Users,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import FormField from "../shared/FormField";
import Slider from "../shared/Slider";
import NumberInput from "../shared/NumberInput";
import ToggleSwitch from "../shared/ToggleSwitch";

// Quality presets with optimized parameters
const QUALITY_PRESETS = [
  {
    id: "quick",
    name: "Quick Draft",
    shortName: "Quick",
    description: "Get a good schedule quickly for initial planning",
    icon: "⚡",
    color: "orange",
    estimatedTime: "1-2 minutes",
    accuracy: "Good (80%)",
    benefits: [
      "Fastest generation time",
      "Good for initial drafts",
      "Quick iteration cycles",
    ],
    config: {
      algorithm: "genetic_algorithm",
      populationSize: 50,
      generations: 150,
      mutationRate: 0.15,
      crossoverRate: 0.7,
      elitismRate: 0.15,
      convergenceThreshold: 0.005,
      confidenceThreshold: 0.65,
      maxRuntime: 120,
      enableAdaptiveMutation: true,
      enableElitismDiversity: false,
      parallelProcessing: true,
      randomSeed: null,
    },
  },
  {
    id: "balanced",
    name: "Balanced",
    shortName: "Balanced",
    description: "Optimal balance of quality and speed for daily use",
    icon: "⚖️",
    color: "blue",
    estimatedTime: "3-5 minutes",
    accuracy: "Very Good (90%)",
    benefits: [
      "Best overall choice",
      "Handles complex constraints well",
      "Reliable results",
    ],
    config: {
      algorithm: "genetic_algorithm",
      populationSize: 100,
      generations: 300,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      elitismRate: 0.1,
      convergenceThreshold: 0.001,
      confidenceThreshold: 0.75,
      maxRuntime: 300,
      enableAdaptiveMutation: true,
      enableElitismDiversity: false,
      parallelProcessing: true,
      randomSeed: null,
    },
  },
  {
    id: "best",
    name: "Best Results",
    shortName: "Best",
    description: "Maximum quality optimization for final schedules",
    icon: "🎯",
    color: "green",
    estimatedTime: "8-12 minutes",
    accuracy: "Excellent (95%+)",
    benefits: [
      "Highest quality results",
      "Finds optimal solutions",
      "Best constraint satisfaction",
    ],
    config: {
      algorithm: "genetic_algorithm",
      populationSize: 200,
      generations: 500,
      mutationRate: 0.05,
      crossoverRate: 0.85,
      elitismRate: 0.05,
      convergenceThreshold: 0.0001,
      confidenceThreshold: 0.85,
      maxRuntime: 720,
      enableAdaptiveMutation: true,
      enableElitismDiversity: true,
      parallelProcessing: true,
      randomSeed: null,
    },
  },
];

const MLParametersTab = ({
  settings,
  onSettingsChange,
  validationErrors = {},
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const mlConfig = settings?.mlParameters || QUALITY_PRESETS[1].config;

  // Determine current preset
  const currentPreset = useMemo(() => {
    return QUALITY_PRESETS.find((preset) =>
      Object.keys(preset.config).every(
        (key) => preset.config[key] === mlConfig[key],
      ),
    );
  }, [mlConfig]);

  const updateMLConfig = (updates) => {
    onSettingsChange({
      ...settings,
      mlParameters: { ...mlConfig, ...updates },
    });
  };

  const applyPreset = (preset) => {
    updateMLConfig(preset.config);
  };

  // Get integration status from other settings
  const staffGroupsCount = settings?.staffGroups?.length || 0;
  const dailyLimitsCount = settings?.dailyLimits?.length || 0;
  const priorityRulesCount = settings?.priorityRules?.length || 0;

  const renderHeroSection = () => (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
          <Brain size={32} />
        </div>
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-3">AI Schedule Optimization</h2>
          <p className="text-blue-100 mb-4 text-lg">
            Let AI create optimal schedules by balancing staff preferences,
            business needs, and fairness automatically.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={20} className="text-yellow-300" />
                <span className="font-semibold">Smart Balancing</span>
              </div>
              <p className="text-sm text-blue-100">
                Automatically balances workload distribution and staff
                preferences
              </p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={20} className="text-green-300" />
                <span className="font-semibold">Learns Patterns</span>
              </div>
              <p className="text-sm text-blue-100">
                Adapts to your restaurant's unique scheduling patterns and
                constraints
              </p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={20} className="text-orange-300" />
                <span className="font-semibold">Saves Time</span>
              </div>
              <p className="text-sm text-blue-100">
                Reduces manual scheduling from hours to minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQualityPresets = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        Choose Optimization Quality
      </h3>
      <p className="text-gray-600 mb-6">
        Select the level of optimization that best fits your needs. Higher
        quality takes more time but produces better results.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {QUALITY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className={`relative p-6 text-left border-2 rounded-xl transition-all hover:shadow-lg group ${
              currentPreset?.id === preset.id
                ? `border-${preset.color}-400 bg-${preset.color}-50 shadow-md`
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {currentPreset?.id === preset.id && (
              <div
                className={`absolute -top-2 -right-2 w-6 h-6 bg-${preset.color}-500 text-white rounded-full flex items-center justify-center`}
              >
                <span className="text-xs font-bold">✓</span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{preset.icon}</span>
              <div>
                <h4 className="text-lg font-bold text-gray-800">
                  {preset.name}
                </h4>
                <p className="text-sm text-gray-600">{preset.estimatedTime}</p>
              </div>
            </div>

            <p className="text-gray-700 mb-4">{preset.description}</p>

            <div className="space-y-2 mb-4">
              <div className={`text-sm font-medium text-${preset.color}-600`}>
                {preset.accuracy}
              </div>
              <ul className="space-y-1">
                {preset.benefits.map((benefit, index) => (
                  <li
                    key={index}
                    className="text-xs text-gray-600 flex items-center gap-1"
                  >
                    <span className="text-green-500">•</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Estimated time for 20 staff members
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderResultsPreview = () => {
    if (!currentPreset) return null;

    const metrics = {
      fairnessScore:
        currentPreset.id === "best"
          ? 95
          : currentPreset.id === "balanced"
            ? 88
            : 82,
      constraintSatisfaction:
        currentPreset.id === "best"
          ? 98
          : currentPreset.id === "balanced"
            ? 92
            : 85,
      preferenceMatch:
        currentPreset.id === "best"
          ? 87
          : currentPreset.id === "balanced"
            ? 79
            : 71,
    };

    return (
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 mb-8 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Expected Results with {currentPreset.name}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp size={24} className="text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-1">
              {metrics.fairnessScore}%
            </div>
            <div className="text-sm text-gray-600 mb-2">Fairness Score</div>
            <div className="text-xs text-gray-500">
              Equal distribution of shifts and days off
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Settings2 size={24} className="text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-1">
              {metrics.constraintSatisfaction}%
            </div>
            <div className="text-sm text-gray-600 mb-2">Constraint Match</div>
            <div className="text-xs text-gray-500">
              Business rules and limits satisfied
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={24} className="text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-1">
              {metrics.preferenceMatch}%
            </div>
            <div className="text-sm text-gray-600 mb-2">Staff Satisfaction</div>
            <div className="text-xs text-gray-500">
              Individual preferences honored
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderIntegrationStatus = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Configuration Integration
      </h3>
      <p className="text-gray-600 mb-4">
        AI optimization works best when integrated with your other settings:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-lg border-2 ${staffGroupsCount > 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users
              size={20}
              className={
                staffGroupsCount > 0 ? "text-green-600" : "text-yellow-600"
              }
            />
            <span className="font-medium">Staff Groups</span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {staffGroupsCount > 0
              ? `${staffGroupsCount} groups configured`
              : "Not configured"}
          </div>
          <div className="text-xs text-gray-500">
            {staffGroupsCount > 0
              ? "Ensures proper coverage and skill matching"
              : "Set up groups to improve coverage optimization"}
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border-2 ${dailyLimitsCount > 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays
              size={20}
              className={
                dailyLimitsCount > 0 ? "text-green-600" : "text-yellow-600"
              }
            />
            <span className="font-medium">Daily Limits</span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {dailyLimitsCount > 0
              ? `${dailyLimitsCount} limits active`
              : "Not configured"}
          </div>
          <div className="text-xs text-gray-500">
            {dailyLimitsCount > 0
              ? "Controls workload and prevents overwork"
              : "Set limits to ensure fair workload distribution"}
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border-2 ${priorityRulesCount > 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp
              size={20}
              className={
                priorityRulesCount > 0 ? "text-green-600" : "text-yellow-600"
              }
            />
            <span className="font-medium">Priority Rules</span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {priorityRulesCount > 0
              ? `${priorityRulesCount} rules active`
              : "Not configured"}
          </div>
          <div className="text-xs text-gray-500">
            {priorityRulesCount > 0
              ? "Honors individual staff preferences"
              : "Add rules to respect staff preferences and needs"}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvancedOptions = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-4 w-full text-left"
      >
        {showAdvanced ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        <span className="text-lg font-semibold">Advanced Options</span>
        <span className="text-sm text-gray-500 ml-2">
          (For power users who want fine control)
        </span>
      </button>

      {showAdvanced && (
        <div className="space-y-6 pt-4 border-t border-gray-200">
          {/* Warning for advanced users */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-amber-600" />
              <span className="font-medium text-amber-800">
                Advanced Configuration
              </span>
            </div>
            <p className="text-sm text-amber-700">
              Modifying these parameters may affect optimization quality. The
              quality presets above are recommended for most users.
            </p>
          </div>

          {/* Confidence Threshold */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800">
              AI Confidence Settings
            </h4>
            <Slider
              label="Auto-Apply Threshold"
              value={mlConfig.confidenceThreshold}
              min={0.5}
              max={0.95}
              step={0.05}
              onChange={(value) =>
                updateMLConfig({ confidenceThreshold: value })
              }
              description="How confident AI must be to automatically apply suggestions"
              unit="%"
              showValue={true}
              colorScheme="blue"
            />

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-2 bg-red-50 rounded">
                <div className="font-semibold text-red-600">50-65%</div>
                <div className="text-red-700">Always ask</div>
              </div>
              <div className="p-2 bg-yellow-50 rounded">
                <div className="font-semibold text-yellow-600">70-80%</div>
                <div className="text-yellow-700">Sometimes auto-apply</div>
              </div>
              <div className="p-2 bg-green-50 rounded">
                <div className="font-semibold text-green-600">85-95%</div>
                <div className="text-green-700">Usually auto-apply</div>
              </div>
            </div>
          </div>

          {/* Runtime Limits */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800">Performance Limits</h4>
            <NumberInput
              label="Maximum Runtime"
              value={mlConfig.maxRuntime}
              min={30}
              max={1800}
              step={30}
              onChange={(value) => updateMLConfig({ maxRuntime: value })}
              description="Stop optimization after this many seconds"
              unit="seconds"
              error={validationErrors.maxRuntime}
            />
          </div>

          {/* Advanced Toggles */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800">Algorithm Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleSwitch
                label="Adaptive Learning"
                description="Adjust algorithm parameters during optimization"
                checked={mlConfig.enableAdaptiveMutation}
                onChange={(checked) =>
                  updateMLConfig({ enableAdaptiveMutation: checked })
                }
              />

              <ToggleSwitch
                label="Multi-Core Processing"
                description="Use multiple CPU cores for faster optimization"
                checked={mlConfig.parallelProcessing}
                onChange={(checked) =>
                  updateMLConfig({ parallelProcessing: checked })
                }
              />

              <ToggleSwitch
                label="Solution Diversity"
                description="Maintain variety in high-quality solutions"
                checked={mlConfig.enableElitismDiversity}
                onChange={(checked) =>
                  updateMLConfig({ enableElitismDiversity: checked })
                }
              />
            </div>
          </div>

          {/* Technical Parameters */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800">Algorithm Parameters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberInput
                label="Population Size"
                value={mlConfig.populationSize}
                min={20}
                max={500}
                step={10}
                onChange={(value) => updateMLConfig({ populationSize: value })}
                description="Number of candidate solutions per generation"
                error={validationErrors.populationSize}
              />

              <NumberInput
                label="Generations"
                value={mlConfig.generations}
                min={50}
                max={1000}
                step={50}
                onChange={(value) => updateMLConfig({ generations: value })}
                description="Maximum evolution iterations"
                error={validationErrors.generations}
              />

              <Slider
                label="Mutation Rate"
                value={mlConfig.mutationRate}
                min={0.01}
                max={0.5}
                step={0.01}
                onChange={(value) => updateMLConfig({ mutationRate: value })}
                description="Probability of random solution changes"
                colorScheme="purple"
                error={validationErrors.mutationRate}
              />

              <Slider
                label="Crossover Rate"
                value={mlConfig.crossoverRate}
                min={0.3}
                max={1.0}
                step={0.05}
                onChange={(value) => updateMLConfig({ crossoverRate: value })}
                description="Probability of combining parent solutions"
                colorScheme="blue"
                error={validationErrors.crossoverRate}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      {/* Hero Section */}
      {renderHeroSection()}

      {/* Quality Presets */}
      {renderQualityPresets()}

      {/* Results Preview */}
      {renderResultsPreview()}

      {/* Integration Status */}
      {renderIntegrationStatus()}

      {/* Advanced Options */}
      {renderAdvancedOptions()}

      {/* Error Messages */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-red-600" />
            <span className="font-medium text-red-800">
              Configuration Issues
            </span>
          </div>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {Object.entries(validationErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MLParametersTab;
