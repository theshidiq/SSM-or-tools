import React, { useState, useMemo } from "react";
import { BarChart3, TrendingUp, RotateCcw, Download, AlertTriangle, Info } from "lucide-react";
import Slider from "../shared/Slider";
import ToggleSwitch from "../shared/ToggleSwitch";

const CONSTRAINT_CATEGORIES = [
  {
    id: "fairness",
    name: "Fairness",
    description: "Equal distribution of shifts and off days among staff",
    icon: "⚖️",
    color: "#10B981",
    weights: [
      {
        id: "shift_distribution",
        name: "Shift Distribution",
        description: "Ensure fair distribution of different shift types",
        defaultWeight: 25,
        min: 0,
        max: 50,
      },
      {
        id: "off_day_distribution",
        name: "Off Day Distribution",
        description: "Balance off days across all staff members",
        defaultWeight: 20,
        min: 0,
        max: 40,
      },
      {
        id: "weekend_fairness",
        name: "Weekend Fairness",
        description: "Fair distribution of weekend shifts",
        defaultWeight: 15,
        min: 0,
        max: 30,
      },
    ]
  },
  {
    id: "preferences",
    name: "Staff Preferences",
    description: "Honor individual staff preferences and priority rules",
    icon: "👤",
    color: "#8B5CF6",
    weights: [
      {
        id: "shift_preferences",
        name: "Shift Preferences",
        description: "Respect staff preferred shift types",
        defaultWeight: 20,
        min: 0,
        max: 40,
      },
      {
        id: "day_off_preferences",
        name: "Day Off Preferences",
        description: "Honor requested off days",
        defaultWeight: 15,
        min: 0,
        max: 30,
      },
      {
        id: "seniority_bonus",
        name: "Seniority Bonus",
        description: "Give preference to senior staff members",
        defaultWeight: 10,
        min: 0,
        max: 25,
      },
    ]
  },
  {
    id: "constraints",
    name: "Business Constraints",
    description: "Hard business rules and operational requirements",
    icon: "🏢",
    color: "#EF4444",
    weights: [
      {
        id: "minimum_coverage",
        name: "Minimum Coverage",
        description: "Ensure minimum staff coverage at all times",
        defaultWeight: 40,
        min: 20,
        max: 60,
      },
      {
        id: "skill_requirements",
        name: "Skill Requirements",
        description: "Match staff skills to shift requirements",
        defaultWeight: 30,
        min: 10,
        max: 50,
      },
      {
        id: "conflict_avoidance",
        name: "Conflict Avoidance",
        description: "Prevent scheduling conflicts between staff",
        defaultWeight: 35,
        min: 15,
        max: 50,
      },
    ]
  },
  {
    id: "optimization",
    name: "Optimization Goals",
    description: "Overall scheduling optimization objectives",
    icon: "🎯",
    color: "#F59E0B",
    weights: [
      {
        id: "schedule_stability",
        name: "Schedule Stability",
        description: "Minimize changes from previous schedules",
        defaultWeight: 15,
        min: 0,
        max: 30,
      },
      {
        id: "cost_efficiency",
        name: "Cost Efficiency",
        description: "Optimize for labor cost efficiency",
        defaultWeight: 20,
        min: 0,
        max: 35,
      },
      {
        id: "pattern_consistency",
        name: "Pattern Consistency",
        description: "Maintain consistent shift patterns",
        defaultWeight: 10,
        min: 0,
        max: 25,
      },
    ]
  }
];

const PENALTY_MULTIPLIERS = [
  {
    id: "hard_constraint_violation",
    name: "Hard Constraint Violation",
    description: "Penalty for violating mandatory constraints",
    defaultValue: 1000,
    min: 100,
    max: 10000,
    color: "#DC2626",
  },
  {
    id: "soft_constraint_violation",
    name: "Soft Constraint Violation",
    description: "Penalty for violating preferred constraints",
    defaultValue: 50,
    min: 1,
    max: 500,
    color: "#F97316",
  },
  {
    id: "preference_violation",
    name: "Preference Violation",
    description: "Penalty for not satisfying preferences",
    defaultValue: 10,
    min: 1,
    max: 100,
    color: "#EAB308",
  },
];

