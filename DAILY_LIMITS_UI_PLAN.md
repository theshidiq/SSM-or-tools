# Daily Limits UI Configuration - Comprehensive Implementation Plan

**Version**: 1.0
**Date**: 2025-11-24
**Status**: PENDING REVIEW
**Estimated Time**: 3-4 hours

---

## 📋 Executive Summary

This plan adds a user-friendly UI for configuring **Daily Limits** (per-date constraints) in the Settings Modal. Currently, daily limits are hardcoded in `ConstraintEngine.js` and cannot be adjusted by users. This implementation will:

1. ✅ Rename "Weekly Limits" tab → "Limits" tab
2. ✅ Add a new "Daily Limits" section with slider controls
3. ✅ Make daily limits configurable and persistent
4. ✅ Integrate with existing AI generation system
5. ✅ Maintain backward compatibility

### User Requirements
- **Max staff off per day**: Default 3, max value 4 (slider)
- **Max early shifts per day**: Default 2, max value 2 (slider)
- **Max late shifts per day**: Default 3, max value 3 (slider)

---

## 🎯 Current State Analysis

### Current Implementation

#### 1. **Daily Limits - Hardcoded in ConstraintEngine.js**
```javascript
// Location: src/ai/constraints/ConstraintEngine.js:246-251
const STATIC_DAILY_LIMITS = {
  maxOffPerDay: 4,        // ❌ Hardcoded - cannot be changed by user
  maxEarlyPerDay: 4,      // ❌ Hardcoded - cannot be changed by user
  maxLatePerDay: 3,       // ❌ Hardcoded - cannot be changed by user
  minWorkingStaffPerDay: 3, // ❌ Hardcoded - not exposed in plan
};
```

**Problem**: Users cannot adjust these limits without modifying code.

#### 2. **Weekly Limits - Configurable via UI**
```javascript
// Location: src/components/settings/tabs/WeeklyLimitsTab.jsx
// ✅ Already has full CRUD UI for weekly limits (rolling 7-day windows)
// ✅ Stored in settings.weeklyLimits array
// ✅ Validated in real-time
```

#### 3. **Settings Modal Structure**
```javascript
// Location: src/components/settings/SettingsModal.jsx:40-47
const TABS = [
  { id: "staff-groups", label: "Staff Groups", icon: "👥" },
  { id: "daily-limits", label: "Weekly Limits", icon: "📅" }, // ⚠️ ID doesn't match label
  { id: "priority-rules", label: "Priority Rules", icon: "⭐" },
  { id: "early-shift", label: "Early Shift", icon: "△" },
  { id: "ml-parameters", label: "ML Parameters", icon: "🤖" },
  { id: "periods", label: "Periods", icon: "📆" },
  { id: "data-migration", label: "Data Migration", icon: "🔄" },
];
```

**Confusion**: Tab ID is `daily-limits` but label is "Weekly Limits" and it shows `<WeeklyLimitsTab />` component.

#### 4. **Data Storage - ConfigurationService**
```javascript
// Location: src/services/ConfigurationService.js:472-521
weeklyLimits: [
  {
    id: "daily-limit-off",         // ⚠️ Confusing naming
    name: "Maximum Off Days",
    shiftType: "off",
    maxCount: 4,                   // This is a DAILY limit, not weekly
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    scope: "all",
    targetIds: [],
    isHardConstraint: true,
    penaltyWeight: 50,
    description: "Maximum number of staff that can be off per day"
  },
  // ... more items that are actually daily limits
]
```

**Confusion**: Daily limits are stored in `weeklyLimits` array with IDs like `daily-limit-off`.

---

## 🎨 Proposed Solution

### Phase 1: Data Structure Separation

#### 1.1 Create New `dailyLimits` Object in Settings
```javascript
// New structure in ConfigurationService.js
dailyLimits: {
  maxOffPerDay: 3,        // Default: 3, Max: 4
  maxEarlyPerDay: 2,      // Default: 2, Max: 2
  maxLatePerDay: 3,       // Default: 3, Max: 3
  minWorkingStaffPerDay: 3, // Fixed - not configurable in Phase 1
}
```

**Rationale**: Simple object structure (not array) since these are global constraints, not per-staff or per-day-of-week rules.

