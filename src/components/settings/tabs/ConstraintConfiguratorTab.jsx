import React, { useState, useMemo } from "react";
import {
  Settings2,
  Sliders,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Shield,
  Users,
  Calendar,
  Sparkles,
  AlertCircle,
  Clock,
  Cpu,
  Lock,
  Unlock,
} from "lucide-react";
import { useSettings } from "../../../contexts/SettingsContext";
import Slider from "../shared/Slider";
import NumberInput from "../shared/NumberInput";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";

// Constraint presets with optimized penalty weights
const CONSTRAINT_PRESETS = [
  {
    id: "strict",
    name: "Strict Mode",
    shortName: "Strict",
    description: "High penalties, minimal violations allowed",
    icon: "🔒",
    color: "red",
    recommendedFor: "Legal compliance and critical operations",
    benefits: [
      "Maximum constraint enforcement",
      "Legal labor law compliance",
      "Minimal rule violations",
    ],
    config: {
      penaltyWeights: {
        staffGroup: 200,
        dailyLimitMin: 100,
        dailyLimitMax: 100,
        monthlyLimit: 150,
        adjacentConflict: 60,
        fiveDayRest: 300,
      },
      solverSettings: {
        timeout: 60,
        numWorkers: 4,
      },
    },
  },
  {
    id: "balanced",
    name: "Balanced Mode",
    shortName: "Balanced",
    description: "Medium penalties, allows reasonable trade-offs",
    icon: "⚖️",
    color: "blue",
    recommendedFor: "Daily use with good quality-performance balance",
    benefits: [
      "Best overall choice",
      "Balances all constraints well",
      "Reliable solutions",
    ],
    config: {
      penaltyWeights: {
        staffGroup: 100,
        dailyLimitMin: 50,
        dailyLimitMax: 50,
        monthlyLimit: 80,
        adjacentConflict: 30,
        fiveDayRest: 200,
      },
      solverSettings: {
        timeout: 30,
        numWorkers: 4,
      },
    },
  },
  {
    id: "flexible",
    name: "Flexible Mode",
    shortName: "Flexible",
    description: "Lower penalties, prioritizes finding solutions",
    icon: "🌊",
    color: "green",
    recommendedFor: "Complex scenarios or difficult-to-solve schedules",
    benefits: [
      "Easier to find solutions",
      "More flexibility in scheduling",
      "Faster solving time",
    ],
    config: {
      penaltyWeights: {
        staffGroup: 50,
        dailyLimitMin: 25,
        dailyLimitMax: 25,
        monthlyLimit: 40,
        adjacentConflict: 15,
        fiveDayRest: 100,
      },
      solverSettings: {
        timeout: 20,
        numWorkers: 4,
      },
    },
  },
];

// Constraint metadata for UI
const CONSTRAINT_META = {
  staffGroup: {
    category: "Staff Coverage",
    label: "Staff Group Conflicts",
    description:
      "How strictly to enforce that only 1 person from each group can be off/early per day",
    recommendation: "High (100+) for critical coverage",
    priority: "highest",
    lowRange: [0, 50],
    mediumRange: [50, 150],
    highRange: [150, 500],
  },
  dailyLimitMin: {
    category: "Daily Limits",
    label: "Daily Minimum Penalty",
    description: "Enforce minimum staff availability per day",
    recommendation: "Medium (50+) for adequate staffing",
    priority: "high",
    lowRange: [0, 30],
    mediumRange: [30, 100],
    highRange: [100, 200],
  },
  dailyLimitMax: {
    category: "Daily Limits",
    label: "Daily Maximum Penalty",
    description: "Enforce maximum staff off per day",
    recommendation: "Medium (50+) for workload balance",
    priority: "high",
    lowRange: [0, 30],
    mediumRange: [30, 100],
    highRange: [100, 200],
  },
  monthlyLimit: {
    category: "Monthly Limits",
    label: "Monthly Off-Day Limits",
    description: "Ensure staff get their required monthly off days",
    recommendation: "Medium-High (80+) for fairness",
    priority: "high",
    lowRange: [0, 50],
    mediumRange: [50, 150],
    highRange: [150, 300],
  },
  adjacentConflict: {
    category: "Schedule Quality",
    label: "Adjacent Conflict Prevention",
    description:
      "Prevent bad patterns: consecutive off days (xx), early-then-off (△x), off-then-early (x△)",
    recommendation: "Low-Medium (30) for quality",
    priority: "medium",
    lowRange: [0, 20],
    mediumRange: [20, 60],
    highRange: [60, 100],
  },
  fiveDayRest: {
    category: "Labor Law",
    label: "5-Day Rest Constraint",
    description:
      "Ensure at least 1 off day in every 6-day window (labor law requirement)",
    recommendation: "High (200+) for legal compliance",
    priority: "critical",
    lowRange: [0, 100],
    mediumRange: [100, 250],
    highRange: [250, 500],
  },
};

