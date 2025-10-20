# AI Config Adapter - Practical Usage Examples

## Table of Contents

1. [WebSocket Integration](#websocket-integration)
2. [Constraint Engine Integration](#constraint-engine-integration)
3. [ML Model Integration](#ml-model-integration)
4. [Real-time Updates](#real-time-updates)
5. [Error Handling](#error-handling)

---

## 1. WebSocket Integration

### Scenario: Settings received from Go WebSocket server

```javascript
// src/hooks/useWebSocketSettings.js
import { createAIConfiguration } from '../ai/adapters';

export const useWebSocketSettings = () => {
  const [settings, setSettings] = useState(null);
  const [aiConfig, setAiConfig] = useState(null);

  useEffect(() => {
    // WebSocket message handler
    const handleSettingsUpdate = (message) => {
      if (message.type === 'SETTINGS_SYNC') {
        // Raw database format from server
        const dbSettings = message.data;

        console.log('📥 Received settings from WebSocket:', dbSettings);

        // Transform to AI-compatible format
        const transformed = createAIConfiguration(dbSettings);

        console.log('✅ Transformed to AI config:', transformed);

        setSettings(dbSettings);      // Store original
        setAiConfig(transformed);      // Store AI format
      }
    };

    wsClient.on('message', handleSettingsUpdate);

    return () => wsClient.off('message', handleSettingsUpdate);
  }, []);

  return {
    settings,      // Original database format
    aiConfig,      // AI-compatible format
  };
};
```

### Example WebSocket Message

```json
{
  "type": "SETTINGS_SYNC",
  "data": {
    "staffGroups": [
      {
        "id": "abc-123",
        "name": "Kitchen Team A",
        "group_config": {
          "members": ["staff-1", "staff-2"],
          "max_simultaneous_off": 1
        },
        "is_active": true
      }
    ],
    "dailyLimits": [
      {
        "id": "limit-1",
        "name": "Max Off Days",
        "limit_config": {
          "max_staff": 4,
          "penalty_weight": 50
        },
        "is_hard_constraint": true,
        "is_active": true
      }
    ],
    "mlModelConfigs": [
      {
        "id": "ml-1",
        "model_type": "neural_network",
        "hyperparameters": {
          "learning_rate": 0.001,
          "epochs": 100
        }
      }
    ]
  }
}
```

### Transformed Output

```javascript
{
  staffGroups: {
    "abc-123": {
      id: "abc-123",
      name: "Kitchen Team A",
      members: ["staff-1", "staff-2"],
      maxSimultaneousOff: 1,
      active: true
    }
  },
  dailyLimits: [
    {
      id: "limit-1",
      name: "Max Off Days",
      maxStaff: 4,
      penalty: 50,
      isHard: true,
      enabled: true
    }
  ],
  mlConfig: {
    modelType: "neural_network",
    learningRate: 0.001,
    epochs: 100,
    // ... defaults for missing fields
  }
}
```

---

## 2. Constraint Engine Integration

### Scenario: Using transformed daily limits for validation

```javascript
// src/ai/constraints/ConstraintEngine.js
import { transformDailyLimits } from '../adapters';

export class EnhancedConstraintEngine {
  constructor(dbDailyLimits) {
    // Transform database limits to AI format
    this.constraints = transformDailyLimits(dbDailyLimits);

    console.log(`🔧 Initialized with ${this.constraints.length} constraints`);
  }

  validateSchedule(scheduleData, staffMembers, dateRange) {
    const violations = [];

    // Use transformed constraints
    this.constraints.forEach(constraint => {
      if (constraint.type === 'max_off_days') {
        const result = this.checkMaxOffDays(
          scheduleData,
          constraint.maxStaff,
          constraint.penalty
        );

        if (!result.valid) {
          violations.push({
            constraint: constraint.name,
            penalty: constraint.penalty,
            isHard: constraint.isHard,
            details: result.details
          });
        }
      }
    });

    return {
      valid: violations.length === 0,
      violations,
      score: this.calculateScore(violations)
    };
  }

  checkMaxOffDays(scheduleData, maxStaff, penalty) {
    // Constraint validation logic using AI-formatted data
    // ...
  }
}

// Usage
const engine = new EnhancedConstraintEngine(dbLimits);
const validation = engine.validateSchedule(schedule, staff, dates);
```

---

## 3. ML Model Integration

### Scenario: Configure TensorFlow model with database settings

```javascript
// src/ai/ml/TensorFlowScheduler.js
import * as tf from '@tensorflow/tfjs';
import { transformMLConfig } from '../adapters';

export class TensorFlowScheduler {
  constructor(dbMLConfigs) {
    // Transform ML configuration
    this.config = transformMLConfig(dbMLConfigs);

    console.log('🧠 ML Config:', this.config);

    this.model = this.buildModel();
  }

  buildModel() {
    const model = tf.sequential();

    // Use transformed config (camelCase properties)
    const { hiddenLayers, activationFunction, dropout } = this.config;

    // Input layer
    model.add(tf.layers.dense({
      units: hiddenLayers[0],
      activation: activationFunction,
      inputShape: [this.inputDim]
    }));

    // Hidden layers
    hiddenLayers.slice(1).forEach(units => {
      model.add(tf.layers.dense({
        units,
        activation: activationFunction
      }));

      if (dropout > 0) {
        model.add(tf.layers.dropout({ rate: dropout }));
      }
    });

    // Output layer
    model.add(tf.layers.dense({
      units: this.outputDim,
      activation: 'softmax'
    }));

    // Compile with transformed config
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: this.config.lossFunction,
      metrics: this.config.metrics
    });

    return model;
  }

  async train(trainingData) {
    const { epochs, batchSize, validationSplit } = this.config;

    await this.model.fit(trainingData.x, trainingData.y, {
      epochs,
      batchSize,
      validationSplit,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs.loss}`);
        }
      }
    });
  }
}

