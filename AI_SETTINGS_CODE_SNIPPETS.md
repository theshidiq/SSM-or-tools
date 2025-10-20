# AI Settings Integration - Code Snippets

## Modified File Sections

### 1. HybridPredictor.js - Constructor Changes

**Location**: Lines 15-47

```javascript
export class HybridPredictor {
  constructor() {
    this.initialized = false;
    this.status = "idle";
    this.mlEngine = null;
    this.ruleValidator = null;
    this.predictionHistory = [];
    this.settingsProvider = null; // ✅ NEW: Real-time settings provider
    this.metrics = {
      totalPredictions: 0,
      mlAcceptedRate: 0,
      rulesAppliedRate: 0,
      hybridSuccessRate: 0,
    };
  }

  /**
   * ✅ NEW: Set settings provider for real-time configuration access
   * @param {Object} provider - Settings provider with getSettings() method
   */
  setSettingsProvider(provider) {
    if (!provider || typeof provider.getSettings !== "function") {
      throw new Error(
        "Invalid settings provider - must have getSettings() method",
      );
    }
    this.settingsProvider = provider;
    console.log("✅ HybridPredictor: Settings provider configured");

    // Also pass settings provider to rule validator
    if (this.ruleValidator) {
      this.ruleValidator.setSettingsProvider(provider);
    }
  }
```

---

### 2. HybridPredictor.js - Initialize Method Changes

**Location**: Lines 64-70

```javascript
// Initialize business rule validator
this.ruleValidator = new BusinessRuleValidator();
await this.ruleValidator.initialize({
  ...options.rules,
  strictValidation: true,
  allowPartialCorrection: false, // Enforce complete constraint compliance
  maxCorrectionAttempts: 5, // More attempts to fix violations
  settingsProvider: this.settingsProvider, // ✅ NEW: Pass settings provider
});
```

---

### 3. HybridPredictor.js - predictSchedule Method Changes

**Location**: Lines 149-170

```javascript
try {
  console.log("🔮 Generating hybrid schedule predictions...");

  // ✅ NEW: Get live settings from settings provider (real-time configuration)
  let liveSettings = null;
  if (this.settingsProvider) {
    try {
      liveSettings = this.settingsProvider.getSettings();
      console.log(
        "⚡ Using live settings from WebSocket (real-time configuration)",
      );
    } catch (error) {
      console.warn(
        "⚠️ Failed to get live settings, using defaults:",
        error.message,
      );
      liveSettings = null;
    }
  } else {
    console.warn(
      "⚠️ No settings provider configured - call setSettingsProvider() first",
    );
  }

  // ❌ REMOVED: Old ConfigurationCacheManager code
  // const { configurationCache } = await import("../cache/ConfigurationCacheManager");
  // let cachedConfig = configurationCache.getAllConfigurations();
```

---

### 4. BusinessRuleValidator.js - Constructor Changes

**Location**: Lines 39-75

```javascript
export class BusinessRuleValidator {
  constructor() {
    this.initialized = false;
    this.status = "idle";
    this.validationHistory = [];
    this.correctionStrategies = new Map();
    this.metrics = {
      validationsPerformed: 0,
      violationsFound: 0,
      correctionsApplied: 0,
      successRate: 0,
    };

    // ✅ NEW: Real-time settings provider (replaces ConfigurationService)
    this.settingsProvider = null;
    this.configService = null;
    this.restaurantId = null;
    this.configurationCache = new Map();
    this.lastConfigRefresh = 0;
    this.configRefreshInterval = 5 * 60 * 1000; // 5 minutes

    // Initialize correction strategies
    this.initializeCorrectionStrategies();
  }

  /**
   * ✅ NEW: Set settings provider for real-time configuration access
   * @param {Object} provider - Settings provider with getSettings() method
   */
  setSettingsProvider(provider) {
    if (!provider || typeof provider.getSettings !== "function") {
      throw new Error(
        "Invalid settings provider - must have getSettings() method",
      );
    }
    this.settingsProvider = provider;
    console.log("✅ BusinessRuleValidator: Settings provider configured");
  }
```

---

### 5. BusinessRuleValidator.js - Initialize Method Changes

**Location**: Lines 81-143

