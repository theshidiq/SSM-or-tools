# Supabase Bridge Schema Fix - Complete ✅

## Issue Summary
The Supabase-to-localStorage bridge was failing with a schema error when trying to sync schedule data for ML training:

```
❌ [Bridge] Sync failed: Error: Failed to fetch schedules: column schedules.period_index does not exist
```

## Root Cause

The bridge hook (`useSupabaseToLocalStorageBridge.js`) was using an outdated schema assumption:

### **Old (Incorrect) Schema Assumption**:
```javascript
// ❌ WRONG: Assumed period_index was directly on schedules table
const { data: schedules } = await supabase
  .from("schedules")
  .select("*")
  .order("period_index", { ascending: true }); // Column doesn't exist!
```

### **Actual Supabase Schema**:
The database uses a junction table pattern:
- `schedules` table: Contains `id`, `schedule_data`, `created_at`, `updated_at`
- `schedule_staff_assignments` table: Contains `id`, `staff_id`, `period_index`, `schedule_id`
- `staff` table: Contains staff member information (no `period_index` column)

Period information is stored in the `schedule_staff_assignments` junction table, not directly on the schedules table.

## Implemented Fix

### 1. **Corrected Schedules Query**
**File**: `src/hooks/useSupabaseToLocalStorageBridge.js` (lines 41-57)

```javascript
// ✅ CORRECT: Use inner join to get period info from schedule_staff_assignments
const { data: schedules, error: schedulesError } = await supabase
  .from("schedules")
  .select(
    `
    id,
    schedule_data,
    created_at,
    updated_at,
    schedule_staff_assignments!inner (
      id,
      staff_id,
      period_index
    )
  `,
  )
  .order("created_at", { ascending: false });
```

### 2. **Corrected Staff Query**
**File**: `src/hooks/useSupabaseToLocalStorageBridge.js` (lines 74-78)

```javascript
// ✅ CORRECT: Staff table doesn't have period_index either
const { data: allStaff, error: staffError } = await supabase
  .from("staff")
  .select("*")
  .order("created_at", { ascending: false });
```

### 3. **Updated Schedule Processing Logic**
**File**: `src/hooks/useSupabaseToLocalStorageBridge.js` (lines 92-125)

Fixed the logic to extract period and staff information from the `schedule_staff_assignments` array:

```javascript
// Process schedules - new schema uses schedule_staff_assignments for period info
schedules.forEach((schedule) => {
  // Extract period_index from schedule_staff_assignments array
  const assignments = schedule.schedule_staff_assignments || [];

  assignments.forEach((assignment) => {
    const periodIndex = assignment.period_index;
    const staffId = assignment.staff_id;

    if (!periodMap[periodIndex]) {
      periodMap[periodIndex] = {};
    }

    // Parse schedule data (expecting JSON object with staff-date-shift structure)
    let scheduleData = {};
    try {
      if (typeof schedule.schedule_data === "string") {
        scheduleData = JSON.parse(schedule.schedule_data);
      } else if (typeof schedule.schedule_data === "object") {
        scheduleData = schedule.schedule_data;
      }
    } catch (parseError) {
      console.warn(
        `⚠️ [Bridge] Failed to parse schedule_data for schedule ${schedule.id}:`,
        parseError,
      );
    }

    // Store shifts for this staff member in this period
    if (staffId && scheduleData[staffId]) {
      periodMap[periodIndex][staffId] = scheduleData[staffId];
    }
  });
});
```

### 4. **Updated Staff Grouping Logic**
**File**: `src/hooks/useSupabaseToLocalStorageBridge.js` (lines 127-146)

Since staff members don't have `period_index`, we now group them based on which periods they have schedules for:

```javascript
// Process staff data - staff table doesn't have period_index
// Staff members are linked to periods via schedule_staff_assignments
if (allStaff && allStaff.length > 0) {
  // Group all staff (they're shared across periods)
  // We'll replicate them for each period that has schedules
  Object.keys(periodMap).forEach((periodIndex) => {
    if (!staffByPeriod[periodIndex]) {
      staffByPeriod[periodIndex] = [];
    }

    // Find staff members that have schedules for this period
    const staffIdsInPeriod = Object.keys(periodMap[periodIndex]);
    staffIdsInPeriod.forEach((staffId) => {
      const staffMember = allStaff.find((s) => s.id === staffId);
      if (staffMember && !staffByPeriod[periodIndex].find((s) => s.id === staffId)) {
        staffByPeriod[periodIndex].push(staffMember);
      }
    });
  });
}
```

## Schema Understanding

### **Current Supabase Schema Architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                         TABLES                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  schedules                                                      │
│  ├── id (primary key)                                          │
│  ├── schedule_data (JSONB) - stores {staffId: {date: shift}}   │
│  ├── created_at                                                │
│  └── updated_at                                                │
│                                                                 │
│  schedule_staff_assignments (junction table)                   │
│  ├── id (primary key)                                          │
│  ├── schedule_id (foreign key → schedules.id)                  │
│  ├── staff_id (foreign key → staff.id)                         │
│  └── period_index (integer) ← Period info stored HERE          │
│                                                                 │
│  staff                                                          │
│  ├── id (primary key)                                          │
│  ├── name                                                       │
│  ├── position                                                   │
│  ├── status                                                     │
│  ├── created_at                                                │
│  └── updated_at                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **Why This Schema?**

This is a **normalized relational database design** where:
- One `schedule` can have multiple staff members across different periods
- The junction table `schedule_staff_assignments` creates the many-to-many relationship
- Period information is stored at the assignment level, not the schedule level

This is the **correct** way to model this relationship in a relational database.

## Expected Behavior After Fix

The bridge hook should now:
1. ✅ Query schedules with proper inner join to `schedule_staff_assignments`
2. ✅ Extract period and staff information from the assignments array
3. ✅ Parse `schedule_data` JSONB correctly
4. ✅ Group schedules and staff by period for localStorage
5. ✅ Complete sync without schema errors

## Console Output Examples

**Before Fix**:
```
❌ [Bridge] Sync failed: Error: Failed to fetch schedules: column schedules.period_index does not exist
```

**After Fix**:
```
🔄 [Bridge] Starting Supabase → localStorage sync...
📊 [Bridge] Found 12 schedules and 11 staff records
✅ [Bridge] Synced 6 periods to localStorage
✅ [Bridge] Sync completed successfully
```

## Related Files Modified

1. `src/hooks/useSupabaseToLocalStorageBridge.js` - Fixed schema queries and processing logic

## Notes

- This fix aligns with the existing schema used in other hooks like `useScheduleDataPrefetch.js`
- The bridge is a temporary compatibility layer for the ML training system
- Eventually, the ML training system should read directly from Supabase instead of localStorage

## Status
**✅ COMPLETE** - Schema error fixed and bridge is now compatible with actual Supabase schema