// Usage
const scheduler = new TensorFlowScheduler(dbMLConfigs);
await scheduler.train(trainingData);
```

---

## 4. Real-time Updates

### Scenario: Handle incremental settings updates

```javascript
// src/components/settings/SettingsManager.jsx
import { createAIConfiguration, transformDailyLimits } from '../ai/adapters';

export const SettingsManager = () => {
  const [aiConfig, setAiConfig] = useState(null);
  const constraintEngineRef = useRef(null);

  // Handle WebSocket updates
  const handleSettingsUpdate = useCallback((message) => {
    switch (message.type) {
      case 'DAILY_LIMITS_UPDATE':
        // Incremental update: Only transform daily limits
        const newLimits = transformDailyLimits(message.data.dailyLimits);

        setAiConfig(prev => ({
          ...prev,
          dailyLimits: newLimits
        }));

        // Update constraint engine
        if (constraintEngineRef.current) {
          constraintEngineRef.current.updateConstraints(newLimits);
        }

        console.log('✅ Daily limits updated:', newLimits.length);
        break;

      case 'STAFF_GROUP_UPDATE':
        // Single group update
        const updatedGroup = transformStaffGroups([message.data.group]);

        setAiConfig(prev => ({
          ...prev,
          staffGroups: {
            ...prev.staffGroups,
            ...updatedGroup
          }
        }));
        break;

      case 'FULL_SETTINGS_SYNC':
        // Full configuration refresh
        const fullConfig = createAIConfiguration(message.data);
        setAiConfig(fullConfig);

        // Reinitialize engines
        constraintEngineRef.current = new ConstraintEngine(
          fullConfig.dailyLimits
        );
        break;
    }
  }, []);

  useEffect(() => {
    wsClient.on('settings_update', handleSettingsUpdate);
    return () => wsClient.off('settings_update', handleSettingsUpdate);
  }, [handleSettingsUpdate]);

  return (
    <div>
      {aiConfig && (
        <SettingsDisplay
          staffGroups={aiConfig.staffGroups}
          dailyLimits={aiConfig.dailyLimits}
          mlConfig={aiConfig.mlConfig}
        />
      )}
    </div>
  );
};
```

---

## 5. Error Handling

### Scenario: Graceful degradation with fallbacks

```javascript
// src/ai/AISchedulingEngine.js
import {
  createAIConfiguration,
  validateAIConfiguration,
  DEFAULT_AI_CONFIG
} from './adapters';