```javascript
async initialize(options = {}) {
  try {
    this.options = {
      strictValidation: true,
      allowPartialCorrection: true,
      prioritizeStaffSatisfaction: true,
      prioritizeOperationalNeeds: true,
      maxCorrectionAttempts: 3,
      ...options,
    };

    // ✅ NEW: Set settings provider if provided
    if (options.settingsProvider) {
      this.setSettingsProvider(options.settingsProvider);
    }

    // Extract restaurant ID for configuration service (legacy fallback)
    this.restaurantId = options.restaurantId;

    // Initialize configuration service if restaurant ID provided (legacy path)
    if (this.restaurantId && !this.settingsProvider) {
      try {
        // Initialize constraint engine configuration
        this.configService = await initializeConstraintConfiguration(
          this.restaurantId,
        );

        if (!this.configService) {
          console.warn(
            "⚠️ Configuration service not available, using fallback static configuration",
          );
        } else {
          console.log(
            "✅ Configuration service integrated with BusinessRuleValidator",
          );
        }
      } catch (error) {
        console.warn(
          "⚠️ Configuration service initialization failed, using static fallback:",
          error,
        );
        this.configService = null;
      }
    }

    // ✅ MODIFIED: Load dynamic configurations (only if not using settings provider)
    if (!this.settingsProvider) {
      await this.refreshConfiguration();
    } else {
      console.log(
        "✅ Using real-time settings provider (skipping legacy config refresh)",
      );
    }

    this.initialized = true;
    this.status = "ready";
    console.log("✅ BusinessRuleValidator initialized");
  } catch (error) {
    this.status = "error";
    console.error("❌ BusinessRuleValidator initialization failed:", error);
    throw error;
  }
}
```

---

### 6. BusinessRuleValidator.js - New Helper Method

**Location**: Lines 157-184

```javascript
/**
 * ✅ NEW: Get live settings from settings provider or fallback to cached configuration
 * @returns {Object} Live settings object
 */
getLiveSettings() {
  if (this.settingsProvider) {
    try {
      const settings = this.settingsProvider.getSettings();
      return {
        staffGroups: settings.staffGroups || [],
        dailyLimits: settings.dailyLimits || DAILY_LIMITS,
        monthlyLimits: settings.monthlyLimits || {},
        priorityRules: settings.priorityRules || PRIORITY_RULES,
      };
    } catch (error) {
      console.warn(
        "⚠️ Failed to get live settings, using cached config:",
        error.message,
      );
    }
  }

  // Fallback to cached configuration (legacy path)
  return {
    staffGroups:
      this.configurationCache.get("staffGroups") || STAFF_CONFLICT_GROUPS,
    dailyLimits: this.configurationCache.get("dailyLimits") || DAILY_LIMITS,
    monthlyLimits: this.configurationCache.get("monthlyLimits") || {},
    priorityRules:
      this.configurationCache.get("priorityRules") || PRIORITY_RULES,
  };
}
```

---

### 7. BusinessRuleValidator.js - Method Updates

#### A. calculateStaffSatisfaction() - Line 591-592

```javascript
// ❌ BEFORE:
const priorityRules = this.configurationCache.get("priorityRules") || PRIORITY_RULES;

// ✅ AFTER:
const liveSettings = this.getLiveSettings();
const priorityRules = liveSettings.priorityRules;
```

#### B. applyPriorityRules() - Line 1010-1012

```javascript
// ❌ BEFORE:
const priorityRules = this.configurationCache.get("priorityRules") || PRIORITY_RULES;

// ✅ AFTER:
const liveSettings = this.getLiveSettings();
const priorityRules = liveSettings.priorityRules;
```

#### C. distributeOffDays() - Line 1073-1082

```javascript
// ❌ BEFORE:
const cachedMonthlyLimits = this.configurationCache.get("monthlyLimits");
const monthLimits = cachedMonthlyLimits || (await getMonthlyLimits(...));
const dailyLimits = this.configurationCache.get("dailyLimits") || DAILY_LIMITS;

// ✅ AFTER:
const liveSettings = this.getLiveSettings();
const monthLimits = liveSettings.monthlyLimits || (await getMonthlyLimits(...));
const dailyLimits = liveSettings.dailyLimits;
```

#### D. applyCoverageCompensation() - Line 1126-1128

```javascript
// ❌ BEFORE:
const staffGroups = this.configurationCache.get("staffGroups") || STAFF_CONFLICT_GROUPS;

// ✅ AFTER:
const liveSettings = this.getLiveSettings();
const staffGroups = liveSettings.staffGroups;
```

