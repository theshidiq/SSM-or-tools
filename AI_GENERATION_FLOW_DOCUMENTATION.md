# AI Schedule Generation Flow: Complete Documentation

**Document Version:** 1.5
**Last Updated:** 2025-12-06
**Status:** Complete Reference Guide (Phase 6.5 Enhanced)
**Investigation Level:** Very Thorough

**Phase 6.5 Changes (Latest):**
- Added `FINAL-OVERRIDE` step in `HybridPredictor.predictSchedule()` (Step 7)
- Calendar rules now run as the ABSOLUTE FINAL step, AFTER backup staff assignments
- This ensures backup staff (like パート workers configured as backup) respect must_day_off rules
- The override applies to ALL staff, including backup staff managed by BackupStaffService
- Early shift (△) on must_day_off dates is preserved (user confirmed this is correct behavior)
- Location: `HybridPredictor.js` lines 526-579

**Phase 6.3 Changes:**
- Added `MIN-ENFORCE-EARLY` pre-pass in `distributeOffDays()` to enforce MIN daily limits EARLY
- MIN enforcement now runs BEFORE random distribution and BEFORE △ assignments
- Only checks `××` consecutive pattern (not `△×`) to avoid blocking × after △
- Prioritizes dates with fewer offs, shuffles eligible staff for fair distribution
- This fixes the issue where BALANCE phase couldn't meet MIN because all staff had △ on previous day

**Phase 6.2 Changes:**
- Added `enforce5DayRestAfterBalance()` method to fix >5 consecutive work days violations
- Added `breakWorkStreak()` helper to insert × in middle of long work streaks
- Execution order: BALANCE → enforce5DayRestAfterBalance → repairConsecutiveOffDays
- Added warning logs when BALANCE cannot meet MIN daily limits (all candidates have conflicts)
- User decisions: Keep △ for early shift on must_day_off, accept under-MIN with warning

**Phase 6.1 Changes:**
- Added `wouldCreateConsecutiveOff()` helper function to prevent consecutive × during BALANCE
- BALANCE phase now has 3 constraint checks: adjacent conflict, staff group, consecutive ×
- Moved `repairConsecutiveOffDays` to run AFTER BALANCE phase (was running before Phase 3)
- This ensures all consecutive × patterns are caught, including those created by Phase 3 or BALANCE

**Phase 6.0 Changes:**
- MIN daily limit enforcement moved from HybridPredictor post-processing to BusinessRuleValidator BALANCE phase
- Uses `dailyLimitsRaw` object format instead of `dailyLimits` array format for proper database integration
- Added staff group constraint checking during MIN enforcement
- Added `wouldViolateStaffGroup()` helper function for constraint validation

---

## Executive Summary

The AI schedule generation system uses a **hybrid rule-based architecture** that combines business rule validation with calendar integration to produce shift schedules. The generation flow is a carefully orchestrated multi-phase process designed to respect labor laws, staffing requirements, and staff preferences while maintaining operational flexibility.

### Key Architecture Facts
- **Entry Point:** `useAIAssistantLazy.js` hook → `HybridPredictor.js` → `BusinessRuleValidator.generateRuleBasedSchedule()`
- **Primary Engine:** `BusinessRuleValidator.generateRuleBasedSchedule()` (1,100-1,356 lines)
- **Constraint Enforcement:** 8+ sequential rule application phases with re-enforcement between phases
- **Final Override:** Calendar rules + early shift preferences (Phase 3 integration, applied LAST)
- **Post-Generation:** Daily limit balancing (2-3 staff off per day enforcement)

### Critical Flow Principle
**Calendar rules override everything else.** The system applies must_day_off rules FIRST (PRE-PHASE) and LAST (Phase 3), ensuring no other rule can violate calendar constraints.

---

## 1. Entry Points: Where AI Generation Starts

### 1.1 Component Entry Point: `ShiftScheduleEditorPhase3.jsx`

**Location:** `src/components/ShiftScheduleEditorPhase3.jsx`

The main scheduling interface that triggers AI generation when user clicks "自動生成" (Auto-fill) button:

```javascript
// Pseudo-code of the flow
const handleAutoFill = async () => {
  // 1. Load current schedule data
  const scheduleData = getCurrentScheduleData();
  
  // 2. Get staff members
  const staffMembers = getStaffMembersFromContext();
  
  // 3. Initialize AI system
  const { generateAIPredictions, systemType } = useAIAssistantLazy(
    scheduleData,
    staffMembers,
    currentMonthIndex
  );
  
  // 4. Start generation with progress callback
  const result = await generateAIPredictions((progress) => {
    updateProgressBar(progress);
  });
  
  // 5. Apply result to schedule
  updateScheduleDisplay(result.schedule);
};
```

**Data Passed In:**
- `scheduleData`: Current schedule state (can be empty or partial)
- `staffMembers`: Array of staff member objects with id, name, status, position, department
- `currentMonthIndex`: Month index (0-11) to determine date range
- `saveSchedule`: Backend save function (WebSocket → Database)

### 1.2 Hook Entry Point: `useAIAssistantLazy.js`

**Location:** `src/hooks/useAIAssistantLazy.js` (Lines 67-612)

Lazy-loading wrapper that handles AI system initialization:

```javascript
export const useAIAssistantLazy = (
  scheduleData,
  staffMembers,
  currentMonthIndex,
  saveSchedule, // WebSocket save operation
  options = {}
) => {
  // 1. Lazy-load enhanced AI system
  const system = await loadEnhancedAISystem(); // Imports HybridPredictor
  
  // 2. Initialize HybridPredictor
  const predictor = new HybridPredictor();
  predictor.setSettingsProvider(aiSettings);
  await predictor.initialize();
  
  // 3. Load data for AI constraint processing
  const earlyShiftPreferences = await EarlyShiftPreferencesLoader.loadPreferences();
  const calendarRules = await CalendarRulesLoader.loadRules();
  
  // 4. Call AI generation with loaded data
  const result = await system.generateSchedule({
    scheduleData,
    staffMembers,
    currentMonthIndex,
    earlyShiftPreferences, // Phase 1: Early shift data
    calendarRules,          // Phase 2: Calendar rules
  });
  
  // 5. Save to backend and return
  await saveSchedule(result.schedule);
  return result;
};
```

**Key Responsibilities:**
- Lines 17-43: Load AI system modules dynamically
- Lines 45-65: Load enhanced AI system (HybridPredictor, BusinessRuleValidator)
- Lines 171-343: Initialize AI with proper settings provider
- Lines 353-555: Generate predictions with progress callbacks
- Lines 400-428: Load early shift preferences from database
- Lines 430-459: Load calendar rules from database

### 1.3 AI System Entry Point: `HybridPredictor.js`

**Location:** `src/ai/hybrid/HybridPredictor.js` (Lines 16-500+)

The high-level orchestrator that delegates to BusinessRuleValidator:

```javascript
class HybridPredictor {
  async predictSchedule(inputData, staffMembers, dateRange, onProgress) {
    // 1. ML-based prediction (if available)
    let mlSchedule = null;
    if (this.mlEngine && this.mlEngine.isReady()) {
      mlSchedule = await this.mlEngine.predictSchedule(inputData, staffMembers);
    }
    
    // 2. If ML fails or unavailable, fall back to rule-based generation
    if (!mlSchedule || !mlSchedule.success) {
      console.log('[FALLBACK] Calling generateRuleBasedSchedule...');
      
      const ruleSchedule = await this.ruleValidator.generateRuleBasedSchedule(
        inputData,        // Contains earlyShiftPreferences, calendarRules
        staffMembers,
        dateRange
      );
      
      return { success: true, schedule: ruleSchedule };
    }
    
    return { success: true, schedule: mlSchedule.predictions };
  }
}
```

**When ML is Unavailable:** Falls back to rule-based generation via `BusinessRuleValidator.generateRuleBasedSchedule()`.

---

## 2. Data Loading Phase: Collecting Inputs

Before generation starts, the system loads 5 types of configuration data from the database:

### 2.1 Calendar Rules Loading

**File:** `src/ai/utils/CalendarRulesLoader.js`

```javascript
// Called from: useAIAssistantLazy.js:443
const calendarRules = await CalendarRulesLoader.loadRules(
  restaurant.id,
  dateRange
);

// Returns: Object mapping dates to rules
// {
//   "2025-12-25": { must_day_off: true },    // Dec 25: everyone day off
//   "2026-01-01": { must_work: true },       // Jan 1: everyone must work
//   ...
// }
```

**Data Structure:**
- Maps date strings (YYYY-MM-DD) to rule objects
- `must_day_off`: When true, ALL staff get × (day off) on this date
- `must_work`: When true, ALL staff work normal shift (empty string or ○) on this date

**Impact on Generation:** Calendar rules override ALL other constraints (see Phase 3).

### 2.2 Early Shift Preferences Loading

**File:** `src/ai/utils/EarlyShiftPreferencesLoader.js`

```javascript
// Called from: useAIAssistantLazy.js:413
const earlyShiftPreferences = await EarlyShiftPreferencesLoader.loadPreferences(
  restaurant.id,
  dateRange
);

// Returns: Object mapping staff IDs to preferences
// {
//   "staff-uuid-1": { dates: ["2025-12-25", "2026-01-01", ...] },
//   "staff-uuid-2": { dates: [...] },
//   ...
// }
```

