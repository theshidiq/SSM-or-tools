# Frontend Integration Example: Configurable Penalty Weights

## Overview

This guide shows how to integrate the configurable penalty weights feature into the React frontend.

## Integration Points

### 1. AI Settings Hook (useAISettings.js)

Add OR-Tools configuration to the AI settings:

```javascript
// src/hooks/useAISettings.js

export function useAISettings() {
  // ... existing code ...

  const [ortoolsConfig, setOrtoolsConfig] = useState({
    penaltyWeights: {
      staffGroup: 100,
      dailyLimitMin: 50,
      dailyLimitMax: 50,
      monthlyLimit: 80,
      adjacentConflict: 30,
      fiveDayRest: 200
    },
    solverSettings: {
      timeout: 30,
      numWorkers: 4
    }
  });

  // ... existing code ...

  return {
    // ... existing returns ...
    ortoolsConfig,
    setOrtoolsConfig,
  };
}
```

### 2. Generate Schedule with Custom Weights

Update the schedule generation to include OR-Tools config:

```javascript
// src/hooks/useAIAssistantLazy.js or similar

async function generateScheduleWithORTools(constraints) {
  const payload = {
    staffMembers: staffMembers.map(staff => ({
      id: staff.id,
      name: staff.name,
      position: staff.position,
      status: staff.status
    })),
    dateRange: generateDateRange(startDate, endDate),
    constraints: {
      // Existing constraints
      calendarRules: calendarRules,
      earlyShiftPreferences: earlyShiftPreferences,
      staffGroups: staffGroups,
      dailyLimitsRaw: dailyLimits,
      monthlyLimit: monthlyLimit,
      priorityRules: priorityRules,

      // NEW: OR-Tools configuration
      ortoolsConfig: {
        penaltyWeights: {
          staffGroup: ortoolsSettings.staffGroupPriority,
          dailyLimitMin: ortoolsSettings.dailyMinPriority,
          dailyLimitMax: ortoolsSettings.dailyMaxPriority,
          monthlyLimit: ortoolsSettings.monthlyPriority,
          adjacentConflict: ortoolsSettings.adjacentConflictPriority,
          fiveDayRest: ortoolsSettings.fiveDayRestPriority
        },
        solverSettings: {
          timeout: ortoolsSettings.timeout || 30,
          numWorkers: ortoolsSettings.workers || 4
        }
      }
    },
    timeout: 30
  };

  // Send to Go WebSocket server or directly to OR-Tools service
  const response = await fetch('/api/ortools/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (result.success) {
    console.log('[OR-TOOLS] Schedule generated successfully');
    console.log('  Config used:', result.config);
    console.log('  Violations:', result.violations);
    return result.schedule;
  } else {
    console.error('[OR-TOOLS] Failed:', result.error);
    throw new Error(result.error);
  }
}
```

### 3. UI Component for Configuration

Create a settings panel for administrators to tune penalty weights:

```jsx
// src/components/settings/ORToolsConfigPanel.jsx

import React, { useState } from 'react';

const PRESET_CONFIGS = {
  default: {
    name: 'Default (Balanced)',
    description: 'Balanced constraint enforcement',
    weights: {
      staffGroup: 100,
      dailyLimitMin: 50,
      dailyLimitMax: 50,
      monthlyLimit: 80,
      adjacentConflict: 30,
      fiveDayRest: 200
    }
  },
  strict: {
    name: 'Strict (High Compliance)',
    description: 'Prioritize all constraints equally',
    weights: {
      staffGroup: 150,
      dailyLimitMin: 100,
      dailyLimitMax: 100,
      monthlyLimit: 120,
      adjacentConflict: 80,
      fiveDayRest: 300
    }
  },
  flexible: {
    name: 'Flexible (Relaxed)',
    description: 'Allow more constraint flexibility',
    weights: {
      staffGroup: 60,
      dailyLimitMin: 30,
      dailyLimitMax: 30,
      monthlyLimit: 40,
      adjacentConflict: 15,
      fiveDayRest: 150
    }
  },
  laborFocused: {
    name: 'Labor Law Focused',
    description: 'Prioritize labor law compliance',
    weights: {
      staffGroup: 80,
      dailyLimitMin: 60,
      dailyLimitMax: 60,
      monthlyLimit: 100,
      adjacentConflict: 40,
      fiveDayRest: 500
    }
  }
};

export function ORToolsConfigPanel({ config, onConfigChange }) {
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [customMode, setCustomMode] = useState(false);

  const handlePresetChange = (presetKey) => {
    setSelectedPreset(presetKey);
    setCustomMode(false);
    const preset = PRESET_CONFIGS[presetKey];
    onConfigChange({
      ...config,
      penaltyWeights: preset.weights
    });
  };

  const handleWeightChange = (weightKey, value) => {
    setCustomMode(true);
    setSelectedPreset('custom');
    onConfigChange({
      ...config,
      penaltyWeights: {
        ...config.penaltyWeights,
        [weightKey]: parseInt(value, 10)
      }
    });
  };

  return (
    <div className="ortools-config-panel">
      <h3>OR-Tools Constraint Configuration</h3>

      {/* Preset Selector */}
      <div className="preset-selector">
        <label>Configuration Preset:</label>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          {Object.entries(PRESET_CONFIGS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.name}
            </option>
          ))}
          {customMode && <option value="custom">Custom</option>}
        </select>
        {selectedPreset !== 'custom' && PRESET_CONFIGS[selectedPreset] && (
          <p className="preset-description">
            {PRESET_CONFIGS[selectedPreset].description}
          </p>
        )}
      </div>

      {/* Penalty Weight Sliders */}
      <div className="weight-controls">
        <h4>Penalty Weights</h4>

        <WeightSlider
          label="Staff Group Coverage"
          value={config.penaltyWeights.staffGroup}
          onChange={(v) => handleWeightChange('staffGroup', v)}
          min={0}
          max={300}
          description="Prevent multiple group members from being off simultaneously"
        />

        <WeightSlider
          label="Daily Minimum Off Days"
          value={config.penaltyWeights.dailyLimitMin}
          onChange={(v) => handleWeightChange('dailyLimitMin', v)}
          min={0}
          max={200}
          description="Ensure minimum staff get rest days each day"
        />

        <WeightSlider
          label="Daily Maximum Off Days"
          value={config.penaltyWeights.dailyLimitMax}
          onChange={(v) => handleWeightChange('dailyLimitMax', v)}
          min={0}
          max={200}
          description="Maintain minimum working staff each day"
        />

        <WeightSlider
          label="Monthly Off Day Limits"
          value={config.penaltyWeights.monthlyLimit}
          onChange={(v) => handleWeightChange('monthlyLimit', v)}
          min={0}
          max={250}
          description="Fair distribution of monthly rest days"
        />

        <WeightSlider
          label="Adjacent Conflict Patterns"
          value={config.penaltyWeights.adjacentConflict}
          onChange={(v) => handleWeightChange('adjacentConflict', v)}
          min={0}
          max={150}
          description="Avoid problematic patterns (xx, sx, xs)"
        />

        <WeightSlider
          label="5-Day Rest (Labor Law)"
          value={config.penaltyWeights.fiveDayRest}
          onChange={(v) => handleWeightChange('fiveDayRest', v)}
          min={100}
          max={500}
          description="No more than 5 consecutive work days (CRITICAL)"
          critical
        />
      </div>

      {/* Solver Settings */}
      <div className="solver-settings">
        <h4>Solver Performance</h4>

        <div className="setting-row">
          <label>Timeout (seconds):</label>
          <input
            type="number"
            min={5}
            max={120}
            value={config.solverSettings.timeout}
            onChange={(e) => onConfigChange({
              ...config,
              solverSettings: {
                ...config.solverSettings,
                timeout: parseInt(e.target.value, 10)
              }
            })}
          />
          <span className="hint">5-120 seconds (default: 30)</span>
        </div>

        <div className="setting-row">
          <label>Parallel Workers:</label>
          <input
            type="number"
            min={1}
            max={16}
            value={config.solverSettings.numWorkers}
            onChange={(e) => onConfigChange({
              ...config,
              solverSettings: {
                ...config.solverSettings,
                numWorkers: parseInt(e.target.value, 10)
              }
            })}
          />
          <span className="hint">1-16 cores (default: 4)</span>
        </div>
      </div>

      {/* Info Section */}
      <div className="config-info">
        <p>
          <strong>Higher penalties</strong> = Constraint is more important to satisfy
        </p>
        <p>
          <strong>Lower penalties</strong> = Constraint can be relaxed if needed
        </p>
      </div>
    </div>
  );
}

function WeightSlider({ label, value, onChange, min, max, description, critical }) {
  return (
    <div className={`weight-slider ${critical ? 'critical' : ''}`}>
      <label>
        {label}
        {critical && <span className="critical-badge">CRITICAL</span>}
      </label>
      <div className="slider-container">
        <input
          type="range"
          min={min}
          max={max}
          step={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="value-input"
        />
      </div>
      <p className="slider-description">{description}</p>
    </div>
  );
}

export default ORToolsConfigPanel;
```

### 4. Display Results with Configuration

Show the configuration used in the results:

```jsx
// src/components/schedule/ScheduleGenerationResults.jsx

export function ScheduleGenerationResults({ result }) {
  if (!result.success) {
    return <ErrorDisplay error={result.error} />;
  }

  return (
    <div className="generation-results">
      <h3>Schedule Generated Successfully</h3>

      {/* Status Info */}
      <div className="status-info">
        <StatusBadge
          status={result.is_optimal ? 'Optimal' : 'Feasible'}
          optimal={result.is_optimal}
        />
        <span>Solved in {result.solve_time.toFixed(2)}s</span>
      </div>

      {/* Configuration Used */}
      {result.config && (
        <div className="config-used">
          <h4>Configuration Used</h4>
          <div className="config-grid">
            <ConfigItem
              label="Staff Group"
              value={result.config.penaltyWeights.staffGroup}
            />
            <ConfigItem
              label="Daily Min"
              value={result.config.penaltyWeights.dailyLimitMin}
            />
            <ConfigItem
              label="Daily Max"
              value={result.config.penaltyWeights.dailyLimitMax}
            />
            <ConfigItem
              label="Monthly"
              value={result.config.penaltyWeights.monthlyLimit}
            />
            <ConfigItem
              label="Adjacent"
              value={result.config.penaltyWeights.adjacentConflict}
            />
            <ConfigItem
              label="5-Day Rest"
              value={result.config.penaltyWeights.fiveDayRest}
              critical
            />
          </div>
          <div className="solver-info">
            <span>Timeout: {result.config.timeout}s</span>
            <span>Workers: {result.config.numWorkers}</span>
          </div>
        </div>
      )}

      {/* Violations (if any) */}
      {result.violations && result.violations.length > 0 && (
        <div className="violations-section">
          <h4>Constraint Violations ({result.violations.length})</h4>
          <p className="violations-note">
            The schedule has some constraint violations. Consider adjusting
            penalty weights or relaxing constraints.
          </p>
          <ul className="violations-list">
            {result.violations.slice(0, 10).map((violation, idx) => (
              <li key={idx}>
                <span className="violation-description">
                  {violation.description}
                </span>
                <span className="violation-count">
                  Count: {violation.count}
                </span>
                <span className="violation-penalty">
                  Penalty: {violation.penalty}
                </span>
              </li>
            ))}
          </ul>
          {result.violations.length > 10 && (
            <p className="more-violations">
              ... and {result.violations.length - 10} more violations
            </p>
          )}
        </div>
      )}

      {/* Success with no violations */}
      {(!result.violations || result.violations.length === 0) && (
        <div className="no-violations">
          ✓ All constraints satisfied - perfect schedule!
        </div>
      )}

      {/* Statistics */}
      <div className="stats">
        <h4>Statistics</h4>
        <StatItem label="Staff Count" value={result.stats.staff_count} />
        <StatItem label="Days" value={result.stats.date_count} />
        <StatItem label="Total Off Days" value={result.stats.total_off_days} />
        <StatItem label="Branches" value={result.stats.num_branches} />
        <StatItem label="Conflicts" value={result.stats.num_conflicts} />
      </div>
    </div>
  );
}

function ConfigItem({ label, value, critical }) {
  return (
    <div className={`config-item ${critical ? 'critical' : ''}`}>
      <span className="config-label">{label}:</span>
      <span className="config-value">{value}</span>
    </div>
  );
}

function StatusBadge({ status, optimal }) {
  return (
    <span className={`status-badge ${optimal ? 'optimal' : 'feasible'}`}>
      {status}
    </span>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="stat-item">
      <span className="stat-label">{label}:</span>
      <span className="stat-value">{value.toLocaleString()}</span>
    </div>
  );
}
```

### 5. Example Styles (CSS)

```css
/* src/components/settings/ORToolsConfigPanel.css */

.ortools-config-panel {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.preset-selector {
  margin-bottom: 30px;
}

.preset-selector select {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.preset-description {
  margin-top: 8px;
  font-size: 14px;
  color: #666;
}

.weight-controls {
  margin-bottom: 30px;
}

.weight-slider {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
}

.weight-slider.critical {
  border-left: 4px solid #e74c3c;
}

.weight-slider label {
  display: flex;
  align-items: center;
  font-weight: 600;
  margin-bottom: 10px;
}

.critical-badge {
  margin-left: 10px;
  padding: 2px 8px;
  background: #e74c3c;
  color: white;
  font-size: 11px;
  border-radius: 3px;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 15px;
}

.slider-container input[type="range"] {
  flex: 1;
}

.slider-container .value-input {
  width: 80px;
  padding: 5px;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.slider-description {
  margin-top: 5px;
  font-size: 13px;
  color: #666;
}

.solver-settings {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.setting-row label {
  font-weight: 600;
  min-width: 150px;
}

.setting-row input {
  width: 100px;
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.setting-row .hint {
  font-size: 13px;
  color: #666;
}

.config-info {
  padding: 15px;
  background: #e8f4f8;
  border-radius: 4px;
  border-left: 4px solid #3498db;
}

.config-info p {
  margin: 5px 0;
  font-size: 14px;
}

/* Results Display */
.generation-results {
  padding: 20px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 13px;
}

.status-badge.optimal {
  background: #2ecc71;
  color: white;
}

.status-badge.feasible {
  background: #f39c12;
  color: white;
}

.config-used {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin: 15px 0;
}

.config-item {
  padding: 10px;
  background: white;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
}

.config-item.critical {
  border-left: 3px solid #e74c3c;
}

.violations-section {
  margin: 20px 0;
  padding: 15px;
  background: #fff3cd;
  border-left: 4px solid #ffc107;
  border-radius: 4px;
}

.violations-list {
  list-style: none;
  padding: 0;
  margin: 15px 0;
}

.violations-list li {
  padding: 8px;
  margin-bottom: 8px;
  background: white;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.no-violations {
  margin: 20px 0;
  padding: 15px;
  background: #d4edda;
  border-left: 4px solid #28a745;
  border-radius: 4px;
  color: #155724;
  font-weight: 600;
}
```

## Complete Usage Example

```jsx
// src/pages/ScheduleGenerationPage.jsx

import React, { useState } from 'react';
import ORToolsConfigPanel from '../components/settings/ORToolsConfigPanel';
import ScheduleGenerationResults from '../components/schedule/ScheduleGenerationResults';

export function ScheduleGenerationPage() {
  const [ortoolsConfig, setOrtoolsConfig] = useState({
    penaltyWeights: {
      staffGroup: 100,
      dailyLimitMin: 50,
      dailyLimitMax: 50,
      monthlyLimit: 80,
      adjacentConflict: 30,
      fiveDayRest: 200
    },
    solverSettings: {
      timeout: 30,
      numWorkers: 4
    }
  });

  const [generationResult, setGenerationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const constraints = buildConstraints(); // Your existing constraint builder

      const result = await generateSchedule({
        ...constraints,
        ortoolsConfig: ortoolsConfig
      });

      setGenerationResult(result);
    } catch (error) {
      console.error('Generation failed:', error);
      setGenerationResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="schedule-generation-page">
      <h2>Generate Schedule with OR-Tools</h2>

      {/* Configuration Panel */}
      <ORToolsConfigPanel
        config={ortoolsConfig}
        onConfigChange={setOrtoolsConfig}
      />

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="generate-button"
      >
        {loading ? 'Generating...' : 'Generate Schedule'}
      </button>

      {/* Results */}
      {generationResult && (
        <ScheduleGenerationResults result={generationResult} />
      )}
    </div>
  );
}
```

## Summary

This integration allows users to:

1. **Choose presets** for common scenarios (Default, Strict, Flexible, Labor-Focused)
2. **Fine-tune individual weights** with sliders
3. **Adjust solver performance** (timeout, workers)
4. **See the configuration used** in results
5. **Review violations** to understand schedule quality
6. **Make informed adjustments** based on results

The UI makes it easy for administrators to tune the optimizer without touching code or redeploying services.