export class AISchedulingEngine {
  constructor(dbSettings) {
    try {
      // Attempt transformation
      this.config = createAIConfiguration(dbSettings);

      // Validate transformed config
      const validation = validateAIConfiguration(this.config);

      if (!validation.valid) {
        console.warn('⚠️ Configuration validation failed:', validation.errors);

        // Use defaults for invalid parts
        this.config = {
          ...DEFAULT_AI_CONFIG,
          ...this.config,
          // Override invalid parts with defaults
          mlConfig: validation.errors.some(e => e.includes('mlConfig'))
            ? DEFAULT_AI_CONFIG.mlConfig
            : this.config.mlConfig
        };
      }

      console.log('✅ AI Engine initialized with config:', this.config);
    } catch (error) {
      console.error('❌ Failed to transform settings:', error);

      // Fallback to complete defaults
      this.config = DEFAULT_AI_CONFIG;

      // Notify user
      this.notifyConfigurationError(error);
    }
  }

  notifyConfigurationError(error) {
    // Show user-friendly error message
    toast.error('Configuration Error', {
      description: 'Using default AI settings. Please check your configuration.',
      action: {
        label: 'Details',
        onClick: () => console.error(error)
      }
    });
  }

  // Use config throughout engine
  generateSchedule(constraints) {
    const { staffGroups, dailyLimits, mlConfig } = this.config;

    // AI scheduling logic using transformed config
    // ...
  }
}

// Usage with error handling
try {
  const engine = new AISchedulingEngine(websocketSettings);
  const schedule = await engine.generateSchedule(constraints);
} catch (error) {
  console.error('Scheduling failed:', error);
  // Show fallback UI or manual scheduling option
}
```

---

## Complete Integration Example

```javascript
// src/App.jsx - Complete workflow
import { createAIConfiguration } from './ai/adapters';
import { ConstraintEngine } from './ai/constraints/ConstraintEngine';
import { TensorFlowScheduler } from './ai/ml/TensorFlowScheduler';
import { useWebSocketSettings } from './hooks/useWebSocketSettings';

export const App = () => {
  const { settings: dbSettings } = useWebSocketSettings();
  const [schedule, setSchedule] = useState(null);

  const generateAISchedule = useCallback(async () => {
    if (!dbSettings) return;

    try {
      // Step 1: Transform database settings to AI format
      const aiConfig = createAIConfiguration(dbSettings);
      console.log('✅ Settings transformed:', aiConfig);

      // Step 2: Initialize constraint engine
      const constraintEngine = new ConstraintEngine(aiConfig.dailyLimits);

      // Step 3: Initialize ML scheduler
      const mlScheduler = new TensorFlowScheduler([aiConfig.mlConfig]);

      // Step 4: Generate schedule with AI
      const generated = await mlScheduler.generateSchedule(
        staffMembers,
        dateRange,
        {
          staffGroups: aiConfig.staffGroups,
          constraints: aiConfig.dailyLimits,
          priorities: aiConfig.priorityRules
        }
      );

      // Step 5: Validate against constraints
      const validation = constraintEngine.validateSchedule(
        generated,
        staffMembers,
        dateRange
      );

      if (validation.valid) {
        setSchedule(generated);
        toast.success('Schedule generated successfully!');
      } else {
        toast.warning('Schedule has violations', {
          description: `${validation.violations.length} issues found`
        });
      }
    } catch (error) {
      console.error('Failed to generate schedule:', error);
      toast.error('Schedule generation failed');
    }
  }, [dbSettings, staffMembers, dateRange]);

  return (
    <div>
      <button onClick={generateAISchedule}>
        Generate AI Schedule
      </button>

      {schedule && <ScheduleView schedule={schedule} />}
    </div>
  );
};
```

---

## Key Takeaways

1. **Always transform before using**: Database → Adapter → AI System
2. **Validate after transformation**: Use `validateAIConfiguration()`
3. **Handle errors gracefully**: Fallback to `DEFAULT_AI_CONFIG`
4. **Support incremental updates**: Transform only what changed
5. **Log transformations**: Aid debugging with detailed logs

## Performance Tips

- Cache transformed configs if settings don't change frequently
- Use incremental transformations for real-time updates
- Validate only in development, skip in production (if confident)
- Memoize transformation results in React components

```javascript
const aiConfig = useMemo(
  () => createAIConfiguration(dbSettings),
  [dbSettings]
);
```