**Data Structure:**
- Maps staff ID to preference objects
- `dates`: Array of dates when this staff can/should work early shift △

**Impact on Generation:** Allows staff to override day offs on must_day_off dates (Phase 3).

### 2.3 Priority Rules Loading

**File:** `src/ai/constraints/ConstraintEngine.js` → `getPriorityRules()`

**Data Structure from Settings Provider:**

```javascript
{
  "staff-uuid-1": {
    preferredShifts: [
      { day: "monday", shift: "early" },
      { day: "friday", shift: "off" }
    ],
    avoidedShifts: [
      { day: "weekend", shift: "late" }
    ],
    exceptionsAllowed: [
      { day: "wednesday", avoidedShift: "off", allowedShifts: ["early"] }
    ]
  },
  ...
}
```

**Applied In:** `applyPriorityRules()` (Lines 1364-1596)

### 2.4 Staff Group Constraints Loading

**File:** `src/ai/constraints/ConstraintEngine.js` → `getStaffConflictGroups()`

**Data Structure:**

```javascript
[
  {
    name: "Group 1",
    members: ["staff-id-1", "staff-id-2", "staff-id-3"]
    // Rule: Only 1 member can be off/early (△ or ×) on same day
  },
  {
    name: "Group 2",
    members: ["staff-id-4", "staff-id-5"]
  },
  ...
]
```

**Applied In:** `applyStaffGroupConstraints()` (Lines 1779-1896)

### 2.5 Daily & Weekly Limits Loading

**File:** `src/ai/constraints/ConstraintEngine.js` → `getDailyLimits()`, `getMonthlyLimits()`

**Daily Limits Structure:**

```javascript
// From settings or defaults
{
  minOffPerDay: 2,      // Minimum staff off per day
  maxOffPerDay: 3,      // Maximum staff off per day
  minWorkingPerDay: 3,  // Minimum staff working per day
}
```

**Weekly Limits Structure:**

```javascript
[
  {
    shiftType: "off",
    maxCount: 1,         // Max 1 off day per week (example)
    weekPattern: "consecutive_work_days_limit"
  }
]
```

**Monthly Limits Structure:**

```javascript
{
  maxOffDaysPerMonth: 10,  // Max 10 day offs per staff per month
  minWorkDaysPerMonth: 12  // Min 12 work days per staff per month
}
```

---

## 3. Generation Flow in BusinessRuleValidator.js

### 3.1 Function Signature and Entry

**Location:** `src/ai/hybrid/BusinessRuleValidator.js` (Lines 1109-1356)

```javascript
async generateRuleBasedSchedule(inputData, staffMembers, dateRange) {
  // inputData contains:
  // - scheduleData: current/empty schedule
  // - earlyShiftPreferences: Phase 1 data
  // - calendarRules: Phase 2 data
  
  console.log("🎯 Generating rule-based schedule...");
  
  // Validation (Lines 1113-1136)
  // - Ensure staffMembers is array
  // - Ensure dateRange is array
  // - Extract Phase 3 parameters
}
```

### 3.2 PRE-PHASE: Apply Calendar must_day_off Rules (FIRST)

**Lines 1160-1184**

```javascript
// ✅ CRITICAL: Apply calendar must_day_off FIRST
// This is the highest priority - nothing else can override it

if (calendarRules && Object.keys(calendarRules).length > 0) {
  console.log("🔄 [PRE-PHASE] Applying must_day_off calendar rules...");
  
  Object.keys(calendarRules).forEach((dateKey) => {
    const rule = calendarRules[dateKey];
    
    if (rule.must_day_off) {
      // Force ALL staff to × (day off) on this date
      staffMembers.forEach((staff) => {
        schedule[staff.id][dateKey] = "×";
      });
      
      console.log(`✅ [PRE-PHASE] All staff: × on ${dateKey} (must_day_off)`);
    }
  });
}
```

**Why This Runs FIRST:**
- Calendar must_day_off rules are mandatory business rules
- Prevent later phases from assigning conflicting shifts
- Establish baseline that all other rules must respect

### 3.3 PHASE 1: Apply Priority Rules

**Lines 1186-1192 and detailed implementation Lines 1364-1596**

```javascript
// PHASE 1: Priority rules
await this.applyPriorityRules(schedule, staffMembers, dateRange);

// Re-enforce after distribution might break them
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**What Gets Applied:**

For each staff member with priority rules:

1. **Step 1: Clear Avoided Shifts** (Lines 1465-1542)
   - Find dates matching avoided shift rules
   - Remove the avoided shift (set to blank/normal)
   - OR replace with exception shift if allowed

2. **Step 2: Set Preferred Shifts** (Lines 1544-1585)
   - For each preferred shift rule and matching day of week
   - Assign the preferred shift (△, ×, ◇)
   - Check adjacent conflict constraints
   - Check daily limit constraints
   - Log each application

**Example:**
```javascript
// Rule: Staff prefers △ (early shift) on Mondays
// Rule: Staff avoids × (day off) on Fridays

// Result:
// - Monday: △ is assigned
// - Friday: × is removed (blank/normal assigned instead)
```

### 3.4 PHASE 2: Apply Staff Group Constraints

**Lines 1189-1197 and detailed implementation Lines 1779-1896**

```javascript
// Apply group constraints
await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange);

// Re-enforce priority rules (group constraints might have broken them)
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**How Staff Groups Work:**

```javascript
async applyStaffGroupConstraints(schedule, staffMembers, dateRange) {
  // For each date in the range
  dateRange.forEach((date) => {
    const dateKey = date.toISOString().split("T")[0];
    
    // For each staff group
    staffGroups.forEach((group) => {
      // Count how many members have off/early shifts (× or △)
      const offOrEarlyMembers = group.members.filter(memberId => {
        const shift = schedule[memberId][dateKey];
        return shift === "×" || shift === "△";
      });
      
      // CONSTRAINT: Only 1 member can be off/early per group per date
      if (offOrEarlyMembers.length > 1) {
        // Keep first member's shift, change rest to working
        offOrEarlyMembers.slice(1).forEach((memberId) => {
          schedule[memberId][dateKey] = ""; // Normal shift
        });
      }
    });
  });
}
```

**Critical Logic (Lines 1844-1872):**
- If 2+ members in a group have off/early shifts on same date = CONFLICT
- Keep FIRST member's shift, change others to working shift (empty string or ○)
- This ensures opposite pattern: 1 off, others work

### 3.5 PHASE 3: Distribute Off Days (Randomized)

**Lines 1194-1195 and detailed implementation Lines 1945-2415**

```javascript
// Distribute remaining off days evenly
await this.distributeOffDays(schedule, staffMembers, dateRange, calendarRules);

// Re-enforce constraints after distribution
await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange);
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**Algorithm (Lines 2056-2074):**

1. **Count existing off-days from earlier rules** (Lines 2062-2074)
   ```javascript
   // For each date, count how many staff already have ×
   const currentOffCount = staffMembers.filter(staff =>
     schedule[staff.id]?.[dateKey] === "×"
   ).length;
   
   globalOffDayCount[dateKey] = currentOffCount;
   ```

2. **For each staff member (Lines 2076+):**
   - Skip if backup-only staff (managed by BackupStaffService)
   - Calculate target off days for this month
   - Randomly distribute remaining needed off-days
   - Check daily limits (min 2, max 3 per day)
   - Check weekly limits
   - Check adjacent conflict constraints

**Randomization Detail:**

The system uses **random shuffling** to prevent predictable patterns:
```javascript
// Don't always pick same dates - shuffle available dates
const eligibleDates = availableDates.sort(() => Math.random() - 0.5);

// Pick random number of off days within limits
const offDaysToAssign = Math.floor(
  Math.random() * (maxPerMonth - minPerMonth) + minPerMonth
);
```

**This Prevents:** Clustering all off-days at start of month or always on same days.

### 3.6 PHASE 4: Enforce 5-Day Rest Constraint

**Lines 1201-1206 and detailed implementation Lines 2417-2537**

```javascript
// Enforce: No more than 5 consecutive work days
await this.enforce5DayRestConstraint(schedule, staffMembers, dateRange);

// Re-enforce constraints after rest enforcement
await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange);
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**Algorithm:**

Scan through schedule in 5-day windows:

```javascript
async enforce5DayRestConstraint(schedule, staffMembers, dateRange) {
  for (const staff of staffMembers) {
    // For each 5-day window
    for (let startIdx = 0; startIdx <= dateRange.length - 5; startIdx++) {
      const window = dateRange.slice(startIdx, startIdx + 5);
      
      // Count rest days (× or △) in this window
      let restDayCount = 0;
      window.forEach(date => {
        const shift = schedule[staff.id][dateKey];
        if (shift === "×" || shift === "△") restDayCount++;
      });
      
      // VIOLATION: Zero rest days in 5-day window
      if (restDayCount === 0) {
        console.log(`⚠️ VIOLATION: ${staff.name} has 0 rest days in window`);
        
        // Try to assign × (off day) somewhere in window
        for (const dateKey of window) {
          if (canAssignOffDay(schedule, dateKey, staffMembers)) {
            schedule[staff.id][dateKey] = "×";
            break;
          }
        }
        
        // If × violates limits, try △ (early shift) instead
        if (!assigned && staff.status === "社員") {
          for (const dateKey of window) {
            if (!hasAdjacentConflict(staff, dateKey, "△", schedule)) {
              schedule[staff.id][dateKey] = "△";
              break;
            }
          }
        }
      }
    }
  }
}
```

