# Monthly Limits Enhancement Plan

**Document Version:** 1.0
**Created:** 2025-12-07
**Status:** Planning Phase
**Author:** Claude Code

---

## Executive Summary

This document outlines the implementation plan for enhancing the Monthly Limits feature to:
1. Support **minimum monthly limits** (e.g., minimum 7 days off per month)
2. Make monthly limits **override weekly limits** when conflicts occur
3. Ensure monthly limits **respect calendar rules** (must_day_off, early_shift_preferences) by dynamically adjusting effective limits

---

## Current Architecture Analysis

### Current Constraint Hierarchy (Before Enhancement)

```
Priority Order (Current):
1. [HIGHEST] Calendar Rules (must_day_off, must_work) - PRE-PHASE & FINAL-OVERRIDE
2. Priority Rules (staff-specific preferences)
3. Staff Group Constraints
4. Daily Limits (MIN/MAX per day)
5. Weekly Limits (rolling 7-day window)
6. Monthly Limits (MAX only, validated post-generation)
7. [LOWEST] Distribution Rules (consecutive off patterns)
```

### Current Gaps Identified

| Gap | Description | Impact |
|-----|-------------|--------|
| **No MIN Monthly Enforcement** | Only MAX monthly limit exists | Cannot guarantee staff get enough rest |
| **Weekly > Monthly Conflict** | Weekly limits can cause monthly violations | Staff may exceed monthly limit due to weekly distribution |
| **No Calendar Adjustment** | Monthly limits don't account for calendar rules | Must_day_off dates consume monthly quota unfairly |
| **No Early Shift Adjustment** | Early shift days not considered in monthly calculation | Staff with many △ may appear to have fewer offs |

---

## User Requirements

### Requirement 1: Minimum Monthly Limit
> "Apply minimum monthly limit with 7 days off"

- Staff MUST have at least N days off per month (e.g., minimum 7)
- System should ADD more × if staff has fewer than minimum
- Works alongside existing MAX limit

### Requirement 2: Monthly Override Weekly
> "Monthly limit is above layer of weekly limits. If min=7, max=7.5 but weekly max=2/week (=8 total), override to follow monthly"

- Monthly limits take precedence over weekly limits
- If weekly distribution would cause `8 offs` but monthly MAX is `7.5`, enforce monthly
- Redistribution should respect weekly patterns as much as possible

### Requirement 3: Calendar Rules Adjustment
> "Monthly limits doesn't affect on calendar rules. Max 7.5 will override with calendar_rules (must_day_off count) and staff_early_preference"

- Must_day_off dates are **excluded** from monthly limit calculation
- Early shift (△) preferences on must_day_off dates are excluded
- **Effective Monthly Limit** = Configured Limit - Calendar Rule Days

**Example:**
```
Configured MAX: 7.5 days off
Calendar must_day_off dates: 3 dates
Staff has early shift preference on 1 of those dates

Effective MAX for this staff: 7.5 days off (calendar days don't count)
Calendar × days: 2 (counted separately, not toward limit)
Calendar △ days: 1 (counted separately, not toward limit)
Available flexible off days: 7.5
```

---

## Proposed Architecture

### New Constraint Hierarchy (After Enhancement)

```
Priority Order (New):
1. [HIGHEST] Calendar Rules (must_day_off, must_work) - IMMUTABLE
   ├── Does NOT count toward monthly limits
   └── Early shift preferences also excluded

2. MONTHLY LIMITS (NEW: Enforced DURING generation) ← PROMOTED
   ├── MIN monthly limit enforcement (new)
   ├── MAX monthly limit enforcement (enhanced)
   └── Overrides weekly limits when conflict

3. Priority Rules (staff-specific preferences)

4. Staff Group Constraints

5. Daily Limits (MIN/MAX per day)

6. Weekly Limits (demoted, advisory when conflicts with monthly)
   └── Violated if necessary to meet monthly constraints

7. [LOWEST] Distribution Rules
```

### Data Structure Changes

#### 1. Enhanced Monthly Limit Configuration

**Current Structure:**
```javascript
{
  id: "monthly-limit-off-days",
  limitType: "max_off_days",
  maxCount: 8,  // Only MAX
  scope: "individual",
  // ...
}
```

**New Structure:**
```javascript
{
  id: "monthly-limit-off-days",
  limitType: "off_days",  // Renamed from "max_off_days"
  minCount: 7,            // NEW: Minimum off days required
  maxCount: 7.5,          // Maximum off days allowed
  countHalfDays: true,    // NEW: Support 0.5 increments
  excludeCalendarRules: true,  // NEW: Exclude must_day_off from count
  excludeEarlyShiftOnCalendar: true,  // NEW: Exclude △ on must_day_off
  overrideWeeklyLimits: true,  // NEW: Monthly takes precedence
  scope: "individual",
  targetIds: [],
  constraints: {
    isHardConstraint: true,
    penaltyWeight: 50  // Higher than weekly (40)
  }
}
```

#### 2. Effective Limit Calculation

**New Helper Function:**
```javascript
function calculateEffectiveMonthlyLimit(staffId, monthlyLimit, calendarRules, earlyShiftPrefs) {
  const configuredMin = monthlyLimit.minCount;
  const configuredMax = monthlyLimit.maxCount;

  // Count calendar rule days for this staff
  let calendarOffDays = 0;
  let calendarEarlyDays = 0;

  Object.keys(calendarRules).forEach(dateKey => {
    if (calendarRules[dateKey].must_day_off) {
      // Check if staff has early shift preference on this date
      if (earlyShiftPrefs[staffId]?.[dateKey] === true) {
        calendarEarlyDays++;  // △ on must_day_off
      } else {
        calendarOffDays++;    // × on must_day_off
      }
    }
  });

  // Effective limits (calendar days don't count toward these)
  return {
    effectiveMin: configuredMin,  // Still need MIN flexible offs
    effectiveMax: configuredMax,  // Still can have MAX flexible offs
    calendarOffDays,              // Tracked separately
    calendarEarlyDays,            // Tracked separately
    totalOffDays: calendarOffDays + configuredMax,  // Total possible
  };
}
```

---

## Implementation Plan

### Phase 1: Database & Configuration (Low Risk)

#### 1.1 Update Monthly Limits Schema

**File:** `database/migrations/schema/005_create_business_rules.sql`

```sql
-- Add new columns to monthly_limits table
ALTER TABLE monthly_limits ADD COLUMN IF NOT EXISTS min_count DECIMAL(3,1);
ALTER TABLE monthly_limits ADD COLUMN IF NOT EXISTS exclude_calendar_rules BOOLEAN DEFAULT true;
ALTER TABLE monthly_limits ADD COLUMN IF NOT EXISTS exclude_early_shift_calendar BOOLEAN DEFAULT true;
ALTER TABLE monthly_limits ADD COLUMN IF NOT EXISTS override_weekly_limits BOOLEAN DEFAULT true;
```

#### 1.2 Update ConfigurationService

**File:** `src/services/ConfigurationService.js`

- Add `minCount` parsing in `getMonthlyLimits()`
- Add new boolean flags parsing
- Update default values

#### 1.3 Update UI Components

**File:** `src/components/settings/tabs/LimitsTab.jsx` (or similar)

- Add MIN count input field
- Add toggle for "Exclude Calendar Rules"
- Add toggle for "Override Weekly Limits"

---

### Phase 2: Effective Limit Calculator (Medium Risk)

#### 2.1 Create MonthlyLimitCalculator Utility

**New File:** `src/ai/utils/MonthlyLimitCalculator.js`

```javascript
/**
 * MonthlyLimitCalculator
 *
 * Calculates effective monthly limits by considering:
 * - Base configured MIN/MAX limits
 * - Calendar rules (must_day_off dates)
 * - Early shift preferences on calendar dates
 */
export class MonthlyLimitCalculator {

  /**
   * Calculate effective limits for a staff member
   */
  static calculateEffectiveLimits(staffId, config) {
    const { monthlyLimit, calendarRules, earlyShiftPrefs, dateRange } = config;

    // Implementation as described above
  }

  /**
   * Get current off-day count excluding calendar rules
   */
  static countFlexibleOffDays(staffId, schedule, calendarRules) {
    let count = 0;
    Object.keys(schedule[staffId] || {}).forEach(dateKey => {
      const shift = schedule[staffId][dateKey];
      const isCalendarRule = calendarRules[dateKey]?.must_day_off;

      if (shift === "×" && !isCalendarRule) {
        count++;  // Only count non-calendar off days
      }
    });
    return count;
  }

  /**
   * Check if adding an off day would violate monthly MAX
   */
  static canAddOffDay(staffId, schedule, effectiveLimits) {
    const currentCount = this.countFlexibleOffDays(staffId, schedule, effectiveLimits.calendarRules);
    return currentCount < effectiveLimits.effectiveMax;
  }

  /**
   * Check if staff needs more off days to meet monthly MIN
   */
  static needsMoreOffDays(staffId, schedule, effectiveLimits) {
    const currentCount = this.countFlexibleOffDays(staffId, schedule, effectiveLimits.calendarRules);
    return currentCount < effectiveLimits.effectiveMin;
  }
}
```

---

### Phase 3: Generation Flow Integration (High Risk)

#### 3.1 Update BusinessRuleValidator

**File:** `src/ai/hybrid/BusinessRuleValidator.js`

**3.1.1 Add Effective Limits Calculation at Start**

```javascript
// In generateRuleBasedSchedule(), after loading settings:

// Calculate effective monthly limits per staff
const effectiveLimitsMap = new Map();
staffMembers.forEach(staff => {
  effectiveLimitsMap.set(staff.id, MonthlyLimitCalculator.calculateEffectiveLimits(
    staff.id,
    { monthlyLimit, calendarRules, earlyShiftPrefs, dateRange }
  ));
});
```

**3.1.2 Integrate into distributeOffDays()**

```javascript
// In distributeOffDays(), modify assignment logic:

// Before assigning × to a staff member:
const effectiveLimits = effectiveLimitsMap.get(staff.id);
if (!MonthlyLimitCalculator.canAddOffDay(staff.id, schedule, effectiveLimits)) {
  console.log(`⏭️ [MONTHLY] ${staff.name}: Skip × on ${dateKey} (would exceed monthly MAX ${effectiveLimits.effectiveMax})`);
  continue;  // Skip this staff, try another
}
```

**3.1.3 Add MIN Monthly Enforcement Phase**

```javascript
// NEW: After distributeOffDays(), add MIN enforcement

async enforceMinMonthlyLimits(schedule, staffMembers, effectiveLimitsMap, dateRange, calendarRules) {
  console.log("📊 [MIN-MONTHLY] Enforcing minimum monthly off days...");

  let addedCount = 0;

  for (const staff of staffMembers) {
    const effectiveLimits = effectiveLimitsMap.get(staff.id);

    while (MonthlyLimitCalculator.needsMoreOffDays(staff.id, schedule, effectiveLimits)) {
      // Find eligible date (not calendar rule, not already off, respects constraints)
      const eligibleDate = this.findEligibleDateForOff(staff.id, schedule, dateRange, calendarRules);

      if (!eligibleDate) {
        console.warn(`⚠️ [MIN-MONTHLY] ${staff.name}: Cannot meet MIN (no eligible dates)`);
        break;
      }

      schedule[staff.id][eligibleDate] = "×";
      addedCount++;
      console.log(`  ✅ [MIN-MONTHLY] ${staff.name}: Added × on ${eligibleDate}`);
    }
  }

  console.log(`📊 [MIN-MONTHLY] Added ${addedCount} off days to meet minimum limits`);
}
```

#### 3.2 Update Weekly Limit Validation

**File:** `src/ai/constraints/ConstraintEngine.js`

**3.2.1 Add Monthly Override Check**

```javascript
// In validateWeeklyLimits():

// If monthly override is enabled, skip weekly violation if monthly is satisfied
if (monthlyConfig.overrideWeeklyLimits) {
  const monthlyValid = this.validateMonthlyLimits(staffId, schedule, monthlyConfig);
  if (monthlyValid) {
    console.log(`⏭️ [WEEKLY] ${staffId}: Weekly violation ignored (monthly satisfied)`);
    return { valid: true, violations: [] };  // Monthly takes precedence
  }
}
```

---

### Phase 4: Execution Order Update (Medium Risk)

#### 4.1 Update Generation Flow in BusinessRuleValidator

**New Execution Order:**

```javascript
async generateRuleBasedSchedule(inputData, staffMembers, dateRange) {
  // 1. Load all settings & calculate effective limits
  const effectiveLimitsMap = this.calculateAllEffectiveLimits(staffMembers, ...);

  // 2. PRE-PHASE: Apply calendar rules (must_day_off → ×, must_work → work)
  await this.applyCalendarRulesPrePhase(schedule, calendarRules, staffMembers);

  // 3. Apply priority rules
  await this.applyPriorityRules(schedule, staffMembers, dateRange, priorityRules);

  // 4. Apply staff group constraints
  await this.applyStaffGroupConstraints(schedule, staffMembers, dateRange, staffGroups);

  // 5. Distribute off days (NOW respects monthly MAX during distribution)
  await this.distributeOffDays(schedule, staffMembers, dateRange, calendarRules, effectiveLimitsMap);

  // 6. NEW: Enforce MIN monthly limits (add more × if needed)
  await this.enforceMinMonthlyLimits(schedule, staffMembers, effectiveLimitsMap, dateRange, calendarRules);

  // 7. Balance daily limits (SKIPS if would violate monthly)
  await this.balanceDailyLimits(schedule, staffMembers, dateRange, effectiveLimitsMap);

  // 8. Validate weekly limits (NOW demoted, advisory only)
  const weeklyViolations = this.validateWeeklyLimits(schedule, staffMembers, dateRange);
  if (weeklyViolations.length > 0 && !monthlyConfig.overrideWeeklyLimits) {
    // Only correct if monthly doesn't override
    await this.correctWeeklyViolations(schedule, weeklyViolations);
  }

  // 9. Apply 5-day rest and consecutive off repairs
  await this.apply5DayRestRule(schedule, staffMembers, dateRange);
  await this.repairConsecutiveOffDays(schedule, staffMembers, dateRange);

  // 10. Phase 3 calendar integration (LAST within BusinessRuleValidator)
  await this.applyPhase3CalendarIntegration(schedule, staffMembers, calendarRules, earlyShiftPrefs);

  return schedule;
}
```

---

### Phase 5: Validation & Reporting (Low Risk)

#### 5.1 Add MIN Monthly Validation

**File:** `src/ai/constraints/ConstraintEngine.js`

```javascript
validateMinMonthlyOffLimits(schedule, staffMembers, monthlyLimits, calendarRules) {
  const violations = [];

  staffMembers.forEach(staff => {
    const effectiveLimits = MonthlyLimitCalculator.calculateEffectiveLimits(
      staff.id, { monthlyLimits, calendarRules }
    );

    const flexibleOffCount = MonthlyLimitCalculator.countFlexibleOffDays(
      staff.id, schedule, calendarRules
    );

    if (flexibleOffCount < effectiveLimits.effectiveMin) {
      violations.push({
        type: VIOLATION_TYPES.MONTHLY_MIN_OFF_LIMIT,
        staffId: staff.id,
        staffName: staff.name,
        severity: "high",
        message: `${staff.name} has only ${flexibleOffCount} flexible off days, need at least ${effectiveLimits.effectiveMin}`,
        details: {
          current: flexibleOffCount,
          minimum: effectiveLimits.effectiveMin,
          calendarOffDays: effectiveLimits.calendarOffDays
        }
      });
    }
  });

  return violations;
}
```

#### 5.2 Add Enhanced Reporting

- Log effective limits at generation start
- Log calendar rule exclusions
- Log weekly vs monthly conflict resolutions
- Summary report showing:
  - Calendar off days per staff
  - Flexible off days per staff
  - MIN/MAX compliance status

---

## Testing Strategy

### Test Case 1: MIN Monthly Enforcement
```
Config: MIN=7, MAX=8
Result: All staff should have at least 7 flexible off days
```

### Test Case 2: Monthly Override Weekly
```
Config: Monthly MAX=7, Weekly MAX=2 (would be 8/month)
Result: Staff should have exactly 7-7.5 off days, some weeks may have only 1
```

### Test Case 3: Calendar Rule Exclusion
```
Config: Monthly MAX=7, Calendar must_day_off=3 dates
Result: Staff has 3 calendar × + up to 7 flexible × = 10 total possible
Calendar days don't count toward the 7 MAX
```

### Test Case 4: Early Shift on Calendar Day
```
Config: Monthly MAX=7, Calendar must_day_off=3 dates
Staff A has early shift preference on 2 of those dates
Result: Staff A gets 2 △ + 1 × from calendar, + up to 7 flexible × = 10 total
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing generation | Medium | High | Extensive testing, feature flag |
| Performance degradation | Low | Medium | Optimize effective limit calculation caching |
| UI confusion | Medium | Low | Clear documentation, tooltips |
| Database migration issues | Low | Medium | Backwards compatible schema changes |

---

## Rollout Plan

### Stage 1: Internal Testing
- Implement behind feature flag
- Test with sample data
- Validate all test cases pass

### Stage 2: Limited Release
- Enable for select users
- Monitor for issues
- Gather feedback

### Stage 3: Full Release
- Remove feature flag
- Update documentation
- Train users on new features

---

## Files to Modify

| File | Changes | Risk Level |
|------|---------|------------|
| `database/migrations/xxx_enhance_monthly_limits.sql` | New columns | Low |
| `src/services/ConfigurationService.js` | Parse new fields | Low |
| `src/ai/utils/MonthlyLimitCalculator.js` | **NEW FILE** | Medium |
| `src/ai/hybrid/BusinessRuleValidator.js` | Integration | High |
| `src/ai/constraints/ConstraintEngine.js` | MIN validation, weekly override | Medium |
| `src/components/settings/tabs/LimitsTab.jsx` | UI for new fields | Low |
| `AI_GENERATION_FLOW_DOCUMENTATION.md` | Update docs | Low |

---

## Summary

This enhancement will:

1. **Add MIN monthly limit** - Ensure staff get minimum required rest days
2. **Promote monthly limits** - Monthly takes precedence over weekly when conflicts
3. **Smart calendar handling** - Calendar rule days don't count against monthly limits

The implementation follows a phased approach with proper testing and rollback capabilities.