#### E. applyFinalAdjustments() - Line 1166-1168

```javascript
// ❌ BEFORE:
const dailyLimits = this.configurationCache.get("dailyLimits") || DAILY_LIMITS;

// ✅ AFTER:
const liveSettings = this.getLiveSettings();
const dailyLimits = liveSettings.dailyLimits;
```

#### F. calculatePreferenceCompliance() - Line 1522-1523

```javascript
// ❌ BEFORE:
const priorityRules = this.configurationCache.get("priorityRules") || PRIORITY_RULES;

// ✅ AFTER:
const liveSettings = this.getLiveSettings();
const priorityRules = liveSettings.priorityRules;
```

---

## Integration Example

### Complete Usage Flow

```javascript
// 1. Import the AI system
import { HybridPredictor } from './ai/hybrid/HybridPredictor';
import { useSettingsData } from './hooks/useSettingsData';

// 2. In your React component
function YourComponent() {
  const settingsData = useSettingsData();
  const hybridPredictorRef = useRef(null);

  useEffect(() => {
    async function initializeAI() {
      // Create predictor instance
      const predictor = new HybridPredictor();

      // ✅ IMPORTANT: Set settings provider BEFORE initialize()
      predictor.setSettingsProvider({
        getSettings: () => settingsData.getSettings()
      });

      // Initialize with options
      await predictor.initialize({
        ml: {
          modelType: 'advanced',
          learningRate: 0.001
        },
        rules: {
          strictValidation: true,
          maxCorrectionAttempts: 5
        }
      });

      hybridPredictorRef.current = predictor;
    }

    initializeAI();
  }, [settingsData]);

  // 3. Use the predictor with live settings
  const handlePredict = async () => {
    if (!hybridPredictorRef.current) return;

    const predictions = await hybridPredictorRef.current.predictSchedule(
      inputData,
      staffMembers,
      dateRange
    );

    console.log('Predictions using live settings:', predictions);
  };
}
```

---

## Settings Provider Interface

```typescript
interface SettingsProvider {
  getSettings(): {
    staffGroups: Array<{
      name: string;
      members: string[];
      rule: string;
      coverageRule?: {
        backupStaff: string;
        mode: string;
      };
    }>;

    dailyLimits: {
      maxOffPerDay: number;
      minWorkingStaffPerDay: number;
      earlyShiftLimit?: number;
      lateShiftLimit?: number;
    };

    monthlyLimits: {
      maxOffDaysPerMonth: number;
      minWorkDaysPerMonth?: number;
    };

    priorityRules: {
      [staffIdentifier: string]: {
        preferredShifts: Array<{
          day: string;
          shift: string;
        }>;
        priority?: number;
      };
    };
  };
}
```

---

## Verification Steps

### 1. Check Settings Provider is Connected
```javascript
console.log('Settings provider:', hybridPredictor.settingsProvider);
// Should output: { getSettings: [Function] }
```

### 2. Verify Live Settings Access
```javascript
const settings = hybridPredictor.settingsProvider.getSettings();
console.log('Live settings:', settings);
// Should output current settings from WebSocket
```

### 3. Test Settings Updates
```javascript
// Update settings in UI
updateSettings({ staffGroups: [...] });

// Immediately call predict - should use new settings
const predictions = await hybridPredictor.predictSchedule(...);
```

### 4. Check Console Logs
Look for these messages:
- ✅ HybridPredictor: Settings provider configured
- ✅ BusinessRuleValidator: Settings provider configured
- ⚡ Using live settings from WebSocket (real-time configuration)
- ✅ Using real-time settings provider (skipping legacy config refresh)

---

## Error Handling

### Missing Settings Provider
```javascript
// Warning logged if no settings provider set
⚠️ No settings provider configured - call setSettingsProvider() first

// Falls back to default configuration
✅ Using default configuration (cache not ready yet)
```

### Settings Provider Failure
```javascript
// Warning logged if getSettings() throws error
⚠️ Failed to get live settings, using defaults: [error message]

// Falls back to cached configuration or static defaults
```

### Invalid Settings Provider
```javascript
// Error thrown if provider doesn't have getSettings() method
❌ Invalid settings provider - must have getSettings() method
```

---

**Status**: All code changes complete and documented
**Files Modified**: 2 (HybridPredictor.js, BusinessRuleValidator.js)
**Lines Changed**: ~150 lines across both files
**Breaking Changes**: None (backward compatible)