#### 1.2 Rename Tab and Component
```diff
// SettingsModal.jsx:40-47
const TABS = [
  { id: "staff-groups", label: "Staff Groups", icon: "👥" },
- { id: "daily-limits", label: "Weekly Limits", icon: "📅" },
+ { id: "limits", label: "Limits", icon: "📅" },
  { id: "priority-rules", label: "Priority Rules", icon: "⭐" },
  ...
];

// Rename component file
- src/components/settings/tabs/WeeklyLimitsTab.jsx
+ src/components/settings/tabs/LimitsTab.jsx
```

**Rationale**: "Limits" is more general and can encompass both weekly and daily limits.

---

### Phase 2: UI Implementation

#### 2.1 Component Structure - LimitsTab.jsx

```
┌─────────────────────────────────────────────────────────────┐
│  LIMITS CONFIGURATION                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 📅 DAILY LIMITS (Per Date)                         │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │                                                     │  │
│  │  Max Staff Off Per Day                             │  │
│  │  [====●-------] 3 / 4                              │  │
│  │  Maximum number of staff that can be off per day   │  │
│  │                                                     │  │
│  │  Max Early Shifts Per Day                          │  │
│  │  [====●] 2 / 2                                      │  │
│  │  Maximum number of staff on early shifts per day   │  │
│  │                                                     │  │
│  │  Max Late Shifts Per Day                           │  │
│  │  [====●-------] 3 / 3                              │  │
│  │  Maximum number of staff on late shifts per day    │  │
│  │                                                     │  │
│  │  [💾 Save Changes]  [🔄 Reset to Defaults]         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 📊 WEEKLY LIMITS (Rolling 7-Day Windows)           │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  [Existing weekly limits UI - unchanged]            │  │
│  │  - Maximum Off Days (per week)                      │  │
│  │  - Maximum Early Shifts (per week)                  │  │
│  │  - etc.                                             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 📆 MONTHLY LIMITS (Per Staff Member)                │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │  [Existing monthly limits UI - unchanged]            │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Daily Limits Section - Component Code

```jsx
// src/components/settings/tabs/LimitsTab.jsx

