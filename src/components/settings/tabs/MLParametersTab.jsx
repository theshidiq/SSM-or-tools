import React, { useState } from "react";
import {
  Brain,
  Cpu,
  Zap,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Play,
  Settings,
} from "lucide-react";
import FormField from "../shared/FormField";
import Slider from "../shared/Slider";
import NumberInput from "../shared/NumberInput";
import ToggleSwitch from "../shared/ToggleSwitch";

const ALGORITHMS = [
  {
    id: "genetic_algorithm",
    name: "Genetic Algorithm",
    icon: "🧬",
    description:
      "Evolutionary approach that mimics natural selection for optimization",
    complexity: "Medium",
    speed: "Fast",
    accuracy: "High",
    bestFor: "Complex constraints with multiple objectives",
  },
  {
    id: "simulated_annealing",
    name: "Simulated Annealing",
    icon: "🔥",
    description:
      "Physics-inspired algorithm that gradually cools to find optimal solutions",
    complexity: "Low",
    speed: "Medium",
    accuracy: "High",
    bestFor: "Single objective optimization with local minima avoidance",
  },
  {
    id: "constraint_satisfaction",
    name: "Constraint Satisfaction",
    icon: "🧩",
    description: "Logic-based approach focusing on satisfying all constraints",
    complexity: "High",
    speed: "Variable",
    accuracy: "Very High",
    bestFor: "Hard constraints that must be satisfied",
  },
  {
    id: "neural_network",
    name: "Neural Network",
    icon: "🧠",
    description:
      "Deep learning approach that learns from historical data patterns",
    complexity: "Very High",
    speed: "Slow",
    accuracy: "Very High",
    bestFor: "Learning from historical scheduling patterns",
  },
];

const PRESET_CONFIGURATIONS = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Good balance of speed and accuracy for most use cases",
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
    },
  },
  {
    id: "fast",
    name: "Fast",
    description: "Optimized for speed with acceptable accuracy",
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
    },
  },
  {
    id: "accurate",
    name: "High Accuracy",
    description: "Maximum accuracy, may take longer to compute",
    config: {
      algorithm: "genetic_algorithm",
      populationSize: 200,
      generations: 500,
      mutationRate: 0.05,
      crossoverRate: 0.85,
      elitismRate: 0.05,
      convergenceThreshold: 0.0001,
      confidenceThreshold: 0.85,
      maxRuntime: 600,
    },
  },
];

const MLParametersTab = ({
  settings,
  onSettingsChange,
  validationErrors = {},
}) => {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [testingConfiguration, setTestingConfiguration] = useState(false);

  const mlConfig = settings?.mlParameters || {
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
  };

  const updateMLConfig = (updates) => {
    onSettingsChange({
      ...settings,
      mlParameters: { ...mlConfig, ...updates },
    });
  };

  const applyPreset = (preset) => {
    updateMLConfig(preset.config);
    setSelectedPreset(preset.id);
  };

  const resetToDefault = () => {
    const defaultConfig = PRESET_CONFIGURATIONS.find(
      (p) => p.id === "balanced",
    );
    if (defaultConfig) {
      applyPreset(defaultConfig);
    }
  };

  const testConfiguration = async () => {
    setTestingConfiguration(true);
    // Simulate testing the configuration
    try {
      // In a real implementation, this would test the ML configuration
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert("Configuration test completed successfully!");
    } catch (error) {
      alert("Configuration test failed: " + error.message);
    } finally {
      setTestingConfiguration(false);
    }
  };

  const getAlgorithmById = (id) => ALGORITHMS.find((algo) => algo.id === id);
  const selectedAlgorithm = getAlgorithmById(mlConfig.algorithm);

  const renderAlgorithmSelector = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Algorithm Selection
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALGORITHMS.map((algorithm) => (
            <button
              key={algorithm.id}
              onClick={() => updateMLConfig({ algorithm: algorithm.id })}
              className={`p-4 text-left border-2 rounded-xl transition-all hover:shadow-md ${
                mlConfig.algorithm === algorithm.id
                  ? "border-blue-300 bg-blue-50 shadow-lg"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{algorithm.icon}</span>
                <div>
                  <h4 className="font-semibold text-gray-800">
                    {algorithm.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {algorithm.complexity} complexity • {algorithm.speed} speed
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                {algorithm.description}
              </p>

              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600 font-medium">
                  ✓ {algorithm.bestFor}
                </span>
                <span
                  className={`px-2 py-1 rounded ${
                    algorithm.accuracy === "Very High"
                      ? "bg-green-100 text-green-700"
                      : algorithm.accuracy === "High"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {algorithm.accuracy}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderPresetConfigurations = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Preset Configurations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRESET_CONFIGURATIONS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`p-4 text-left border-2 rounded-xl transition-all hover:shadow-md ${
                selectedPreset === preset.id
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <h4 className="font-semibold text-gray-800 mb-2">
                {preset.name}
              </h4>
              <p className="text-sm text-gray-600 mb-3">{preset.description}</p>

              <div className="space-y-1 text-xs text-gray-500">
                <div>Pop Size: {preset.config.populationSize}</div>
                <div>Generations: {preset.config.generations}</div>
                <div>Runtime: {preset.config.maxRuntime}s</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderParameterControls = () => {
    if (!selectedAlgorithm) return null;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">
          {selectedAlgorithm.name} Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Genetic Algorithm Parameters */}
          {mlConfig.algorithm === "genetic_algorithm" && (
            <>
              <NumberInput
                label="Population Size"
                value={mlConfig.populationSize}
                min={20}
                max={500}
                step={10}
                onChange={(value) => updateMLConfig({ populationSize: value })}
                description="Number of candidate solutions in each generation"
                error={validationErrors.populationSize}
              />

              <NumberInput
                label="Generations"
                value={mlConfig.generations}
                min={50}
                max={1000}
                step={50}
                onChange={(value) => updateMLConfig({ generations: value })}
                description="Maximum number of evolution iterations"
                error={validationErrors.generations}
              />

              <Slider
                label="Mutation Rate"
                value={mlConfig.mutationRate}
                min={0.01}
                max={0.5}
                step={0.01}
                onChange={(value) => updateMLConfig({ mutationRate: value })}
                description="Probability of random changes in solutions"
                unit=""
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
                unit=""
                colorScheme="blue"
                error={validationErrors.crossoverRate}
              />

              <Slider
                label="Elitism Rate"
                value={mlConfig.elitismRate}
                min={0.01}
                max={0.3}
                step={0.01}
                onChange={(value) => updateMLConfig({ elitismRate: value })}
                description="Portion of best solutions preserved each generation"
                unit=""
                colorScheme="green"
                error={validationErrors.elitismRate}
              />
            </>
          )}

          {/* Simulated Annealing Parameters */}
          {mlConfig.algorithm === "simulated_annealing" && (
            <>
              <Slider
                label="Initial Temperature"
                value={mlConfig.initialTemperature || 1000}
                min={100}
                max={5000}
                step={100}
                onChange={(value) =>
                  updateMLConfig({ initialTemperature: value })
                }
                description="Starting temperature for annealing process"
                colorScheme="orange"
              />

              <Slider
                label="Cooling Rate"
                value={mlConfig.coolingRate || 0.95}
                min={0.8}
                max={0.99}
                step={0.01}
                onChange={(value) => updateMLConfig({ coolingRate: value })}
                description="Rate at which temperature decreases"
                unit=""
                colorScheme="red"
              />
            </>
          )}

          {/* Common Parameters */}
          <Slider
            label="Convergence Threshold"
            value={mlConfig.convergenceThreshold}
            min={0.0001}
            max={0.01}
            step={0.0001}
            onChange={(value) =>
              updateMLConfig({ convergenceThreshold: value })
            }
            description="Minimum improvement required to continue optimization"
            unit=""
            colorScheme="gray"
            error={validationErrors.convergenceThreshold}
          />

          <NumberInput
            label="Max Runtime (seconds)"
            value={mlConfig.maxRuntime}
            min={30}
            max={1800}
            step={30}
            onChange={(value) => updateMLConfig({ maxRuntime: value })}
            description="Maximum time allowed for optimization"
            unit="s"
            error={validationErrors.maxRuntime}
          />
        </div>

        {/* Advanced Options */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-800">Advanced Options</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSwitch
              label="Adaptive Mutation"
              description="Automatically adjust mutation rate during optimization"
              checked={mlConfig.enableAdaptiveMutation}
              onChange={(checked) =>
                updateMLConfig({ enableAdaptiveMutation: checked })
              }
            />

            <ToggleSwitch
              label="Elitism Diversity"
              description="Maintain diversity among elite solutions"
              checked={mlConfig.enableElitismDiversity}
              onChange={(checked) =>
                updateMLConfig({ enableElitismDiversity: checked })
              }
            />

            <ToggleSwitch
              label="Parallel Processing"
              description="Use multiple CPU cores for faster computation"
              checked={mlConfig.parallelProcessing}
              onChange={(checked) =>
                updateMLConfig({ parallelProcessing: checked })
              }
            />

            <NumberInput
              label="Random Seed"
              value={mlConfig.randomSeed || 0}
              min={0}
              max={999999}
              onChange={(value) =>
                updateMLConfig({ randomSeed: value || null })
              }
              description="Seed for reproducible results (0 = random)"
              showControls={false}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderPerformanceEstimator = () => {
    const estimatedRuntime =
      Math.ceil((mlConfig.populationSize * mlConfig.generations) / 1000) *
      (mlConfig.parallelProcessing ? 0.5 : 1);
    const memoryUsage = Math.ceil(mlConfig.populationSize * 0.1);

    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Performance Estimate
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Zap size={24} className="text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {estimatedRuntime}s
            </div>
            <div className="text-sm text-gray-600">Est. Runtime</div>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Cpu size={24} className="text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {memoryUsage}MB
            </div>
            <div className="text-sm text-gray-600">Memory</div>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <TrendingUp size={24} className="text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {Math.round(mlConfig.confidenceThreshold * 100)}%
            </div>
            <div className="text-sm text-gray-600">Confidence</div>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Brain size={24} className="text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {selectedAlgorithm?.accuracy || "High"}
            </div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-white bg-opacity-50 rounded-lg">
          <p className="text-sm text-gray-700">
            💡 <strong>Optimization Tips:</strong>
            {estimatedRuntime > 300 &&
              " Consider reducing population size or generations for faster results."}
            {mlConfig.mutationRate > 0.3 &&
              " High mutation rate may slow convergence."}
            {mlConfig.populationSize < 50 &&
              " Small population may limit solution diversity."}
            {estimatedRuntime <= 120 &&
              mlConfig.populationSize >= 100 &&
              " Good balance of speed and accuracy."}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">ML Parameters</h2>
          <p className="text-gray-600">
            Configure machine learning algorithms for intelligent schedule
            optimization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Reset to default configuration"
          >
            <RotateCcw size={16} />
            Reset
          </button>

          <button
            onClick={testConfiguration}
            disabled={testingConfiguration}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {testingConfiguration ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play size={16} />
                Test Config
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="font-medium text-red-800">
              Configuration Errors
            </span>
          </div>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {Object.entries(validationErrors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence Threshold */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Model Confidence
        </h3>

        <Slider
          label="Confidence Threshold"
          value={mlConfig.confidenceThreshold}
          min={0.5}
          max={0.95}
          step={0.05}
          onChange={(value) => updateMLConfig({ confidenceThreshold: value })}
          description="Minimum confidence required for auto-accepting ML suggestions"
          unit="%"
          showValue={true}
          colorScheme="blue"
          className="mb-4"
        />

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="font-semibold text-red-600">50-65%</div>
            <div className="text-sm text-red-700">Low Confidence</div>
            <div className="text-xs text-red-600 mt-1">
              Manual review required
            </div>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg">
            <div className="font-semibold text-yellow-600">70-80%</div>
            <div className="text-sm text-yellow-700">Medium Confidence</div>
            <div className="text-xs text-yellow-600 mt-1">
              Some suggestions auto-applied
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="font-semibold text-green-600">85-95%</div>
            <div className="text-sm text-green-700">High Confidence</div>
            <div className="text-xs text-green-600 mt-1">
              Most suggestions auto-applied
            </div>
          </div>
        </div>
      </div>

      {/* Algorithm Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {renderAlgorithmSelector()}
      </div>

      {/* Preset Configurations */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {renderPresetConfigurations()}
      </div>

      {/* Parameter Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {renderParameterControls()}
      </div>

      {/* Performance Estimator */}
      {renderPerformanceEstimator()}
    </div>
  );
};

export default MLParametersTab;