**Fallback Strategies:**
1. Try to assign × (off day) - respects daily limits
2. If × violates limits, try △ (early shift) - no limits on count
3. If △ has adjacent conflict, skip this window (rare)

### 3.7 PHASE 5: Apply Coverage Compensation

**Lines 1208-1211 and detailed implementation Lines 2666+**

```javascript
// Ensure backup staff coverage when primary staff is off
await this.applyCoverageCompensation(schedule, staffMembers, dateRange);

// Re-enforce priority rules
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**Purpose:** When primary staff is off, ensure backup staff is working.

### 3.8 PHASE 6: Apply Final Adjustments

**Lines 1213-1216 and detailed implementation Lines 2706+**

```javascript
// Fine-tune schedule for operational needs
await this.applyFinalAdjustments(schedule, staffMembers, dateRange);

// Final priority rules enforcement
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**Adjustments:**
- Ensure minimum staffing levels
- Fix any remaining constraint violations
- Adjust weekend coverage

### 3.9 POST-REPAIR: Fix Consecutive Off Days

**Lines 1218-1219**

```javascript
// Eliminate any consecutive off-days (pattern repair)
await this.repairConsecutiveOffDays(schedule, staffMembers, dateRange);
```

**Purpose:** Prevent staff having multiple consecutive off-days if not required.

### 3.10 PHASE 3 INTEGRATION: Calendar + Early Shift (FINAL OVERRIDE)

**Lines 1221-1242**

```javascript
// ✅ CRITICAL: Apply calendar rules + early shift preferences LAST
// This ensures calendar rules override everything else
// No other rule can violate calendar constraints

if (hasPhase3Integration) {
  console.log("[Phase 3] Applying combined calendar rules + early shift...");
  
  const combinedResult = CalendarEarlyShiftIntegrator.applyCombinedRules(
    schedule,
    calendarRules,
    earlyShiftPreferences,
    staffMembers
  );
  
  // Update schedule with Phase 3 result
  Object.assign(schedule, combinedResult.schedule);
  
  console.log("[Phase 3] Combined rules applied successfully (FINAL)");
}
```

**What CalendarEarlyShiftIntegrator Does:**

See `CalendarEarlyShiftIntegrator.js` (Lines 24-147):

```javascript
static applyCombinedRules(schedule, calendarRules, earlyShiftPreferences, staffMembers) {
  // Step 1: Assign × to ALL staff on must_day_off dates
  mustDayOffDates.forEach((dateKey) => {
    staffMembers.forEach((staff) => {
      schedule[staff.id][dateKey] = "×";
    });
  });
  
  // Step 2: OVERWRITE × with △ for eligible staff
  // (early shift preference overrides must_day_off)
  mustDayOffDates.forEach((dateKey) => {
    eligibleStaff.forEach((staff) => {
      if (canDoEarlyShift(earlyShiftPreferences, staff.id, dateKey)) {
        schedule[staff.id][dateKey] = "△";
      }
    });
  });
  
  // Step 3: Apply must_work dates (override all shift types to normal)
  mustWorkDates.forEach((dateKey) => {
    staffMembers.forEach((staff) => {
      if (shift === "×" || shift === "△" || shift === "◇") {
        schedule[staff.id][dateKey] = ""; // Normal shift
      }
    });
  });
}
```

**Key Insight:**
- must_day_off dates: Everyone gets × initially
- Eligible staff with early shift preference: Get △ instead
- must_work dates: All shifts become normal (empty string or ○)

### 3.11 POST-GENERATION: Daily Limit Balancing (Phase 6 Enhanced)

**Lines 1303-1400** (Updated in Phase 6)

**Key Change (Phase 6):** Uses `dailyLimitsRaw` object format instead of `dailyLimits` array format, and includes staff group constraint checking.

```javascript
// ✅ Phase 6: Use dailyLimitsRaw (object format) for dynamic database values
const liveSettings = this.getLiveSettings();
const dailyLimitsRaw = liveSettings.dailyLimitsRaw || {};
const staffGroups = liveSettings.staffGroups || [];
const minOffPerDay = dailyLimitsRaw.minOffPerDay ?? 0;
const maxOffPerDay = dailyLimitsRaw.maxOffPerDay ?? 3;

console.log(`⚖️ [BALANCE] Starting daily limit balancing (min: ${minOffPerDay}, max: ${maxOffPerDay})...`);
console.log(`⚖️ [BALANCE] dailyLimitsRaw source: ${dailyLimitsRaw._source || 'fallback'}`);

dateRange.forEach(date => {
  const dateKey = date.toISOString().split("T")[0];

  // Skip if calendar rule dates (calendar rules override daily limits)
  if (calendarRules[dateKey]?.must_day_off) {
    console.log(`⏭️ [BALANCE] ${dateKey}: Skipping (must_day_off override)`);
    return;
  }
  if (calendarRules[dateKey]?.must_work) {
    console.log(`⏭️ [BALANCE] ${dateKey}: Skipping (must_work override)`);
    return;
  }

  const currentOffCount = countOffDaysOnDate(schedule, dateKey, staffMembers);

  // Case 1: Too few off days (MIN enforcement)
  if (minOffPerDay > 0 && currentOffCount < minOffPerDay) {
    const needed = minOffPerDay - currentOffCount;

    for (const staff of eligibleStaff) {
      if (assigned >= needed) break;

      // Check 1: Adjacent conflict prevention (no ××, △×, ×△ patterns)
      const adjacentConflict = hasAdjacentConflict(staff, dateKey, "×", schedule);
      if (adjacentConflict) continue;

      // Check 2: Staff group constraint (only 1 member off per group per day)
      const groupConflict = wouldViolateStaffGroup(staff, dateKey, schedule, staffGroups, staffMembers);
      if (groupConflict) continue;

      // Check 3 (Phase 6.1): Consecutive × prevention
      const consecutiveConflict = wouldCreateConsecutiveOff(staff, dateKey, schedule);
      if (consecutiveConflict) continue;

      // All checks passed - assign ×
      schedule[staff.id][dateKey] = "×";
      assigned++;
    }
  }

  // Case 2: Too many off days (MAX enforcement)
  if (currentOffCount > maxOffPerDay) {
    // Convert excess × to working shifts
    // ... restore working shifts
  }
});

// 🔧 FINAL: Repair any remaining consecutive × patterns
await this.repairConsecutiveOffDays(schedule, staffMembers, dateRange);
```

**Critical Logic (Phase 6.1 Enhanced):**
- ✅ **Uses `dailyLimitsRaw`** - Object format from database with `minOffPerDay`, `maxOffPerDay`
- ✅ **Respects calendar rules** - Skips if must_day_off or must_work
- ✅ **Adjacent conflict check** - Prevents ××, △×, ×△ patterns
- ✅ **Staff group constraint** - Only 1 member off per group per day
- ✅ **Consecutive × check (NEW)** - Prevents 2+ consecutive off days when adding ×
- ✅ **Backup staff exclusion** - Doesn't assign × to backup-only staff
- ✅ **Dynamic limits** - Reads from database, not hardcoded values
- ✅ **Final repair** - `repairConsecutiveOffDays` runs AFTER BALANCE to catch all patterns

**Important Notes (Phase 6.1):**
- MIN enforcement was previously done in HybridPredictor post-processing, but this caused constraint violations
- MIN enforcement is now handled entirely in BusinessRuleValidator BALANCE phase with proper constraint checking
- The BALANCE phase runs DURING generation (after all other phases) to ensure constraints are respected
- `repairConsecutiveOffDays` was moved from BEFORE Phase 3 to AFTER BALANCE (final step)
- This ensures consecutive × patterns created by Phase 3 or BALANCE are also repaired

---

## 4. Constraint Enforcement: The Detailed Rules

### 4.1 Daily Limits (min/max per day)

**What:** How many staff can be off per day

**Configuration:**
```javascript
dailyLimits: {
  minOffPerDay: 2,      // Always need at least 2 off
  maxOffPerDay: 3       // Never more than 3 off
}
```

**Where Checked:**

1. **During Priority Rules Application** (Line 1566)
   ```javascript
   const dailyLimitExceeded = shiftValue === "×" && 
     !canAssignOffDay(schedule, dateKey, staffMembers, maxOffPerDay);
   
   if (dailyLimitExceeded) {
     console.log(`Cannot assign × - daily limit reached`);
     // Skip this assignment
   }
   ```

2. **During Off-Day Distribution** (Lines 2029-2050)
   ```javascript
   // Extract daily limits from settings
   const offDayLimit = dailyLimits.find(l => l.shiftType === "off");
   maxOffPerDay = offDayLimit?.maxCount || 4;
   ```

