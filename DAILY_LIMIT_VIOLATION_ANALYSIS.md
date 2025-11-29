# Daily Limit Violation Analysis

## Problem Report

**User Issue**: Generated schedule violates daily limits
- **Dec 21 (金)**: 4 staff have off days (井岡×, 田辺×, 古藤×, 安井×) **← VIOLATION**
- **Dec 24 (月)**: Only 1 staff off (カマル×)
- **Expected**: Max 3 staff off per day (maxOffPerDay = 3)

User observation: "the distribution, not fair on the schedule"

## Root Cause Analysis

### THREE Critical Places Where × is Assigned WITHOUT Daily Limit Checks

#### 1. **Calendar must_day_off Rules** (Line 1115-1122) ← **PRIMARY CAUSE**

**Location**: `src/ai/hybrid/BusinessRuleValidator.js:1115-1122`

**Code**:
```javascript
if (rule.must_day_off) {
  // Apply to ALL staff (including backup staff - calendar rules override everything)
  staffMembers.forEach((staff) => {
    schedule[staff.id][dateKey] = "×"; // Force day off ← NO DAILY LIMIT CHECK!
  });
  mustDayOffCount++;
  console.log(`✅ [PRE-PHASE] All staff: × on ${dateKey} (must_day_off)`);
}
```

**Problem**:
- If Dec 21 is marked as `must_day_off` in calendar rules
- **ALL 10 staff members** would get × on that date
- Completely ignores maxOffPerDay (3 people)
- This is executed FIRST, before any other rules

**Impact**: SEVERE - Can assign unlimited × on a single date

---

#### 2. **Priority Rules** (Line 1396) ← **SECONDARY CAUSE**

**Location**: `src/ai/hybrid/BusinessRuleValidator.js:1396`

**Code**:
```javascript
// In applyPriorityRules()
if (adjacentConflict) {
  // Skip...
} else {
  schedule[staff.id][dateKey] = shiftValue; // ← NO DAILY LIMIT CHECK!
  // shiftValue can be "×" if preferred shift is "off"
}
```

**Problem**:
- If multiple staff have preferred off days on Friday
- Priority rules assign × without checking daily limits
- Re-applied 5 times during generation

**Impact**: HIGH - Can accumulate × assignments beyond daily limit

---

#### 3. **Staff Group Constraints** (Line 1661) ← **TERTIARY CAUSE**

**Location**: `src/ai/hybrid/BusinessRuleValidator.js:1661`

**Code**:
```javascript
// In applyStaffGroupConstraints()
const staffMember = staffMembers.find(s => s.id === member.staffId);
const workingShift = staffMember && staffMember.status === "パート" ? "○" : "";
schedule[member.staffId][dateKey] = workingShift; // ← Assigns "" or ○

// But earlier (line 1652):
if (allMembersHaveOff || allHaveEarly) {
  schedule[member.staffId][dateKey] = "×"; // ← NO DAILY LIMIT CHECK!
}
```

**Problem**:
- When resolving staff group conflicts
- Can assign × to multiple group members on same date
- No daily limit check

**Impact**: MEDIUM - Can add 2-3 extra × on a date

---

### Current Daily Limit Implementation (ONLY in distributeOffDays)

**Location**: `src/ai/hybrid/BusinessRuleValidator.js:2058-2075`

**Code**:
```javascript
// ✅ DAILY LIMIT CHECK: Count actual current off-staff before assigning
const actualOffCount = staffMembers.filter(s =>
  schedule[s.id]?.[bestCandidate.dateKey] === "×"
).length;

if (actualOffCount >= maxOffPerDay) {
  console.log(
    `⚠️ [DAILY-LIMIT] ${staff.name}: Cannot assign × on ${date} - ` +
    `already ${actualOffCount}/${maxOffPerDay} staff off`,
  );
  // Skip this date and try next
  continue;
}

// Safe to assign × without violating weekly limit or daily limit
schedule[staff.id][bestCandidate.dateKey] = "×";
globalOffDayCount[bestCandidate.dateKey]++;
```