const DailyLimitsSection = ({ dailyLimits, onUpdate }) => {
  const [localLimits, setLocalLimits] = useState(dailyLimits);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSliderChange = (field, value) => {
    setLocalLimits({ ...localLimits, [field]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await onUpdate(localLimits);
      setHasChanges(false);
      toast.success("Daily limits updated successfully");
    } catch (error) {
      toast.error("Failed to update daily limits");
    }
  };

  const handleReset = () => {
    const defaults = {
      maxOffPerDay: 3,
      maxEarlyPerDay: 2,
      maxLatePerDay: 3,
    };
    setLocalLimits(defaults);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📅 Daily Limits (Per Date)
        </CardTitle>
        <p className="text-sm text-gray-600">
          Configure maximum number of staff per shift type on any single day
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max Off Days Slider */}
        <Slider
          label="Max Staff Off Per Day"
          value={localLimits.maxOffPerDay}
          min={0}
          max={4}
          step={1}
          onChange={(value) => handleSliderChange("maxOffPerDay", value)}
          colorScheme="red"
          showValue={true}
          unit=" staff"
          description="Maximum number of staff that can be off (×) on any single day"
        />

        {/* Max Early Shifts Slider */}
        <Slider
          label="Max Early Shifts Per Day"
          value={localLimits.maxEarlyPerDay}
          min={0}
          max={2}
          step={1}
          onChange={(value) => handleSliderChange("maxEarlyPerDay", value)}
          colorScheme="orange"
          showValue={true}
          unit=" staff"
          description="Maximum number of staff on early shifts (△) on any single day"
        />

        {/* Max Late Shifts Slider */}
        <Slider
          label="Max Late Shifts Per Day"
          value={localLimits.maxLatePerDay}
          min={0}
          max={3}
          step={1}
          onChange={(value) => handleSliderChange("maxLatePerDay", value)}
          colorScheme="purple"
          showValue={true}
          unit=" staff"
          description="Maximum number of staff on late shifts (◇) on any single day"
        />

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-2"
          >
            💾 Save Changes
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            🔄 Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### 2.3 Slider Specifications

| Field | Default | Min | Max | Step | Color | Description |
|-------|---------|-----|-----|------|-------|-------------|
| `maxOffPerDay` | 3 | 0 | 4 | 1 | red | Max staff off (×) per day |
| `maxEarlyPerDay` | 2 | 0 | 2 | 1 | orange | Max early shifts (△) per day |
| `maxLatePerDay` | 3 | 0 | 3 | 1 | purple | Max late shifts (◇) per day |

**Color Scheme Rationale**:
- 🔴 **Red** (off days) - Signifies "stop" / "absence"
- 🟠 **Orange** (early shifts) - Morning/sunrise association
- 🟣 **Purple** (late shifts) - Evening/night association

---

### Phase 3: Data Integration

#### 3.1 Update ConfigurationService

```javascript
// src/services/ConfigurationService.js

// Add to getDefaultSettings() function
getDefaultSettings: () => {
  return {
    // ... existing settings ...

    // NEW: Separate daily limits object
    dailyLimits: {
      maxOffPerDay: 3,        // User requirement: Default 3, max 4
      maxEarlyPerDay: 2,      // User requirement: Default 2, max 2
      maxLatePerDay: 3,       // User requirement: Default 3, max 3
      minWorkingStaffPerDay: 3, // Keep for AI, not exposed in UI yet
    },

    weeklyLimits: [
      // Keep existing weekly limits (rolling 7-day windows)
      // Remove daily limit items (daily-limit-off, daily-limit-early, etc.)
    ],

    monthlyLimits: [
      // Keep existing monthly limits
    ],
  };
},

// Add getter/setter methods
getDailyLimits: () => {
  const settings = loadSettings();
  return settings.dailyLimits || {
    maxOffPerDay: 3,
    maxEarlyPerDay: 2,
    maxLatePerDay: 3,
    minWorkingStaffPerDay: 3,
  };
},

updateDailyLimits: (dailyLimits) => {
  const settings = loadSettings();
  settings.dailyLimits = {
    ...settings.dailyLimits,
    ...dailyLimits,
  };
  saveSettings(settings);
  invalidateCache("daily_limits"); // Trigger re-validation
  return settings.dailyLimits;
},
```

#### 3.2 Update ConstraintEngine

```javascript
// src/ai/constraints/ConstraintEngine.js:246-251

// BEFORE (Hardcoded):
const STATIC_DAILY_LIMITS = {
  maxOffPerDay: 4,
  maxEarlyPerDay: 4,
  maxLatePerDay: 3,
  minWorkingStaffPerDay: 3,
};

// AFTER (Dynamic):
// Remove STATIC_DAILY_LIMITS constant
// getDailyLimits() already exists (line 291-293) - just use it
export const getDailyLimits = async () => {
  return await getCachedConfig("daily_limits");
};

// Update validateDailyLimits() to use dynamic limits
export const validateDailyLimits = async (schedule, staffMembers, dateRange) => {
  const dailyLimits = await getDailyLimits(); // Get from config
  // ... rest of validation logic uses dailyLimits
};
```

#### 3.3 Update SettingsContext

```javascript
// src/contexts/SettingsContext.js

// Add dailyLimits to settings state
const [settings, setSettings] = useState({
  staffGroups: [],
  weeklyLimits: [],
  monthlyLimits: [],
  dailyLimits: {}, // NEW
  priorityRules: [],
  mlParameters: {},
});

// Add update method
const updateDailyLimits = async (dailyLimits) => {
  const updated = await ConfigurationService.updateDailyLimits(dailyLimits);
  setSettings({ ...settings, dailyLimits: updated });
};

// Expose in context
return (
  <SettingsContext.Provider value={{
    settings,
    updateSettings,
    updateDailyLimits, // NEW
    // ... other methods
  }}>
    {children}
  </SettingsContext.Provider>
);
```

---

### Phase 4: Backward Compatibility & Migration

#### 4.1 Data Migration

```javascript
// ConfigurationService.js - Add migration v4

const MIGRATION_VERSION = 4; // Increment from current version

const migrations = {
  // ... existing v1, v2, v3 migrations ...

  4: (settings) => {
    console.log("Running migration v4: Extract daily limits from weeklyLimits");

    // Extract daily limits from weeklyLimits array
    const dailyLimitIds = [
      "daily-limit-off",
      "daily-limit-early",
      "daily-limit-late",
      "daily-limit-min-working",
    ];

    // Find existing daily limits in weeklyLimits
    const dailyLimitItems = settings.weeklyLimits?.filter(
      (limit) => dailyLimitIds.includes(limit.id)
    ) || [];

    // Create dailyLimits object
    settings.dailyLimits = {
      maxOffPerDay: dailyLimitItems.find(l => l.id === "daily-limit-off")?.maxCount || 3,
      maxEarlyPerDay: dailyLimitItems.find(l => l.id === "daily-limit-early")?.maxCount || 2,
      maxLatePerDay: dailyLimitItems.find(l => l.id === "daily-limit-late")?.maxCount || 3,
      minWorkingStaffPerDay: dailyLimitItems.find(l => l.id === "daily-limit-min-working")?.maxCount || 3,
    };

    // Remove daily limits from weeklyLimits array
    settings.weeklyLimits = settings.weeklyLimits?.filter(
      (limit) => !dailyLimitIds.includes(limit.id)
    ) || [];

    console.log("✅ Migration v4 complete: Daily limits extracted", settings.dailyLimits);
    return settings;
  },
};
```

#### 4.2 Fallback Strategy

```javascript
// If dailyLimits is undefined/missing, use defaults
const getDailyLimits = () => {
  const settings = loadSettings();

  if (!settings.dailyLimits) {
    console.warn("⚠️ dailyLimits not found in settings, using defaults");
    return {
      maxOffPerDay: 3,
      maxEarlyPerDay: 2,
      maxLatePerDay: 3,
      minWorkingStaffPerDay: 3,
    };
  }

  return settings.dailyLimits;
};
```

---

## 📝 Implementation Checklist

### File Modifications Required

| File | Changes | Status |
|------|---------|--------|
| `SettingsModal.jsx` | Rename tab: "Weekly Limits" → "Limits" | ⏳ TODO |
| `WeeklyLimitsTab.jsx` | Rename file → `LimitsTab.jsx` | ⏳ TODO |
| `LimitsTab.jsx` | Add Daily Limits section with sliders | ⏳ TODO |
| `ConfigurationService.js` | Add `dailyLimits` object, migration v4 | ⏳ TODO |
| `SettingsContext.js` | Add `updateDailyLimits()` method | ⏳ TODO |
| `ConstraintEngine.js` | Remove `STATIC_DAILY_LIMITS`, use dynamic | ⏳ TODO |
| `ScheduleGenerator.js` | Verify uses `getDailyLimits()` | ⏳ TODO |
| `BusinessRuleValidator.js` | Verify uses `getDailyLimits()` | ⏳ TODO |

### Implementation Steps

#### Step 1: Data Structure (30 minutes)
1. ✅ Add `dailyLimits` object to `ConfigurationService.getDefaultSettings()`
2. ✅ Add `getDailyLimits()` and `updateDailyLimits()` methods
3. ✅ Add migration v4 to extract daily limits from weeklyLimits
4. ✅ Update `SettingsContext` to expose `dailyLimits`
5. ✅ Test migration runs correctly on app load

#### Step 2: UI Component (60 minutes)
1. ✅ Rename `WeeklyLimitsTab.jsx` → `LimitsTab.jsx`
2. ✅ Create `DailyLimitsSection` component with 3 sliders
3. ✅ Add state management for local changes
4. ✅ Add Save and Reset buttons
5. ✅ Add toast notifications for success/error
6. ✅ Test slider interactions

#### Step 3: Integration (30 minutes)
1. ✅ Update `SettingsModal.jsx` tab label
2. ✅ Update all imports from `WeeklyLimitsTab` → `LimitsTab`
3. ✅ Connect `DailyLimitsSection` to `updateDailyLimits()`
4. ✅ Test save/load functionality
5. ✅ Test settings persistence across page reloads

#### Step 4: Constraint System (30 minutes)
1. ✅ Remove `STATIC_DAILY_LIMITS` from `ConstraintEngine.js`
2. ✅ Verify `validateDailyLimits()` uses `getDailyLimits()`
3. ✅ Update `ScheduleGenerator` if needed
4. ✅ Test AI generation respects new limits
5. ✅ Test validation detects violations

#### Step 5: Validation & Testing (45 minutes)
1. ✅ Implement real-time validation when saving limits
2. ✅ Show violation warnings modal with details
3. ✅ Provide "Accept & Fix" or "Cancel" options
4. ✅ Test new user experience (fresh install)
5. ✅ Test migration from old settings format
6. ✅ Test slider behavior (min/max bounds)
7. ✅ Test AI generation with different limit values
8. ✅ Test settings reset to defaults
9. ✅ Test validation errors display correctly

#### Step 6: Documentation (30 minutes)
1. ✅ Update CLAUDE.md with new UI structure
2. ✅ Add inline comments to new code
3. ✅ Update architecture diagrams if needed
4. ✅ Create user guide for daily limits configuration

**Total Estimated Time**: 3-4 hours

---

## 🧪 Testing Strategy

### Unit Tests
```javascript
// ConfigurationService.test.js
describe("Daily Limits Configuration", () => {
  it("should return default daily limits", () => {
    const limits = ConfigurationService.getDailyLimits();
    expect(limits).toEqual({
      maxOffPerDay: 3,
      maxEarlyPerDay: 2,
      maxLatePerDay: 3,
      minWorkingStaffPerDay: 3,
    });
  });

  it("should update daily limits", () => {
    const newLimits = { maxOffPerDay: 4, maxEarlyPerDay: 1, maxLatePerDay: 2 };
    ConfigurationService.updateDailyLimits(newLimits);
    const updated = ConfigurationService.getDailyLimits();
    expect(updated.maxOffPerDay).toBe(4);
    expect(updated.maxEarlyPerDay).toBe(1);
    expect(updated.maxLatePerDay).toBe(2);
  });

  it("should migrate daily limits from weeklyLimits array", () => {
    const oldSettings = {
      weeklyLimits: [
        { id: "daily-limit-off", maxCount: 4 },
        { id: "daily-limit-early", maxCount: 3 },
      ],
    };
    const migrated = migrations[4](oldSettings);
    expect(migrated.dailyLimits.maxOffPerDay).toBe(4);
    expect(migrated.dailyLimits.maxEarlyPerDay).toBe(3);
    expect(migrated.weeklyLimits).not.toContainEqual(
      expect.objectContaining({ id: "daily-limit-off" })
    );
  });
});
```

### Integration Tests
1. **Test Slider → Save → Load cycle**
   - Change slider values
   - Save changes
   - Reload page
   - Verify values persist

2. **Test AI Generation respects limits**
   - Set `maxOffPerDay = 2`
   - Generate schedule
   - Verify no date has > 2 staff off

3. **Test Validation detects violations**
   - Manually create schedule with 4 staff off
   - Set `maxOffPerDay = 3`
   - Run validation
   - Verify violation detected

### User Acceptance Testing
1. **Fresh Install**: App loads with default limits (3/2/3)
2. **Migration**: Existing users' settings migrate correctly
3. **UI Usability**: Sliders are intuitive and responsive
4. **Error Handling**: Clear error messages if save fails
5. **Performance**: No lag when adjusting sliders

---

## 🎨 UI/UX Design Details

### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  Primary Level: Card with title "Daily Limits"             │
│  ├─ Secondary Level: Individual slider sections             │
│  │  ├─ Label: "Max Staff Off Per Day"                      │
│  │  ├─ Slider: Visual feedback with color                  │
│  │  └─ Description: Explanatory text                       │
│  └─ Action Level: Save/Reset buttons                       │
└─────────────────────────────────────────────────────────────┘
```

### Color Scheme
- **Off Days (×)**: Red (`colorScheme="red"`) - High impact
- **Early Shifts (△)**: Orange (`colorScheme="orange"`) - Medium impact
- **Late Shifts (◇)**: Purple (`colorScheme="purple"`) - Medium impact

### Accessibility
- ✅ Slider has ARIA labels
- ✅ Keyboard navigation supported (arrow keys)
- ✅ Color contrast meets WCAG AA standards
- ✅ Touch targets ≥ 44px for mobile
- ✅ Screen reader compatible

### Responsive Design
- **Desktop**: 3 sliders in single column, full width
- **Tablet**: Same layout, slightly narrower
- **Mobile**: Sliders stack vertically, full width

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing schedules | High | Low | Migration script + fallback defaults |
| UI performance issues | Medium | Low | React.memo() + useCallback() |
| Validation inconsistencies | High | Medium | Comprehensive test suite |
| User confusion with naming | Medium | Medium | Clear labels + descriptions |
| Backward compatibility issues | High | Low | Migration v4 + version checking |

---

## 📊 Success Metrics

### Functional Requirements
- ✅ Sliders update state correctly (min/max bounds enforced)
- ✅ Save button persists changes to localStorage + Supabase
- ✅ AI generation respects configured limits
- ✅ Validation detects limit violations
- ✅ Settings survive page reload

### Performance Requirements
- ✅ Slider response time < 50ms
- ✅ Save operation completes < 1 second
- ✅ Migration runs < 500ms on app load
- ✅ No memory leaks from slider re-renders

### User Experience Requirements
- ✅ Intuitive UI - no training needed
- ✅ Visual feedback for changes
- ✅ Clear error messages
- ✅ Mobile-friendly touch targets
- ✅ Consistent with existing settings tabs

---

## 🔄 Future Enhancements (Not in This Plan)

1. **~~Min Working Staff Configuration~~** ❌ NOT NEEDED
   - Automatically calculated: `totalStaff - maxOff - maxEarly - maxLate = working staff`
   - No separate slider needed per user confirmation

2. **Per-Day-of-Week Limits**
   - Different limits for weekends vs weekdays

3. **Per-Staff-Group Limits**
   - Different limits for different departments

4. **Visual Schedule Preview**
   - Real-time preview showing how limits affect schedule

5. **Bulk Limit Templates**
   - Pre-configured limit sets (e.g., "Holiday Mode", "Low Staffing")

6. **Export/Import Limit Configurations**
   - Share limit settings between users

---

## 📝 Implementation Notes

### Naming Conventions
- Component: `DailyLimitsSection`
- State variable: `dailyLimits`
- Config key: `dailyLimits`
- Function: `updateDailyLimits()`
- Migration: `v4` (extract daily limits from weeklyLimits)

### Dependencies
- **No new dependencies** - uses existing:
  - `Slider` component (already exists)
  - `Card`, `CardHeader`, `CardContent` (shadcn/ui)
  - `Button`, `toast` (existing UI components)

### Code Style
- Follow existing project conventions
- Use functional components + hooks
- Prefer `const` over `let`
- Add JSDoc comments for complex logic
- Use descriptive variable names

---

## 🎯 Acceptance Criteria

**This implementation is complete when:**

1. ✅ User can open Settings Modal → Limits tab
2. ✅ User sees "Daily Limits" section with 3 sliders
3. ✅ User can adjust sliders within specified ranges
4. ✅ User can save changes successfully
5. ✅ User can reset to defaults
6. ✅ Changes persist across page reloads
7. ✅ AI generation respects configured limits
8. ✅ Validation detects violations correctly
9. ✅ Migration runs automatically for existing users
10. ✅ No console errors or warnings

---

## 📅 Timeline

**Estimated Duration**: 3-4 hours (single work session)

**Breakdown**:
- ⏱️ 30 min - Data structure setup
- ⏱️ 60 min - UI component development
- ⏱️ 30 min - Integration
- ⏱️ 30 min - Constraint system updates
- ⏱️ 30 min - Testing
- ⏱️ 30 min - Documentation

**Dependencies**: None - can start immediately after approval

---

## 💬 User Confirmations ✅ APPROVED

All questions confirmed by user on 2025-11-24:

1. ✅ **Slider Ranges**: CONFIRMED
   - Max off per day: 4 ✓
   - Max early per day: 2 ✓
   - Max late per day: 3 ✓

2. ✅ **Default Values**: CONFIRMED
   - Default off: 3 ✓
   - Default early: 2 ✓
   - Default late: 3 ✓

3. ✅ **Min Working Staff**: NOT NEEDED (automatically calculated)
   - User: "when the max is set up its automatically count for the worker right"
   - Decision: No separate slider needed ✓

4. ✅ **Section Order**: CONFIRMED
   - Order: Daily → Weekly → Monthly ✓

5. ✅ **Validation Feedback**: CONFIRMED YES
   - Show real-time validation warnings when limits change
   - Example: "⚠️ 5 staff off on Dec 31 exceeds new limit (3)"
   - Provide options: Accept & auto-fix OR Cancel changes ✓

---

## 📚 References

### Related Files
- `src/components/settings/tabs/WeeklyLimitsTab.jsx` - Current implementation
- `src/components/settings/shared/Slider.jsx` - Slider component
- `src/services/ConfigurationService.js` - Data persistence
- `src/ai/constraints/ConstraintEngine.js` - Validation logic
- `src/contexts/SettingsContext.js` - Global state management

### Related Documentation
- `CLAUDE.md` - Project guidelines
- `AI_ARCHITECTURE_INDEX.md` - AI system architecture
- `FILE_LOCATIONS.md` - File organization

---

## ✅ Next Steps

**After Review & Approval**:
1. Address any questions/feedback from review
2. Begin implementation (Step 1: Data Structure)
3. Commit changes incrementally with descriptive messages
4. Test each phase before moving to next
5. Final integration testing
6. Update documentation
7. Request user acceptance testing

**Ready to proceed?** Please review this plan and provide feedback! 🚀