3. **During Final Balancing** (Lines 1282-1344)
   ```javascript
   // Enforce min 2, max 3
   if (currentOffCount < 2) {
     // Add × assignments
   } else if (currentOffCount > 3) {
     // Remove excess × assignments
   }
   ```

**Can Be Overridden By:**
- Calendar must_day_off rules (Phase 3 - FINAL)
- Calendar must_work rules (Phase 3 - FINAL)
- Never by priority rules or other constraints

**What Happens If Violated:**
- During generation: Assignment is rejected, system tries alternative
- After generation (during balancing): Automatically corrected

### 4.2 Weekly Limits (consecutive work days)

**What:** Maximum consecutive days a staff member can work

**Configuration:**
```javascript
weeklyLimits: [
  {
    shiftType: "consecutive_work_days",
    maxCount: 5,         // Max 5 consecutive work days
    weekPattern: "full_week"
  }
]
```

**Where Checked:**

In `wouldViolateWeeklyOffDayLimit()` (Lines 2547-2600):

```javascript
async wouldViolateWeeklyOffDayLimit(schedule, staff, dateKey, dateRange) {
  // Get weekly limits
  const weeklyLimits = this.getLiveSettings().weeklyLimits || [];
  const offDayLimit = weeklyLimits.find(l => l.shiftType === "off");
  const maxOffPerWeek = offDayLimit?.maxCount || 1;
  
  // Calculate week (Sunday to Saturday)
  const weekStart = getWeekStart(dateKey);
  const weekEnd = getWeekEnd(dateKey);
  
  // Count existing off days this week
  const existingOffDaysThisWeek = countOffDaysInWeek(
    schedule,
    staff.id,
    weekStart,
    weekEnd
  );
  
  // Would adding another × exceed limit?
  return existingOffDaysThisWeek >= maxOffPerWeek;
}
```

**Can Be Overridden By:**
- Calendar rules (Phase 3)
- Never by anything else

### 4.3 Monthly Limits (total off days per month)

**What:** Total off-days a staff member can have per month

**Configuration:**
```javascript
monthlyLimits: {
  maxOffDaysPerMonth: 10,   // Max 10 days off per month
  minWorkDaysPerMonth: 12   // Min 12 work days per month
}
```

**Where Checked:**

During off-day distribution (Lines 2076-2300):

```javascript
for (const staff of staffMembers) {
  // Count existing off days for this staff this month
  const existingOffDays = countOffDaysInMonth(schedule, staff.id);
  
  // How many more can we assign?
  const remaining = maxOffPerMonth - existingOffDays;
  
  if (remaining > 0) {
    // Randomly distribute remaining off days
    // Check all other constraints while doing so
  }
}
```

**Can Be Overridden By:**
- Calendar rules (Phase 3)
- Weekly limits (if hitting limit would violate weekly rule)

### 4.4 Adjacent Conflict Prevention (××, △△, ×△, △×)

**What:** Prevents certain shift combinations on consecutive days

**Violations Prevented:**
- ×× : Two consecutive off-days (usually not allowed)
- △△ : Two consecutive early shifts (breaks rotation)
- ×△ : Off day followed by early shift
- △× : Early shift followed by off day

**Where Checked:**

`hasAdjacentConflict()` function (Lines 49-91):

```javascript
function hasAdjacentConflict(staff, currentDate, proposedShift, schedule) {
  const staffSchedule = schedule[staff.id];
  
  // Check previous 2 days (sequential generation - future days empty)
  const daysToCheck = [-1, -2];
  
  for (const offset of daysToCheck) {
    const adjacentDate = new Date(currentDate);
    adjacentDate.setDate(adjacentDate.getDate() + offset);
    const adjacentDateKey = adjacentDate.toISOString().split("T")[0];
    
    const adjacentShift = staffSchedule[adjacentDateKey];
    
    // If proposing △, check if previous day is ×
    if (proposedShift === "△" && adjacentShift === "×") {
      return true; // CONFLICT
    }
    
    // If proposing ×, check if previous day is △
    if (proposedShift === "×" && adjacentShift === "△") {
      return true; // CONFLICT
    }
  }
  
  return false; // No conflict
}
```

**Called From:**
- Priority rules application (Lines 1564, 1513)
- Off-day distribution (Lines 2138+)
- 5-day rest enforcement (Line 2495)
- Final balancing (Line 1303)

**Can Be Overridden By:**
- Calendar rules (Phase 3) - calendar rules can create adjacent conflicts if needed
- Never by business rules

### 4.5 Staff Group Constraints (one off per group per day)

**What:** Groups of staff that cannot all be off on same day

**Configuration:**
```javascript
[
  {
    name: "Group 1",
    members: ["staff-1", "staff-2", "staff-3"],
    rule: "only_1_off"  // Only 1 member can be off per date
  }
]
```

**Logic (Lines 1844-1872):**

```javascript
// For each group, on each date
const offOrEarlyMembers = group.members.filter(id => {
  const shift = schedule[id][dateKey];
  return shift === "×" || shift === "△";
});

// If more than 1, keep first, change rest to working
if (offOrEarlyMembers.length > 1) {
  offOrEarlyMembers.slice(1).forEach(id => {
    schedule[id][dateKey] = ""; // Normal shift
  });
}
```

**Applied In:**
- PHASE 2 (Lines 1189-1197)
- After off-day distribution (Line 1197)
- After 5-day rest enforcement (Line 1204)

**Can Be Overridden By:**
- Calendar must_day_off rules (Phase 3)
- Never by business rules

### 4.6 Priority Rules (preferred/avoided shifts)

**What:** Individual staff preferences

**Types:**
1. **Preferred Shifts** - Staff wants this shift on this day
2. **Avoided Shifts** - Staff doesn't want this shift on this day  
3. **Exceptions** - Exception to avoided shift (allows specific replacement)

**Configuration:**
```javascript
{
  "staff-id": {
    preferredShifts: [
      { day: "monday", shift: "early" }  // Want △ on Monday
    ],
    avoidedShifts: [
      { day: "friday", shift: "off" }    // Don't want × on Friday
    ],
    exceptionsAllowed: [
      {
        day: "wednesday",
        avoidedShift: "off",              // Normally avoid × on Wed
        allowedShifts: ["early"]          // But accept △ instead
      }
    ]
  }
}
```

**Application Order (Lines 1461-1585):**

1. **Process avoidedShifts FIRST** (Lines 1465-1542)
   - Remove avoided shift from schedule
   - OR replace with exception shift if allowed
   - Check adjacent conflict before replacement
   - Check daily limit before assigning × replacement

2. **Process preferredShifts SECOND** (Lines 1544-1585)
   - Assign preferred shift
   - Check adjacent conflict constraint
   - Check daily limit constraint (for × assignments)

**Can Be Overridden By:**
- Calendar must_work (removes preference)
- Calendar must_day_off (removes preference if conflicts)
- Never by daily limits (prefers staff satisfaction)

**When Violated:** System logs warning but doesn't force application if constraints are violated.

---

## 5. Priority/Layering System: What Overrides What

### 5.1 The Complete Hierarchy

```
TIER 0 (ABSOLUTE - Cannot be overridden):
  ├─ Calendar must_day_off (PRE-PHASE & Phase 3)
  ├─ Calendar must_work (Phase 3)
  └─ Early shift preferences on must_day_off dates (Phase 3)

TIER 1 (HARD CONSTRAINTS - Enforced during generation):
  ├─ Staff group constraints (only 1 off per group per date)
  ├─ Adjacent conflict prevention (no ××, △△, ×△, △×)
  ├─ Daily limits (min 2, max 3 off per day) [except on calendar dates]
  ├─ Weekly limits (consecutive work days max)
  └─ 5-day rest requirement (no 5+ consecutive work days)

TIER 2 (SOFT CONSTRAINTS - Applied with fallback):
  ├─ Priority rules (preferred/avoided shifts)
  ├─ Monthly limits (total off days)
  ├─ Backup staff preference (don't assign off to backup-only staff)
  └─ Operational efficiency metrics

TIER 3 (FINAL CORRECTION - Applied after generation):
  └─ Daily limit balancing (ensure exactly min-max off per day)
```

### 5.2 Specific Override Rules

**Calendar Rules (TIER 0) vs Daily Limits (TIER 1):**
```
Calendar must_day_off: 10 staff off on Dec 25
Daily limit: max 3 staff off per day
Result: Calendar wins - 10 staff off on Dec 25
```

**Balancing code (Line 1265-1277):**
```javascript
// Skip balancing on calendar rule dates
if (calendarRules[dateKey]?.must_day_off) {
  console.log(`⏭️ Skipping balancing (must_day_off override)`);
  return;
}
if (calendarRules[dateKey]?.must_work) {
  console.log(`⏭️ Skipping balancing (must_work override)`);
  return;
}
```

**Priority Rules (TIER 2) vs Daily Limits (TIER 1):**
```
Priority: Staff wants × on Monday
Daily limit: Already 3 staff off on Monday (max reached)
Result: Daily limit wins - cannot assign ×
```

**Code (Lines 1565-1575):**
```javascript
// Check daily limit before assigning preferred ×
const dailyLimitExceeded = shiftValue === "×" && 
  !canAssignOffDay(schedule, dateKey, staffMembers, maxOffPerDay);

if (dailyLimitExceeded) {
  console.log(`Cannot assign preferred ×, daily limit reached`);
  // Skip this assignment, move to next
}
```

**Priority Rules (TIER 2) vs Staff Groups (TIER 1):**
```
Priority: Staff A wants ×, Staff B (same group) has ×
Staff Group: Only 1 off per group
Result: Staff group wins - one of them loses their assignment
```

**This is why priority rules are re-enforced AFTER group constraints:**
```javascript
await this.applyStaffGroupConstraints(...);
// ✅ Re-enforce priority rules (prevent overwrites)
await this.applyPriorityRules(...);
```

### 5.3 Re-enforcement Strategy

**The system re-applies rules multiple times to prevent conflicts:**

```javascript
// Line 1186-1216: Execution order with re-enforcement

1. Apply priority rules                 // Initial
2. Apply staff group constraints        // May break priorities
3. Re-enforce priority rules            // Restore priorities
4. Distribute off days                  // May break everything
5. Re-enforce staff group constraints   // Restore groups
6. Re-enforce priority rules            // Restore priorities
7. Enforce 5-day rest                   // May break constraints
8. Re-enforce staff group constraints   // Restore groups
9. Re-enforce priority rules            // Restore priorities
10. Apply coverage compensation         // May break rules
11. Re-enforce priority rules           // Restore priorities
12. Apply final adjustments             // May break rules
13. Re-enforce priority rules           // Final restoration
14. Repair consecutive off days         // Cleanup
15. Apply calendar + early shift [Phase 3]  // FINAL OVERRIDE
16. Daily limit balancing               // Ensure min-max compliance
```

**Why This Works:**
- Higher tier constraints always re-enforce after lower tier applies
- Calendar rules applied LAST (Phase 3) so they override everything
- Daily balancing ensures final output meets minimum requirements

---

## 6. Critical Interactions: Cross-Constraint Effects

### 6.1 Calendar Rules × Daily Limits

**Interaction:** Calendar rules CAN violate daily limits if necessary

**Scenario:**
- must_day_off on Dec 25: All 10 staff off
- Daily limit: max 3 staff off per day
- Result: All 10 off (calendar wins)

**Code Protection (Lines 1265-1277):**
```javascript
// During final balancing, skip calendar rule dates
if (calendarRules[dateKey]?.must_day_off) {
  return; // Don't balance on this date
}
```

### 6.2 Early Shift Preferences × must_day_off

**Interaction:** Early shift preferences OVERRIDE must_day_off

**Scenario:**
- must_day_off on Dec 25: All staff should be ×
- Staff A has early shift preference on Dec 25
- Result: Staff A gets △, others get ×

**Code (CalendarEarlyShiftIntegrator, Lines 76-92):**
```javascript
// Step 1: ALL staff get × on must_day_off dates
mustDayOffDates.forEach(dateKey => {
  staffMembers.forEach(staff => {
    schedule[staff.id][dateKey] = "×";
  });
});

// Step 2: OVERWRITE × with △ for eligible staff
eligibleStaff.forEach(staff => {
  if (canDoEarlyShift(earlyShiftPreferences, staff.id, dateKey)) {
    schedule[staff.id][dateKey] = "△";  // △ overrides ×
  }
});
```

**Why This Order:**
- Clear baseline (all ×)
- Exceptions applied (△ where applicable)
- No ambiguity about what should be assigned

### 6.3 Staff Groups × Priority Rules

**Interaction:** Group constraints sometimes override preferences

**Scenario:**
- Staff A (Group 1): prefers × on Monday
- Staff B (Group 1): already has × on Monday
- Result: Staff A cannot get × (group constraint violated)

**When This Happens:**
1. Priority rules applied: Staff A gets ×
2. Group constraints applied: Staff A's × removed
3. Priority rules re-enforced: Tries to restore Staff A's ×
4. Still conflicts with group constraint
5. Final result: Staff A cannot have ×, gets normal shift instead

**Resolution (Lines 1191-1192):**
```javascript
// Apply groups
await this.applyStaffGroupConstraints(...);
// Re-enforce priorities (may not succeed due to groups)
await this.applyPriorityRules(...);
```

### 6.4 5-Day Rest × Weekly Limits

**Interaction:** 5-day rest takes priority if weekly limit is hit

**Scenario:**
- 5-day rest violation in window: Staff needs × somewhere
- Weekly limit: Only 1 × per week, already assigned
- Result: System tries △ (early shift) as fallback

**Code (Lines 2486-2517):**
```javascript
// Try to assign × (if respects weekly limits)
const wouldViolateLimit = await this.wouldViolateWeeklyOffDayLimit(...);

if (!wouldViolateLimit) {
  schedule[staff.id][dateKey] = "×";  // Assign ×
} else {
  // Try △ (early shift) instead - no limits on △
  if (!hasAdjacentConflict(staff, dateKey, "△", schedule)) {
    schedule[staff.id][dateKey] = "△";
  }
}
```

### 6.5 Balancing × Calendar Rules × Everything

**Interaction:** Balancing respects calendar rules, ignores other conflicts

**Scenario:**
- Post-generation: Only 1 staff off on Tuesday (need min 2)
- Tuesday has must_day_off calendar rule: 5 staff already off
- Result: No additional assignment needed (balancing skipped)

**Code (Lines 1265-1277):**
```javascript
// Skip balancing on calendar dates
if (calendarRules[dateKey]?.must_day_off) {
  return;  // Don't check min/max
}
```

---

## 7. Code Locations: Reference Table

### Main Generation Flow

| Operation | File | Function | Lines | Purpose |
|-----------|------|----------|-------|---------|
| Entry point | useAIAssistantLazy.js | generateAIPredictions | 353-555 | Trigger AI and collect data |
| Data loading: Early shifts | useAIAssistantLazy.js | (inline) | 400-428 | Load early shift preferences |
| Data loading: Calendar | useAIAssistantLazy.js | (inline) | 430-459 | Load calendar rules |
| AI orchestration | HybridPredictor.js | predictSchedule | 200-450 | Route to ML or rule-based |
| Main generation | BusinessRuleValidator.js | generateRuleBasedSchedule | 1109-1356 | Full generation pipeline |
| PRE-PHASE | BusinessRuleValidator.js | (inline) | 1160-1184 | Apply must_day_off first |
| PHASE 1 | BusinessRuleValidator.js | applyPriorityRules | 1364-1596 | Apply staff preferences |
| PHASE 2 | BusinessRuleValidator.js | applyStaffGroupConstraints | 1779-1896 | Enforce group rules |
| PHASE 3 | BusinessRuleValidator.js | distributeOffDays | 1945-2415 | Random off-day distribution |
| PHASE 4 | BusinessRuleValidator.js | enforce5DayRestConstraint | 2417-2537 | Prevent 5+ consecutive work |
| PHASE 5 | BusinessRuleValidator.js | applyCoverageCompensation | 2666+ | Backup staff coverage |
| PHASE 6 | BusinessRuleValidator.js | applyFinalAdjustments | 2706+ | Final tweaks |
| 5-DAY REST (Phase 6.2) | BusinessRuleValidator.js | enforce5DayRestAfterBalance | 2951-2990 | Fix >5 consecutive work days |
| POST-REPAIR | BusinessRuleValidator.js | repairConsecutiveOffDays | 2750+ | Fix consecutive off days |
| Phase 3 Integration | BusinessRuleValidator.js | (inline) | 1221-1242 | Apply calendar + early shift |
| Daily balancing | BusinessRuleValidator.js | (inline) | 1255-1350 | Ensure min-max per day |

### Constraint Checking Functions

| Constraint | File | Function | Lines | Purpose |
|-----------|------|----------|-------|---------|
| Adjacent conflict | BusinessRuleValidator.js | hasAdjacentConflict | 49-91 | Prevent ××, △△, ×△, △× |
| Can assign off day | BusinessRuleValidator.js | canAssignOffDay | 101-116 | Check daily max limit |
| Need more off days | BusinessRuleValidator.js | needsMoreOffDays | 126-132 | Check daily min requirement |
| Count off days | BusinessRuleValidator.js | countOffDaysOnDate | 141-145 | Get current off count |
| Rest day count | BusinessRuleValidator.js | countRestDays | 1907-1945 | Count × or △ in window |
| Weekly limit check | BusinessRuleValidator.js | wouldViolateWeeklyOffDayLimit | 2547-2600 | Check weekly constraint |

### Data Loaders

| Data Type | File | Method | Purpose |
|-----------|------|--------|---------|
| Calendar rules | CalendarRulesLoader.js | loadRules() | Load must_work/must_day_off dates |
| Early shift prefs | EarlyShiftPreferencesLoader.js | loadPreferences() | Load staff early shift eligibility |
| Priority rules | ConstraintEngine.js | getPriorityRules() | Load preferred/avoided shifts |
| Staff groups | ConstraintEngine.js | getStaffConflictGroups() | Load group constraints |
| Daily limits | ConstraintEngine.js | getDailyLimits() | Load min/max per day |
| Weekly limits | ConstraintEngine.js | getWeeklyLimits() | Load weekly constraints |
| Monthly limits | ConstraintEngine.js | getMonthlyLimits() | Load monthly constraints |

### Supporting Functions

| Function | File | Purpose |
|----------|------|---------|
| isOffDay() | ConstraintEngine.js | Check if shift is × |
| isEarlyShift() | ConstraintEngine.js | Check if shift is △ |
| isLateShift() | ConstraintEngine.js | Check if shift is ◇ |
| isNormalShift() | ConstraintEngine.js | Check if shift is empty string |
| isWorkingShift() | ConstraintEngine.js | Check if shift is any working shift |
| getDayOfWeek() | ConstraintEngine.js | Get day name from date |
| transformPriorityRulesArrayToObject() | BusinessRuleValidator.js | Convert UI format to AI format |
| wouldCreateConsecutiveOff() | BusinessRuleValidator.js | Check if assignment creates consecutive × |
| wouldViolateStaffGroup() | BusinessRuleValidator.js | Check if assignment violates staff group constraint |
| breakWorkStreak() | BusinessRuleValidator.js | Insert × to break >5 consecutive work days |

---

## 8. Common Pitfalls: Lessons from Recent Bugs

### 8.1 Why Balancing Was Overwriting Calendar Rules

**The Bug (Fixed):**
```javascript
// WRONG: Don't check calendar rules during balancing
dateRange.forEach(date => {
  const currentOffCount = countOffDaysOnDate(schedule, date);
  
  // This could exceed 3 even if calendar says all must be off!
  if (currentOffCount < minOffPerDay) {
    // Assign more ×
  }
});
```

**The Fix (Current Code, Lines 1265-1277):**
```javascript
// RIGHT: Skip calendar rule dates during balancing
dateRange.forEach(date => {
  const dateKey = date.toISOString().split("T")[0];
  
  // ✅ CRITICAL: Skip if calendar rule applies to this date
  if (calendarRules[dateKey]?.must_day_off) {
    return; // Skip balancing on this date
  }
  if (calendarRules[dateKey]?.must_work) {
    return; // Skip balancing on this date
  }
  
  // Now safe to balance
  const currentOffCount = countOffDaysOnDate(schedule, dateKey);
  ...
});
```

**Lesson:** Calendar rules are immutable - **always check them before modifying any date's schedule**.

### 8.2 Why Execution Order Matters

**The Bug (Conceptual):**
```javascript
// WRONG: Apply groups, then distribution
applyStaffGroupConstraints();  // Group: only 1 off per group
distributeOffDays();            // Distribution could violate group!
// Group constraint violated!
```

**The Fix (Current Code, Lines 1189-1199):**
```javascript
// RIGHT: Apply groups, then distribution, then re-enforce groups
applyStaffGroupConstraints();
distributeOffDays();            // May violate groups
applyStaffGroupConstraints();   // ✅ Re-enforce!
```

**Lesson:** After any major phase, re-enforce higher-tier constraints.

### 8.3 Why Daily Limits Rejection Is Better Than Correction

**The Bug (Potential):**
```javascript
// RISKY: Assign ×, then correct later
schedule[staff.id][dateKey] = "×";  // Assign blindly
// ... later in balancing ...
if (offCount > maxOffPerDay) {
  // Try to find and remove it
  // Problem: We don't know which ones are required (calendar/priority)
}
```

**The Fix (Current Code):**
```javascript
// RIGHT: Check BEFORE assigning
const canAssign = canAssignOffDay(schedule, dateKey, staffMembers, maxOffPerDay);

if (canAssign) {
  schedule[staff.id][dateKey] = "×";
} else {
  // Skip assignment - try alternative
  console.log("Cannot assign × - daily limit reached");
}
```

**Lesson:** Validation before assignment prevents conflicts. Correction after is messy and fragile.

### 8.4 Why Phase 3 Must Run LAST

**The Bug (If Phase 3 runs earlier):**
```javascript
// WRONG: Phase 3 runs early
applyCombinedCalendarRules();     // Apply calendar + early shift
distributeOffDays();                // Wait, this might violate calendar rules!
applyStaffGroupConstraints();       // This might overwrite calendar rules!
```

**The Fix (Current Code, Lines 1221-1242):**
```javascript
// RIGHT: Phase 3 runs LAST, after everything
// ... all other phases ...
applyCombinedCalendarRules();       // ✅ FINAL - nothing after this
console.log("[Phase 3] Applied (FINAL)");
```

**Lesson:** Rules that must not be overridden must be applied LAST.

### 8.5 Why Staff Groups Need Special Handling

**The Bug (If groups are checked too loosely):**
```javascript
// WRONG: Only check if > 2 members off
if (offOrEarlyMembers.length > 2) {
  // Fix conflict
}
// Problem: What if 2 members off (still violates 1-off rule)?
```

**The Fix (Current Code, Lines 1844-1872):**
```javascript
// RIGHT: Check if > 1 (only 1 is allowed)
if (offOrEarlyMembers.length > 1) {
  // Keep first, change rest to working
  offOrEarlyMembers.slice(1).forEach(id => {
    schedule[id][dateKey] = ""; // Normal shift
  });
}
```

**Lesson:** Constraints should be absolute - not "mostly enforced".

### 8.6 Why Backup Staff Need Special Treatment

**The Bug (If backup staff treated like regular staff):**
```javascript
// WRONG: Assign off days to backup staff
for (const staff of staffMembers) {
  // Distribute off days
  // Problem: Backup staff should only work (○), never off (×)
}
```

**The Fix (Current Code, Lines 2079-2093):**
```javascript
// RIGHT: Skip backup staff from off-day distribution
const isBackup = this.backupStaffService.isBackupStaff(staff.id);

if (isBackup) {
  // Skip - backup staff get ○ (working) instead
  continue;
}

// Only distribute off days to regular staff
```

**Lesson:** Backup staff have different availability rules - they must be explicitly handled.

### 8.7 Why Random Shuffling Prevents Clustering

**The Bug (If dates not shuffled):**
```javascript
// WRONG: Always pick first available dates
for (const staff of staffMembers) {
  const availableDates = getAllAvailableDates();
  // Always picks dates[0], dates[1], dates[2]
  // Result: All off days at start of month!
}
```

**The Fix (Current Code uses random distribution):**
```javascript
// RIGHT: Shuffle dates before assignment
const eligibleDates = availableDates.sort(() => Math.random() - 0.5);

for (let i = 0; i < offDaysToAssign; i++) {
  schedule[staff.id][eligibleDates[i]] = "×";
}
// Result: Off days scattered throughout month
```

**Lesson:** Randomization improves distribution fairness.

---

## 9. What NOT to Change (Critical Code Sections)

### 9.1 The PRE-PHASE Application (Lines 1160-1184)

**DO NOT:** Move calendar must_day_off rule application.

**Why:** This is the baseline that all other rules must respect. If moved to later, other rules might assign conflicting shifts.

**Impact if changed:**
- Calendar rules become unreliable
- Other rules might override calendar constraints
- System consistency breaks

### 9.2 Phase 3 Integration (Lines 1221-1242)

**DO NOT:** Move Phase 3 earlier or split it into multiple phases.

**Why:** Phase 3 must run LAST after everything else, so nothing can override calendar rules.

**Impact if changed:**
- Calendar must_day_off becomes just a suggestion
- Early shift preferences might not override day offs
- Final output violates business rules

### 9.3 Re-enforcement Calls (Lines 1192, 1197, 1205, 1211, 1216)

**DO NOT:** Remove re-enforcement calls.

**Why:** These ensure higher-tier constraints aren't broken by lower-tier phases.

**Impact if changed:**
- Priority rules get overwritten by distribution
- Staff groups get violated
- Final schedule violates constraints

### 9.4 Adjacent Conflict Check (Lines 49-91)

**DO NOT:** Remove or weaken adjacent conflict validation.

**Why:** This prevents ××, △△, ×△, △× patterns which create operational problems.

**Impact if changed:**
- Staff have multiple consecutive off days (bad for operations)
- Early shift rotations break down
- Staff get fatigued from clustering

### 9.5 Daily Limit Balancing (Lines 1336-1470) - Phase 6.1 Enhanced

**DO NOT:** Modify min/max thresholds without updating tests.

**Why:** Daily limits are a hard operational constraint.

**Phase 6.1 Critical Notes:**
- MIN enforcement now uses `dailyLimitsRaw` from database (not hardcoded values)
- Staff group constraints are checked before assigning × during balancing
- Adjacent conflict patterns are validated (no ××, △×, ×△)
- **Consecutive × check added** - Prevents 2+ consecutive off days when adding ×
- MIN enforcement was moved FROM HybridPredictor post-processing TO here
- **`repairConsecutiveOffDays` now runs AFTER BALANCE** (was before Phase 3)
- This prevents constraint violations that occurred with post-processing approach

**Execution Order (Phase 6.3):**
1. Priority rules → Staff groups
2. **`MIN-ENFORCE-EARLY`** in distributeOffDays (NEW - ensures MIN before △)
3. Random off-day distribution → 5-day rest → Coverage → Final adjustments
4. Phase 3 calendar integration (must_day_off + early shift)
5. BALANCE phase (backup MIN/MAX enforcement with warning logs)
6. `enforce5DayRestAfterBalance()` (fix >5 consecutive work days)
7. `repairConsecutiveOffDays` (FINAL cleanup)

**Impact if changed:**
- Too few staff working on some days (insufficient coverage)
- Too many staff off (overstaffed operations)
- Unpredictable staffing levels
- Staff group violations (if constraint check removed)
- Adjacent pattern violations (if conflict check removed)
- Consecutive × patterns (if consecutive check removed or repair moved earlier)

### 9.6 Backup Staff Check (Lines 2079-2093)

**DO NOT:** Include backup staff in automatic off-day distribution.

**Why:** Backup staff have different availability - they should only work (○).

**Impact if changed:**
- Backup staff get unexpected day offs
- No coverage when primary staff are absent
- Operational disruptions

---

## 10. Where to Add Future Constraints

### 10.1 New Constraint Type: Time Off Request

**Where to add:** Create new phase between PHASE 2 and PHASE 3

**Add after line 1192:**
```javascript
// NEW: Apply time-off requests
await this.applyTimeOffRequests(schedule, staffMembers, dateRange);

// Re-enforce constraints
await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange);
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**Important:** Place before off-day distribution so constraints can reject requests if they violate limits.

### 10.2 New Constraint Type: Minimum Staffing Per Shift

**Where to add:** Create new validation after PHASE 5

**Add after line 1211:**
```javascript
// NEW: Ensure minimum staffing per shift type
await this.enforceMinimumShiftCoverage(schedule, staffMembers, dateRange);

// Re-enforce constraints
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**Important:** Run after coverage compensation so backup staff are considered.

### 10.3 New Constraint Type: Skill-Based Scheduling

**Where to add:** Create new phase between PHASE 3 and PHASE 4

**Add after line 1195:**
```javascript
// NEW: Ensure at least 1 skilled staff per day
await this.enforceSkillRequirements(schedule, staffMembers, dateRange);

// Re-enforce constraints
await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange);
await this.applyPriorityRules(schedule, staffMembers, dateRange);
```

**Important:** Run after group constraints but before rest enforcement.

---

## 11. Best Practices for Future Changes

### 11.1 The Rule Modification Checklist

Before modifying any constraint:

- [ ] Understand current enforcement location (which phase?)
- [ ] Identify what tier it belongs in (0-3)
- [ ] Check what other rules it interacts with
- [ ] Verify whether it should override or be overridden
- [ ] Plan where re-enforcement should happen
- [ ] Add logging at multiple points in the flow
- [ ] Test with calendar rules (ensure calendar rules still win)
- [ ] Test with priority rules (ensure proper interaction)
- [ ] Test with daily limits (ensure they're respected)
- [ ] Test edge cases (empty schedule, all staff off, etc.)

### 11.2 The Logging Strategy

For every constraint change, add:

1. **Entry logging:**
```javascript
console.log(`🔍 [YOUR-CONSTRAINT] Processing ${staffMembers.length} staff...`);
```

2. **Violation detection:**
```javascript
console.log(`⚠️ [YOUR-CONSTRAINT] ${staff.name}: VIOLATION detected`);
```

3. **Correction logging:**
```javascript
console.log(`✅ [YOUR-CONSTRAINT] ${staff.name}: Corrected on ${dateKey}`);
```

4. **Summary logging:**
```javascript
console.log(`✅ [YOUR-CONSTRAINT] Complete: ${correctionsApplied} changes made`);
```

### 11.3 The Testing Strategy

1. **Unit Test:** Test constraint in isolation
2. **Integration Test:** Test with other constraints enabled
3. **Calendar Test:** Verify calendar rules override
4. **Edge Case Test:** Empty schedule, all off, all working
5. **Regression Test:** Verify existing constraints still work

### 11.4 The Documentation Strategy

When adding a new constraint:

1. Add docstring with clear purpose
2. Document configuration (how to enable/disable)
3. List interactions with other constraints
4. Add section to this documentation
5. Add code comments explaining "why" not just "what"

---

## 12. Troubleshooting Guide

### Issue: Schedule has ×× (consecutive off days)

**Cause:** Adjacent conflict check not running, or `repairConsecutiveOffDays` running too early.

**Debug Steps:**
1. Check if `hasAdjacentConflict()` is being called (search logs for "adjacent conflict")
2. Check if `wouldCreateConsecutiveOff()` is being called in BALANCE (search for "consecutive ×")
3. Check if `repairConsecutiveOffDays` runs AFTER BALANCE (search for "[REPAIR]")
4. Verify repair is finding and fixing patterns (search for "Breaking up")

**Console Commands to Debug:**
```js
// Check BALANCE logs
window.consoleLogger.getLogs().filter(l => l.message.includes('[BALANCE]')).forEach(l => console.log(l.message))

// Check REPAIR logs
window.consoleLogger.getLogs().filter(l => l.message.includes('[REPAIR]')).forEach(l => console.log(l.message))

// Check 5-DAY-REST logs
window.consoleLogger.getLogs().filter(l => l.message.includes('[5-DAY-REST]')).forEach(l => console.log(l.message))

// Check specific staff
window.consoleLogger.getLogs().filter(l => l.message.includes('古藤')).forEach(l => console.log(l.message))
```

**Solution (Phase 6.2):**
- `repairConsecutiveOffDays` was moved to run AFTER BALANCE phase
- BALANCE phase now has `wouldCreateConsecutiveOff()` check
- `enforce5DayRestAfterBalance()` runs between BALANCE and repairConsecutiveOffDays
- If still happening: Check if Phase 3 calendar integration is creating the pattern

### Issue: Calendar rules not being applied

**Cause:** Calendar rules not loaded, or Phase 3 not running.

**Debug Steps:**
1. Check `calendarRules` object has expected dates (Line 1141)
2. Verify Phase 3 runs (search logs for "[Phase 3]")
3. Check if `applyC combinedRules()` returns expected changes
4. Verify final schedule has calendar rule assignments

**Solution:**
- If not loaded: Check CalendarRulesLoader.loadRules() return value
- If Phase 3 not running: Check `hasPhase3Integration` variable (Line 1141)
- If not applied: Check CalendarEarlyShiftIntegrator.applyCombinedRules() logic

### Issue: Staff group violations (2+ members off same group on same date)

**Cause:** Group constraint not running, or running too early/late.

**Debug Steps:**
1. Check if `applyStaffGroupConstraints()` runs (search logs for "[AI] Applying staff group")
2. Verify staff groups are loaded correctly
3. Check if re-enforcement happens after distribution
4. Verify group members are finding correctly (check "Member not found" warnings)

**Solution:**
- If not running: Check `getLiveSettings().staffGroups` is populated
- If members not found: Verify staff ID/name matching logic
- If violations after distribution: Ensure re-enforcement is happening (Line 1197)

### Issue: Daily limits not balanced (not exactly 2-3 staff off per day)

**Cause:** Balancing not running, `dailyLimitsRaw` not loaded, or all eligible staff skipped.

**Debug Steps:**
1. Check if balancing runs (search logs for "[BALANCE] Starting")
2. Check if `dailyLimitsRaw` has values (search logs for "dailyLimitsRaw source: database")
3. Check if min/max values are correct (should show "min: 2, max: 3")
4. Check if staff are being skipped (search for "Skip ×")
5. Check final count (search for "Final count")

**Console Commands to Debug:**
```js
// Check all BALANCE logs
window.consoleLogger.getLogs().filter(l => l.message.includes('[BALANCE]')).forEach(l => console.log(l.message))

// Check specific date (e.g., Dec 5)
window.consoleLogger.getLogs().filter(l => l.message.includes('12-05')).forEach(l => console.log(l.message))

// Check dailyLimitsRaw
window.consoleLogger.getLogs().filter(l => l.message.includes('dailyLimitsRaw')).forEach(l => console.log(l.message))
```

**Common Skip Reasons:**
- `(adjacent conflict)` - Would create ××, △×, ×△ pattern
- `(staff group conflict)` - Another group member already has × that day
- `(would create consecutive ×)` - Would create 2+ consecutive off days

**Solution (Phase 6.1):**
- If `dailyLimitsRaw` shows `null`: Check `getLiveSettings()` returns `dailyLimitsRaw` from settings provider
- If all staff skipped: Too many constraints prevent any assignment (may need relaxation)
- If wrong min/max: Check database `ai_settings.daily_limits` table

### Issue: Priority rules not applied

**Cause:** Priority rules not loaded, or overwritten by later phases.

**Debug Steps:**
1. Check if rules load (search logs for "[PRIORITY] Received")
2. Verify rule transformation works (search for "[PRIORITY-TRANSFORM]")
3. Check if staff matching works (search for "[PRIORITY] Staff not found")
4. Verify rules aren't overwritten (check re-enforcement logs)

**Solution:**
- If not loaded: Check getPriorityRules() returns data
- If transformation fails: Check rule format has required fields
- If overwritten: Ensure re-enforcement happens after each phase
- If staff not found: Verify staff ID/name matching logic

### Issue: 5-day rest violations not fixed (>5 consecutive work days)

**Cause (Phase 6.2):** `enforce5DayRestAfterBalance()` not running, or not finding violations correctly.

**Debug Steps:**
1. Check if enforcement runs (search logs for "[5-DAY-REST] Enforcing")
2. Verify violations are detected (search for "VIOLATION:")
3. Check if breaks are applied (search for "Breaking streak")
4. Verify final count (search for "Enforcement complete")

**Console Commands to Debug:**
```js
// Check 5-DAY-REST logs
window.consoleLogger.getLogs().filter(l => l.message.includes('[5-DAY-REST]')).forEach(l => console.log(l.message))

// Check specific staff (e.g., 安井)
window.consoleLogger.getLogs().filter(l => l.message.includes('安井')).forEach(l => console.log(l.message))
```

**Solution (Phase 6.2):**
- `enforce5DayRestAfterBalance()` now runs AFTER BALANCE phase
- It scans for consecutive work days >5 and inserts × in the middle of the streak
- The `breakWorkStreak()` helper places × at day 5 to break the streak
- If still violations: Check if the staff member is being processed (not filtered out)
- If × not placed: The streak detection might not be finding the violation

**Key Logic:**
- Works AFTER BALANCE to catch all patterns
- Counts consecutive work days (anything that is not × or △)
- When streak >5, inserts × at position 5 (6th work day becomes rest)
- Runs for ALL staff (社員 and パート) for labor law compliance

---

## 13. Performance Considerations

### 13.1 Algorithm Complexity

**Current Implementation:**

```
Per Phase Time:
- Apply priority rules: O(staff × dates × rules)
- Apply group constraints: O(dates × groups × members)
- Distribute off days: O(staff × dates × checks)
- Enforce 5-day rest: O(staff × date-windows × checks)

Total: O(staff × dates × (rules + groups + members + windows))

Typical Values:
- Staff: 5-10
- Dates: 60-62 (2 months)
- Rules: 5-20 per staff
- Groups: 3-5
- Members per group: 2-3

Approximate operations: 10 × 60 × (10 + 5 + 10 + 30) = 54,000 operations
Expected time: <100ms
```

### 13.2 Optimization Opportunities

1. **Cache day-of-week calculations**
   - Currently recalculated for every rule check
   - Could pre-compute and reuse

2. **Batch constraint checks**
   - Currently check each constraint individually
   - Could combine into single pass

3. **Skip backtracking phases**
   - Currently re-enforce after each phase
   - Could only re-enforce if changes were made

### 13.3 Memory Considerations

```
Memory Usage:
- Schedule object: staff × dates × 2 bytes ≈ 5KB
- Settings object: small (< 1KB)
- Rule cache: small (< 10KB)
- Validation history: grows over time

Total: < 50KB per generation
```

---

## 14. Example Generation Trace

### 14.1 Sample Output Log

```
🎯 Generating rule-based schedule...
✅ Validation passed: 8 staff, 62 dates

📅 [Phase 3] Calendar + Early Shift Integration enabled
  earlyShiftPreferencesCount: 3
  calendarRulesCount: 2

🔄 [PRE-PHASE] Applying must_day_off calendar rules (EARLY OVERRIDE)...
✅ [PRE-PHASE] All staff: × on 2025-12-25 (must_day_off)
✅ [PRE-PHASE] Applied 1 must_day_off rule(s)

🎯 [PRIORITY] Applying priority rules...
🎯 [PRIORITY] Processing 3 staff with priority rules
✅ [PRIORITY]   → 鈴木: SET "△" on 2025-11-30 (monday) - preferred shift applied
✅ [PRIORITY] Total 5 priority rule(s) applied

🔧 [AI] Applying staff group constraints...
📊 [AI] Processing 5 staff group(s)
⚠️ [AI] 2025-12-01: Group "1" has 2 members with off/early shifts - fixing conflict
  ✅ [AI] Changed 山田 (社員): "×" → "" (working shift)

🎯🎯🎯 [PHASE-1] ========== RANDOMIZATION ACTIVE ========== 🎯🎯🎯
📅 [RULE-GEN] Distributing off days...
  📊 [DAILY-LIMIT-INIT] 2025-12-01: 3 staff already off (from earlier rules)
  ✅ [DISTRIBUTE-OFF] 田中: Added × on 2025-12-02 (8 total days off this month)

🔍 [5-DAY-REST] Scanning schedule for 5-day rest violations...
⚠️ [5-DAY-REST] 新田: VIOLATION in window 2025-12-15 to 2025-12-19 - no rest days
✅ [5-DAY-REST] 新田: Assigned × on 2025-12-17 to fix violation

⚖️ [BALANCE] Starting daily limit balancing (min: 2, max: 3)...
⚠️ [BALANCE] 2025-12-05: Only 1 staff off, need 1 more (min: 2)
✅ [BALANCE] 田中: Added × on 2025-12-05 (balancing to min 2)

🔄 [Phase 3] Applying combined calendar rules + early shift preferences (FINAL OVERRIDE)...
✅ [Phase 3] 2025-12-25: All staff: ×, except:
  2025-12-25: 鈴木 → △ (early shift preference)

✅ Rule-based schedule generated
✅ [BALANCE] Balancing complete: 4 change(s) made
```

---

## 15. Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│           SCHEDULE GENERATION PIPELINE                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │  1. Load Configuration Data      │
        │  ├─ Calendar rules               │
        │  ├─ Early shift preferences      │
        │  ├─ Priority rules               │
        │  ├─ Staff groups                 │
        │  └─ Daily/Weekly/Monthly limits  │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │  2. Initialize Empty Schedule    │
        │  └─ All staff: blank shifts      │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ PRE-PHASE: Apply must_day_off    │
        │ └─ All staff: ×                  │
        │   (Highest priority baseline)    │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ PHASE 1: Apply Priority Rules    │
        │ ├─ Avoid avoided shifts          │
        │ ├─ Assign preferred shifts       │
        │ └─ Check daily limits            │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ PHASE 2: Staff Group Constraints │
        │ └─ Only 1 member off per group   │
        └──────────────────────────────────┘
        ├─ Re-enforce Priority Rules ◄────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ PHASE 3: Distribute Off Days     │
        │ ├─ Random allocation             │
        │ ├─ Respect monthly limits        │
        │ ├─ Avoid adjacent conflicts      │
        │ └─ Check daily limits            │
        └──────────────────────────────────┘
        ├─ Re-enforce Group Constraints ◄─┘
        ├─ Re-enforce Priority Rules ◄────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ PHASE 4: 5-Day Rest Constraint   │
        │ └─ No 5+ consecutive work days   │
        └──────────────────────────────────┘
        ├─ Re-enforce Group Constraints ◄─┘
        ├─ Re-enforce Priority Rules ◄────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ PHASE 5: Coverage Compensation   │
        │ └─ Backup staff when primary off │
        └──────────────────────────────────┘
        ├─ Re-enforce Priority Rules ◄────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ PHASE 6: Final Adjustments       │
        │ └─ Tune for operations           │
        └──────────────────────────────────┘
        ├─ Re-enforce Priority Rules ◄────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ Phase 3 Integration (FINAL)      │
        │ ├─ Apply must_day_off (ALL)      │
        │ ├─ Override with △ (eligible)    │
        │ ├─ Apply must_work (OVERRIDE)    │
        │ └─ ⚠️ FINAL OVERRIDE - no more  │
        │    changes after this!           │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ Post-Generation Balancing        │
        │ ├─ Ensure min 2 off per day      │
        │ ├─ Ensure max 3 off per day      │
        │ ├─ Skip calendar rule dates      │
        │ ├─ Check adjacent conflicts      │
        │ └─ ⚠️ Warn if MIN not met        │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ 5-DAY REST Enforcement (Phase 6.2)│
        │ ├─ Scan for >5 work streaks      │
        │ ├─ Insert × to break streaks     │
        │ └─ Labor law compliance          │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ POST-REPAIR: Consecutive Off Days│
        │ └─ Fix clustering patterns       │
        └──────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────┐
        │ 3. Return Final Schedule         │
        │ └─ Ready to save to backend      │
        └──────────────────────────────────┘
```

---

## 16. Conclusion

The AI schedule generation system is a carefully orchestrated multi-phase process that respects business rules while maintaining operational flexibility. The key to its success is:

1. **Clear prioritization:** Calendar rules > constraints > preferences
2. **Defensive validation:** Check before assigning, not after
3. **Re-enforcement:** Apply higher-tier constraints after each phase
4. **Final override:** Phase 3 always runs last
5. **Graceful degradation:** Fallbacks when primary options fail

When modifying the system, always remember:
- **Never move PRE-PHASE or Phase 3**
- **Always re-enforce after major phases**
- **Always skip calendar rule dates in balancing**
- **Always validate before assigning**
- **Always test calendar rule interactions**
- **5-day rest enforcement is critical for labor law compliance** (Phase 6.2)

By following these principles, the system reliably generates schedules that satisfy all business requirements while respecting staff preferences and maintaining operational integrity.