const ConstraintConfiguratorTab = ({ validationErrors = {} }) => {
  const { settings, updateSettings } = useSettings();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get OR-Tools config from settings with defaults
  const ortoolsConfig = settings?.ortoolsConfig || {
    preset: "balanced",
    penaltyWeights: CONSTRAINT_PRESETS[1].config.penaltyWeights,
    solverSettings: CONSTRAINT_PRESETS[1].config.solverSettings,
    hardConstraints: {
      dailyLimits: false,
      monthlyLimits: false,
      staffGroups: false,
      fiveDayRest: false,
    },
  };

  // Get hardConstraints with defaults
  const hardConstraints = ortoolsConfig.hardConstraints || {
    dailyLimits: false,
    monthlyLimits: false,
    staffGroups: false,
    fiveDayRest: false,
  };

  // Determine current preset
  const currentPreset = useMemo(() => {
    return CONSTRAINT_PRESETS.find((preset) => {
      const weightsMatch = Object.keys(preset.config.penaltyWeights).every(
        (key) =>
          preset.config.penaltyWeights[key] ===
          ortoolsConfig.penaltyWeights?.[key],
      );
      return weightsMatch;
    });
  }, [ortoolsConfig.penaltyWeights]);

  const updateOrtoolsConfig = (updates) => {
    updateSettings({
      ...settings,
      ortoolsConfig: {
        ...ortoolsConfig,
        ...updates,
        // Auto-switch to custom when modifying individual values
        preset:
          updates.penaltyWeights || updates.solverSettings
            ? "custom"
            : ortoolsConfig.preset,
      },
    });
  };

  const applyPreset = (preset) => {
    updateSettings({
      ...settings,
      ortoolsConfig: {
        preset: preset.id,
        penaltyWeights: { ...preset.config.penaltyWeights },
        solverSettings: { ...preset.config.solverSettings },
      },
    });
  };

  const resetToDefaults = () => {
    const balancedPreset = CONSTRAINT_PRESETS[1]; // Balanced mode
    applyPreset(balancedPreset);
  };

  const updatePenaltyWeight = (key, value) => {
    updateOrtoolsConfig({
      penaltyWeights: {
        ...ortoolsConfig.penaltyWeights,
        [key]: value,
      },
    });
  };

  const updateSolverSetting = (key, value) => {
    updateOrtoolsConfig({
      solverSettings: {
        ...ortoolsConfig.solverSettings,
        [key]: value,
      },
    });
  };

  const updateHardConstraint = (key, value) => {
    updateSettings({
      ...settings,
      ortoolsConfig: {
        ...ortoolsConfig,
        hardConstraints: {
          ...hardConstraints,
          [key]: value,
        },
      },
    });
  };

  // Get color based on penalty value and ranges
  const getPenaltyColor = (constraintKey, value) => {
    const meta = CONSTRAINT_META[constraintKey];
    if (!meta) return "blue";

    if (value === 0) return "red"; // Disabled
    if (value <= meta.lowRange[1]) return "orange"; // Low
    if (value <= meta.mediumRange[1]) return "blue"; // Medium
    return "green"; // High
  };

  const renderHeroSection = () => (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-8 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
          <Settings2 size={32} />
        </div>
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-3">Constraint Configurator</h2>
          <p className="text-indigo-100 mb-4 text-lg">
            Configure how strictly the AI enforces each scheduling rule. Higher
            penalties mean stricter enforcement.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sliders size={20} className="text-yellow-300" />
                <span className="font-semibold">Fine-Tuned Control</span>
              </div>
              <p className="text-sm text-indigo-100">
                Adjust each constraint independently for perfect balance
              </p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={20} className="text-green-300" />
                <span className="font-semibold">Legal Compliance</span>
              </div>
              <p className="text-sm text-indigo-100">
                Ensure labor law requirements are properly enforced
              </p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={20} className="text-orange-300" />
                <span className="font-semibold">Smart Presets</span>
              </div>
              <p className="text-sm text-indigo-100">
                Quick-start with optimized configurations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPresetCards = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-gray-800">
          Choose Constraint Profile
        </h3>
        {currentPreset && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            Current: {currentPreset.name}
          </span>
        )}
        {ortoolsConfig.preset === "custom" && (
          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
            Custom Configuration
          </span>
        )}
      </div>
      <p className="text-gray-600 mb-6">
        Select how strictly you want constraints enforced. You can customize
        individual penalties below.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CONSTRAINT_PRESETS.map((preset) => (
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
                <p className="text-xs text-gray-600">{preset.recommendedFor}</p>
              </div>
            </div>

            <p className="text-gray-700 mb-4">{preset.description}</p>

            <ul className="space-y-1 mb-4">
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

            <div className="pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  Staff Group:{" "}
                  <span className="font-medium">
                    {preset.config.penaltyWeights.staffGroup}
                  </span>
                </div>
                <div>
                  5-Day Rest:{" "}
                  <span className="font-medium">
                    {preset.config.penaltyWeights.fiveDayRest}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderConstraintCategory = (categoryName, constraintKeys) => {
    const categoryIcons = {
      "Staff Coverage": <Users size={20} className="text-red-600" />,
      "Daily Limits": <Calendar size={20} className="text-blue-600" />,
      "Monthly Limits": <Calendar size={20} className="text-purple-600" />,
      "Schedule Quality": <Sparkles size={20} className="text-yellow-600" />,
      "Labor Law": <Shield size={20} className="text-green-600" />,
    };

    const categoryColors = {
      "Staff Coverage": "red",
      "Daily Limits": "blue",
      "Monthly Limits": "purple",
      "Schedule Quality": "yellow",
      "Labor Law": "green",
    };

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          {categoryIcons[categoryName]}
          <h3 className="text-lg font-semibold text-gray-800">
            {categoryName}
          </h3>
          {categoryName === "Labor Law" && (
            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
              CRITICAL
            </span>
          )}
          {categoryName === "Staff Coverage" && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded">
              HIGH PRIORITY
            </span>
          )}
        </div>

        <div className="space-y-6">
          {constraintKeys.map((key) => {
            const meta = CONSTRAINT_META[key];
            const value = ortoolsConfig.penaltyWeights?.[key] || 0;
            const color = getPenaltyColor(key, value);
            const isDisabled = value === 0;

            return (
              <div
                key={key}
                className={`p-4 rounded-lg border ${
                  isDisabled
                    ? "border-red-200 bg-red-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-2 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-800">
                        {meta.label}
                      </h4>
                      {isDisabled && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                          <AlertTriangle size={12} />
                          DISABLED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {meta.description}
                    </p>
                    <p className="text-xs text-blue-600 font-medium">
                      Recommended: {meta.recommendation}
                    </p>
                  </div>
                </div>

                <Slider
                  value={value}
                  min={meta.lowRange[0]}
                  max={meta.highRange[1]}
                  step={5}
                  onChange={(newValue) => updatePenaltyWeight(key, newValue)}
                  showValue={true}
                  colorScheme={color}
                  className="mt-3"
                />

                <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3">
                  <div className="p-2 bg-orange-50 rounded border border-orange-200">
                    <div className="font-semibold text-orange-600">
                      {meta.lowRange[0]}-{meta.lowRange[1]}
                    </div>
                    <div className="text-orange-700">Low Priority</div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-semibold text-blue-600">
                      {meta.mediumRange[0]}-{meta.mediumRange[1]}
                    </div>
                    <div className="text-blue-700">Medium</div>
                  </div>
                  <div className="p-2 bg-green-50 rounded border border-green-200">
                    <div className="font-semibold text-green-600">
                      {meta.highRange[0]}+
                    </div>
                    <div className="text-green-700">High Priority</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHardConstraintsSection = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Lock size={20} className="text-red-600" />
        <h3 className="text-lg font-semibold text-gray-800">
          Hard Constraints (Strict Mode)
        </h3>
        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
          STRICT ENFORCEMENT
        </span>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-800 font-medium mb-1">
              Hard Constraints cannot be violated
            </p>
            <p className="text-sm text-red-700">
              When enabled, the solver will STRICTLY enforce these limits. If the constraints
              cannot be satisfied (e.g., too few staff for required coverage),
              the schedule generation will FAIL instead of finding a compromise.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Limits */}
        <div className={`p-4 rounded-lg border-2 transition-all ${
          hardConstraints.dailyLimits
            ? "border-red-400 bg-red-50"
            : "border-gray-200 bg-gray-50"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar size={18} className={hardConstraints.dailyLimits ? "text-red-600" : "text-gray-600"} />
              <span className="font-medium text-gray-800">Daily Limits</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="hard-daily"
                checked={hardConstraints.dailyLimits}
                onCheckedChange={(checked) => updateHardConstraint("dailyLimits", checked)}
              />
              <Label htmlFor="hard-daily" className="text-sm">
                {hardConstraints.dailyLimits ? (
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <Lock size={14} /> HARD
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <Unlock size={14} /> Soft
                  </span>
                )}
              </Label>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {hardConstraints.dailyLimits
              ? "Exactly min/max staff off per day - no exceptions"
              : "Soft penalty for daily limit violations"}
          </p>
        </div>

        {/* Monthly Limits */}
        <div className={`p-4 rounded-lg border-2 transition-all ${
          hardConstraints.monthlyLimits
            ? "border-red-400 bg-red-50"
            : "border-gray-200 bg-gray-50"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar size={18} className={hardConstraints.monthlyLimits ? "text-red-600" : "text-gray-600"} />
              <span className="font-medium text-gray-800">Monthly Limits</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="hard-monthly"
                checked={hardConstraints.monthlyLimits}
                onCheckedChange={(checked) => updateHardConstraint("monthlyLimits", checked)}
              />
              <Label htmlFor="hard-monthly" className="text-sm">
                {hardConstraints.monthlyLimits ? (
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <Lock size={14} /> HARD
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <Unlock size={14} /> Soft
                  </span>
                )}
              </Label>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {hardConstraints.monthlyLimits
              ? "Exact monthly off-day count for each staff - no exceptions"
              : "Soft penalty for monthly limit violations"}
          </p>
        </div>

        {/* Staff Groups */}
        <div className={`p-4 rounded-lg border-2 transition-all ${
          hardConstraints.staffGroups
            ? "border-red-400 bg-red-50"
            : "border-gray-200 bg-gray-50"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className={hardConstraints.staffGroups ? "text-red-600" : "text-gray-600"} />
              <span className="font-medium text-gray-800">Staff Groups</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="hard-groups"
                checked={hardConstraints.staffGroups}
                onCheckedChange={(checked) => updateHardConstraint("staffGroups", checked)}
              />
              <Label htmlFor="hard-groups" className="text-sm">
                {hardConstraints.staffGroups ? (
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <Lock size={14} /> HARD
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <Unlock size={14} /> Soft
                  </span>
                )}
              </Label>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {hardConstraints.staffGroups
              ? "Only 1 person per group can be off/early - strictly enforced"
              : "Soft penalty for staff group conflicts"}
          </p>
        </div>

        {/* 5-Day Rest */}
        <div className={`p-4 rounded-lg border-2 transition-all ${
          hardConstraints.fiveDayRest
            ? "border-red-400 bg-red-50"
            : "border-gray-200 bg-gray-50"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield size={18} className={hardConstraints.fiveDayRest ? "text-red-600" : "text-gray-600"} />
              <span className="font-medium text-gray-800">5-Day Rest</span>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="hard-rest"
                checked={hardConstraints.fiveDayRest}
                onCheckedChange={(checked) => updateHardConstraint("fiveDayRest", checked)}
              />
              <Label htmlFor="hard-rest" className="text-sm">
                {hardConstraints.fiveDayRest ? (
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <Lock size={14} /> HARD
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <Unlock size={14} /> Soft
                  </span>
                )}
              </Label>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {hardConstraints.fiveDayRest
              ? "Max 5 consecutive work days - labor law compliance guaranteed"
              : "Soft penalty for 5-day rest violations"}
          </p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>Recommendation:</strong> Enable hard constraints for Daily Limits if you need
          exact staffing levels. Keep other constraints soft for more flexible scheduling.
        </p>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-4 w-full text-left"
      >
        {showAdvanced ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        <span className="text-lg font-semibold">Advanced Solver Settings</span>
        <span className="text-sm text-gray-500 ml-2">
          (Performance and runtime configuration)
        </span>
      </button>

      {showAdvanced && (
        <div className="space-y-6 pt-4 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-blue-600" />
              <span className="font-medium text-blue-800">
                Solver Configuration
              </span>
            </div>
            <p className="text-sm text-blue-700">
              These settings control the OR-Tools CP-SAT solver behavior. Higher
              timeout and workers may improve solution quality but increase
              computation time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-gray-600" />
                <h4 className="font-medium text-gray-800">Solver Timeout</h4>
              </div>
              <NumberInput
                label="Maximum Solving Time"
                value={ortoolsConfig.solverSettings?.timeout || 30}
                min={5}
                max={120}
                step={5}
                onChange={(value) => updateSolverSetting("timeout", value)}
                description="Stop optimization after this many seconds"
                unit="seconds"
                error={validationErrors.timeout}
              />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-green-50 rounded">
                  <div className="font-semibold text-green-600">5-15s</div>
                  <div className="text-green-700">Quick</div>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <div className="font-semibold text-blue-600">20-45s</div>
                  <div className="text-blue-700">Balanced</div>
                </div>
                <div className="p-2 bg-purple-50 rounded">
                  <div className="font-semibold text-purple-600">60-120s</div>
                  <div className="text-purple-700">Thorough</div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={18} className="text-gray-600" />
                <h4 className="font-medium text-gray-800">Parallel Workers</h4>
              </div>
              <NumberInput
                label="Number of Worker Threads"
                value={ortoolsConfig.solverSettings?.numWorkers || 4}
                min={1}
                max={8}
                step={1}
                onChange={(value) => updateSolverSetting("numWorkers", value)}
                description="Number of parallel threads for solving (max: CPU cores)"
                unit="workers"
                error={validationErrors.numWorkers}
              />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-orange-50 rounded">
                  <div className="font-semibold text-orange-600">1-2</div>
                  <div className="text-orange-700">Single/Dual</div>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <div className="font-semibold text-blue-600">4</div>
                  <div className="text-blue-700">Recommended</div>
                </div>
                <div className="p-2 bg-purple-50 rounded">
                  <div className="font-semibold text-purple-600">6-8</div>
                  <div className="text-purple-700">Maximum</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-yellow-600" />
              <span className="font-medium text-yellow-800">
                Performance Note
              </span>
            </div>
            <p className="text-sm text-yellow-700">
              Increasing timeout and workers improves solution quality but uses
              more CPU resources. The solver will stop early if an optimal
              solution is found.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderActionButtons = () => (
    <div className="flex items-center justify-between bg-gray-50 rounded-xl border border-gray-200 p-4">
      <div className="text-sm text-gray-600">
        {ortoolsConfig.preset === "custom" ? (
          <span className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-600" />
            Using custom configuration
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-2xl">{currentPreset?.icon}</span>
            Using {currentPreset?.name} preset
          </span>
        )}
      </div>

      <button
        onClick={resetToDefaults}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <RotateCcw size={16} />
        Reset to Defaults
      </button>
    </div>
  );

  return (
    <div className="p-6">
      {/* Hero Section */}
      {renderHeroSection()}

      {/* Preset Cards */}
      {renderPresetCards()}

      {/* Hard Constraints Section */}
      {renderHardConstraintsSection()}

      {/* Constraint Categories */}
      {renderConstraintCategory("Staff Coverage", ["staffGroup"])}
      {renderConstraintCategory("Daily Limits", [
        "dailyLimitMin",
        "dailyLimitMax",
      ])}
      {renderConstraintCategory("Monthly Limits", ["monthlyLimit"])}
      {renderConstraintCategory("Schedule Quality", ["adjacentConflict"])}
      {renderConstraintCategory("Labor Law", ["fiveDayRest"])}

      {/* Advanced Solver Settings */}
      {renderAdvancedSettings()}

      {/* Action Buttons */}
      {renderActionButtons()}

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

export default ConstraintConfiguratorTab;