**This ONLY works in `distributeOffDays()` phase!**

By the time `distributeOffDays()` runs, the damage is already done:
1. Calendar rules already assigned too many ×
2. Priority rules already assigned too many ×
3. Staff group rules already assigned too many ×

## Execution Order (The Problem)

```
Phase 1: Calendar must_day_off rules     ← NO DAILY LIMIT CHECK ❌
  ↓
Phase 2: Priority rules (5 times)         ← NO DAILY LIMIT CHECK ❌
  ↓
Phase 3: Staff group constraints          ← NO DAILY LIMIT CHECK ❌
  ↓
Phase 4: distributeOffDays()              ← HAS DAILY LIMIT CHECK ✅ (too late!)
```

**By Phase 4, daily limits are already violated!**

## Why Current Implementation Fails

### Problem 1: No Global Daily Limit Enforcement

- Each rule layer assigns × independently
- No central check before × assignment
- `globalOffDayCount` is only used in `distributeOffDays()`

### Problem 2: Calendar Rules Override Everything

From line 1116 comment: "calendar rules override everything"
- This is correct for priority, but not for quantity limits
- calendar `must_day_off` should NOT mean "everyone gets off"
- Should mean "prioritize off days on this date, but respect limits"

### Problem 3: Priority Rules Applied 5 Times

Priority rules are re-applied 5 times (lines 1131, 1136, 1143, 1150, 1155, 1160)
- Each application can assign more ×
- No cumulative check across applications

## Solution Strategy

### Option 1: Add Daily Limit Check to ALL × Assignments (Recommended)

**Create a centralized function**:
```javascript
function canAssignOffDay(schedule, staffId, dateKey, staffMembers, maxOffPerDay) {
  const currentOffCount = staffMembers.filter(s =>
    schedule[s.id]?.[dateKey] === "×"
  ).length;

  return currentOffCount < maxOffPerDay;
}
```

**Apply BEFORE every × assignment**:
1. Calendar must_day_off (line 1118)
2. Priority rules (line 1396)
3. Staff group constraints (line 1652)
4. distributeOffDays (already has it at line 2058)

### Option 2: Change must_day_off Interpretation (Recommended)

**Current behavior** (WRONG):
- `must_day_off = true` → ALL staff get ×

**Correct behavior** (BETTER):
- `must_day_off = true` → This date is PREFERRED for off days
- Still respect `maxOffPerDay` limit
- Distribute × fairly among eligible staff

**Implementation**:
```javascript
if (rule.must_day_off) {
  // Instead of forcing ALL staff to ×,
  // just mark this date as high-priority for off-day distribution
  console.log(`📅 [CALENDAR] ${dateKey} marked as must_day_off (will be prioritized)`);
  // Later, distributeOffDays() will prioritize this date
}
```

### Option 3: Post-Generation Balancing (Complementary)

After all rules are applied:
1. Count off days per date
2. If any date exceeds `maxOffPerDay`, redistribute
3. If any date has fewer than `minOffPerDay` (e.g., 2), add more

## Recommended Fix

**Implement ALL THREE approaches**:

### Step 1: Create Centralized Check Function
```javascript
// Add this helper function (around line 90)
function canAssignOffDay(schedule, dateKey, staffMembers, maxOffPerDay) {
  const currentOffCount = staffMembers.filter(s =>
    schedule[s.id]?.[dateKey] === "×"
  ).length;

  const canAssign = currentOffCount < maxOffPerDay;

  if (!canAssign) {
    console.log(
      `⏭️ [DAILY-LIMIT] Cannot assign × on ${dateKey} - ` +
      `already ${currentOffCount}/${maxOffPerDay} staff off`
    );
  }

  return canAssign;
}
```

### Step 2: Fix Calendar must_day_off (Line 1115-1122)
```javascript
if (rule.must_day_off) {
  // ✅ FIX: Don't assign × to ALL staff, just prioritize this date
  // Mark this date for preferential off-day distribution
  console.log(`📅 [CALENDAR] ${dateKey} marked as must_day_off (high priority)`);

  // Optional: Assign × to a LIMITED number of staff (respect daily limit)
  let offDaysAssigned = 0;
  for (const staff of staffMembers) {
    if (canAssignOffDay(schedule, dateKey, staffMembers, maxOffPerDay)) {
      schedule[staff.id][dateKey] = "×";
      offDaysAssigned++;
      console.log(`✅ [CALENDAR] ${staff.name}: × on ${dateKey} (must_day_off, ${offDaysAssigned}/${maxOffPerDay})`);
    } else {
      // Daily limit reached, stop assigning
      console.log(`⏭️ [CALENDAR] Daily limit reached for ${dateKey}, skipping remaining staff`);
      break;
    }
  }
}
```

### Step 3: Add Check to Priority Rules (Line 1396)
```javascript
// In applyPriorityRules(), before assignment
if (adjacentConflict) {
  console.log(`⏭️ [PRIORITY] Cannot assign, blocked by adjacent conflict`);
} else if (shiftValue === "×" && !canAssignOffDay(schedule, dateKey, staffMembers, maxOffPerDay)) {
  console.log(`⏭️ [PRIORITY] Cannot assign × to ${staff.name}, daily limit reached`);
} else {
  schedule[staff.id][dateKey] = shiftValue;
  staffRulesApplied++;
  console.log(`✅ [PRIORITY] ${staff.name}: SET "${shiftValue}" on ${dateKey}`);
}
```

### Step 4: Add Check to Staff Group Constraints (Line 1652)
```javascript
if (allMembersHaveOff || allHaveEarly) {
  // Need to change someone in the group to work
  const randomIndex = Math.floor(Math.random() * group.members.length);
  const memberToChange = group.members[randomIndex];

  // ✅ FIX: Check daily limit before assigning ×
  if (canAssignOffDay(schedule, dateKey, staffMembers, maxOffPerDay)) {
    schedule[memberToChange.staffId][dateKey] = "×";
    console.log(`✅ [STAFF-GROUP] Changed ${memberToChange.staffName} to work (×)`);
  } else {
    console.log(`⏭️ [STAFF-GROUP] Cannot assign ×, daily limit reached`);
    // Assign working shift instead
    schedule[memberToChange.staffId][dateKey] = "";
  }
}
```

## Expected Results After Fix

### Before Fix (Current)
- Dec 21: 4 staff off (VIOLATION)
- Dec 24: 1 staff off (UNDER-UTILIZED)
- Unfair distribution

### After Fix
- All dates: 2-3 staff off (within limit)
- Fair distribution across all dates
- No daily limit violations

## Testing Checklist

- [ ] Generate schedule for current month
- [ ] Check ALL dates for daily limit violations
- [ ] Count off days per date: should be 2-3, never exceed 3
- [ ] Verify fair distribution (no dates with only 1 off)
- [ ] Check console logs for daily limit warnings
- [ ] Verify calendar `must_day_off` dates are respected but limited

## Files to Modify

1. **src/ai/hybrid/BusinessRuleValidator.js**
   - Line ~90: Add `canAssignOffDay()` helper function
   - Lines 1115-1122: Fix calendar must_day_off logic
   - Line 1396: Add check in priority rules
   - Line 1652: Add check in staff group constraints

## Priority

**CRITICAL** - This fix should be applied immediately because:
1. Daily limits are a hard business requirement
2. Violations create operational problems (too many staff off = under-staffed)
3. Unfair distribution impacts staff satisfaction

## Related Issues

- Adjacent conflict fix (commit 4a40903) - Similar pattern of missing checks
- ○ symbol fix (commit 3d87651) - Fixed symbol assignment logic
- This follows the same principle: **Check constraints BEFORE assignment**