const PRESET_PROFILES = [
  {
    id: "strict",
    name: "Strict",
    description: "Prioritize business constraints over preferences",
    multiplier: { hard: 2000, soft: 100, preference: 5 },
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Balance between constraints and preferences",
    multiplier: { hard: 1000, soft: 50, preference: 10 },
  },
  {
    id: "flexible",
    name: "Flexible",
    description: "Emphasize staff preferences and fairness",
    multiplier: { hard: 500, soft: 25, preference: 20 },
  },
];

const ConstraintWeightsTab = ({
  settings,
  onSettingsChange,
  validationErrors = {},
}) => {
  const [selectedProfile, setSelectedProfile] = useState("balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const weights = settings?.constraintWeights || {};
  const penaltyMultipliers = settings?.penaltyMultipliers || {
    hard_constraint_violation: 1000,
    soft_constraint_violation: 50,
    preference_violation: 10,
  };

  // Calculate total weights by category
  const categoryTotals = useMemo(() => {
    const totals = {};
    CONSTRAINT_CATEGORIES.forEach(category => {
      totals[category.id] = category.weights.reduce((sum, weight) => {
        return sum + (weights[weight.id] || weight.defaultWeight);
      }, 0);
    });
    return totals;
  }, [weights]);

  const grandTotal = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum, total) => sum + total, 0);
  }, [categoryTotals]);

  const updateWeight = (weightId, value) => {
    onSettingsChange({
      ...settings,
      constraintWeights: {
        ...weights,
        [weightId]: value,
      },
    });
  };

  const updatePenaltyMultiplier = (multiplierId, value) => {
    onSettingsChange({
      ...settings,
      penaltyMultipliers: {
        ...penaltyMultipliers,
        [multiplierId]: value,
      },
    });
  };

  const applyPresetProfile = (profile) => {
    const preset = PRESET_PROFILES.find(p => p.id === profile);
    if (!preset) return;

    const newPenaltyMultipliers = {
      hard_constraint_violation: preset.multiplier.hard,
      soft_constraint_violation: preset.multiplier.soft,
      preference_violation: preset.multiplier.preference,
    };

    onSettingsChange({
      ...settings,
      penaltyMultipliers: newPenaltyMultipliers,
    });
    setSelectedProfile(profile);
  };

  const resetToDefaults = () => {
    const defaultWeights = {};
    CONSTRAINT_CATEGORIES.forEach(category => {
      category.weights.forEach(weight => {
        defaultWeights[weight.id] = weight.defaultWeight;
      });
    });

    const defaultPenalties = {};
    PENALTY_MULTIPLIERS.forEach(penalty => {
      defaultPenalties[penalty.id] = penalty.defaultValue;
    });

    onSettingsChange({
      ...settings,
      constraintWeights: defaultWeights,
      penaltyMultipliers: defaultPenalties,
    });
    setSelectedProfile("balanced");
  };

  const exportConfiguration = () => {
    const config = {
      constraintWeights: weights,
      penaltyMultipliers,
      profile: selectedProfile,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "constraint-weights-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderWeightDistributionChart = () => {
    const maxBarWidth = 200;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <BarChart3 size={20} />
          Weight Distribution
        </h3>

        <div className="space-y-4">
          {CONSTRAINT_CATEGORIES.map(category => {
            const percentage = grandTotal > 0 ? (categoryTotals[category.id] / grandTotal * 100) : 0;
            const barWidth = grandTotal > 0 ? (categoryTotals[category.id] / Math.max(...Object.values(categoryTotals)) * maxBarWidth) : 0;

            return (
              <div key={category.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{category.icon}</span>
                    <span className="font-medium text-gray-800">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{categoryTotals[category.id]}</span>
                    <span>({percentage.toFixed(1)}%)</span>
                  </div>
                </div>

                <div className="relative">
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${barWidth}px`,
                        backgroundColor: category.color,
                        maxWidth: "100%",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-800">Total Weight:</span>
            <span className="font-bold text-gray-900">{grandTotal}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderWeightControls = () => {
    return (
      <div className="space-y-8">
        {CONSTRAINT_CATEGORIES.map(category => (
          <div key={category.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${category.color}15` }}
              >
                <span className="text-xl">{category.icon}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{category.name}</h3>
                <p className="text-sm text-gray-600">{category.description}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-lg font-bold" style={{ color: category.color }}>
                  {categoryTotals[category.id]}
                </div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.weights.map(weight => (
                <div key={weight.id} className="space-y-2">
                  <Slider
                    label={weight.name}
                    description={weight.description}
                    value={weights[weight.id] || weight.defaultWeight}
                    min={weight.min}
                    max={weight.max}
                    onChange={(value) => updateWeight(weight.id, value)}
                    colorScheme={category.id === "fairness" ? "green" : 
                               category.id === "preferences" ? "purple" :
                               category.id === "constraints" ? "red" : "orange"}
                    error={validationErrors[weight.id]}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPenaltyMultipliers = () => {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Penalty Multipliers</h3>
        <p className="text-gray-600 text-sm mb-6">
          Configure how severely different types of violations are penalized in the optimization process.
        </p>

        <div className="space-y-6">
          {PENALTY_MULTIPLIERS.map(penalty => (
            <div key={penalty.id} className="space-y-2">
              <Slider
                label={penalty.name}
                description={penalty.description}
                value={penaltyMultipliers[penalty.id] || penalty.defaultValue}
                min={penalty.min}
                max={penalty.max}
                onChange={(value) => updatePenaltyMultiplier(penalty.id, value)}
                colorScheme={penalty.id === "hard_constraint_violation" ? "red" :
                           penalty.id === "soft_constraint_violation" ? "orange" : "yellow"}
                error={validationErrors[penalty.id]}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Penalty Guidelines:</p>
              <ul className="space-y-1 text-xs">
                <li>• Hard constraints should have penalties 10-100x higher than soft constraints</li>
                <li>• Soft constraints should be 2-10x higher than preferences</li>
                <li>• Very high penalties may cause optimization to get stuck in local minima</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Constraint Weights</h2>
          <p className="text-gray-600">
            Fine-tune the importance of different constraints in the scheduling algorithm.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <TrendingUp size={16} />
            {showAdvanced ? "Hide Advanced" : "Show Advanced"}
          </button>
          
          <button
            onClick={exportConfiguration}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="font-medium text-red-800">Configuration Errors</span>
          </div>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {Object.entries(validationErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preset Profiles */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Optimization Profiles</h3>
        <p className="text-gray-600 text-sm mb-4">
          Quick presets for common scheduling priorities.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRESET_PROFILES.map(profile => (
            <button
              key={profile.id}
              onClick={() => applyPresetProfile(profile.id)}
              className={`p-4 text-left border-2 rounded-xl transition-all hover:shadow-md ${
                selectedProfile === profile.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <h4 className="font-semibold text-gray-800 mb-2">{profile.name}</h4>
              <p className="text-sm text-gray-600 mb-3">{profile.description}</p>
              
              <div className="space-y-1 text-xs text-gray-500">
                <div>Hard: {profile.multiplier.hard}</div>
                <div>Soft: {profile.multiplier.soft}</div>
                <div>Preference: {profile.multiplier.preference}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Weight Distribution Visualization */}
      {renderWeightDistributionChart()}

      {/* Weight Controls */}
      {renderWeightControls()}

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-8">
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Advanced Settings</h3>
            
            {renderPenaltyMultipliers()}
            
            {/* Normalization Settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Normalization</h3>
              
              <div className="space-y-4">
                <ToggleSwitch
                  label="Auto-normalize Weights"
                  description="Automatically scale weights to sum to 100"
                  checked={settings?.autoNormalizeWeights || false}
                  onChange={(checked) => onSettingsChange({
                    ...settings,
                    autoNormalizeWeights: checked,
                  })}
                />
                
                <ToggleSwitch
                  label="Dynamic Weight Adjustment"
                  description="Allow ML algorithm to fine-tune weights based on results"
                  checked={settings?.dynamicWeightAdjustment || false}
                  onChange={(checked) => onSettingsChange({
                    ...settings,
                    dynamicWeightAdjustment: checked,
                  })}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstraintWeightsTab;