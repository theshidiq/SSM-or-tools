# Priority Rules UI Display Fix - Staff Members Not Showing

## Problem

Staff IDs were being saved to the database correctly, but the UI was not displaying them in the rule card summary.

### Visual Issue
```
┌─────────────────────────────────────────┐
│ ⭐ new           High Priority   ✏️  🗑️ │
│                                         │
│ • Preferred Shift • 1 days             │  ❌ NO STAFF NAME SHOWN!
│                                         │
│ 📅 Sun                                  │
│ High Priority Rule   Hard Constraint    │
└─────────────────────────────────────────┘
```

### Expected
```
┌─────────────────────────────────────────┐
│ ⭐ new           High Priority   ✏️  🗑️ │
│                                         │
│ John Doe • Preferred Shift • 1 days    │  ✅ STAFF NAME VISIBLE!
│                                         │
│ 📅 Sun                                  │
│ High Priority Rule   Hard Constraint    │
└─────────────────────────────────────────┘
```

## Root Cause

The UI component only displayed the **first** staff member using legacy `staffId` (singular):

```javascript
// ❌ OLD CODE - Only checked single staffId
const staff = getStaffById(rule.staffId);  // Only gets first staff

// Display
<p>{staff?.name} • {ruleType?.label}</p>  // Shows nothing if staffId undefined
```

**Problems:**
1. Only looked at `rule.staffId` (first staff member)
2. Ignored `rule.staffIds` array (all staff members)
3. If `staffId` was undefined → no staff name shown
4. Couldn't show multiple staff members

## Solution

Updated the rule card to:
1. **Get ALL staff members** from `staffIds` array
2. **Display appropriately** based on count
3. **Show warning** if no staff assigned

### Code Changes

**File**: `src/components/settings/tabs/PriorityRulesTab.jsx`

#### Change 1: Get All Staff Members (Lines 595-597)

**Before:**
```javascript
const staff = getStaffById(rule.staffId);  // Only first staff
```

**After:**
```javascript
// ✅ FIX: Get ALL staff members for this rule (not just first one)
const ruleStaffIds = rule.staffIds || (rule.staffId ? [rule.staffId] : []);
const ruleStaff = ruleStaffIds.map(id => getStaffById(id)).filter(Boolean);
```

#### Change 2: Display Logic (Lines 648-658)

**Before:**
```javascript
<p className="text-sm text-gray-600">
  {staff?.name} • {ruleType?.label}
  {/* ... days count ... */}
</p>
```

**After:**
```javascript
<p className="text-sm text-gray-600">
  {/* ✅ FIX: Show ALL staff members, not just first one */}
  {ruleStaff.length > 0 ? (
    ruleStaff.length === 1 ? (
      ruleStaff[0].name                    // Single staff: "John Doe"
    ) : (
      `${ruleStaff.length} staff members`  // Multiple: "3 staff members"
    )
  ) : (
    <span className="text-red-600">No staff assigned</span>  // None: Warning
  )} • {ruleType?.label}
  {/* ... days count ... */}
</p>
```

## Display Behavior

### Case 1: Single Staff Member
```
John Doe • Preferred Shift • 2 days
```

### Case 2: Multiple Staff Members
```
3 staff members • Preferred Shift • 2 days
```

### Case 3: No Staff Assigned
```
No staff assigned • Preferred Shift • 2 days
        ⬆️ Red warning text
```

## Benefits

1. ✅ **Shows staff names** for rules with assigned staff
2. ✅ **Supports multiple staff** members per rule
3. ✅ **Clear warnings** when staff not assigned
4. ✅ **Backward compatible** with old `staffId` format
5. ✅ **Better UX** - users can see who the rule applies to

## Data Flow

```
Database (JSONB)
    ↓
rule_definition.staff_ids: ["uuid-1", "uuid-2"]
    ↓
React Hook (usePriorityRulesData)
    ↓
rule.staffIds: ["uuid-1", "uuid-2"]
    ↓
UI Component (PriorityRulesTab)
    ↓
ruleStaff: [{ id: "uuid-1", name: "John" }, { id: "uuid-2", name: "Jane" }]
    ↓
Display: "2 staff members • Preferred Shift"
```

## Testing

### Test 1: Single Staff Rule
1. Create rule with 1 staff member
2. Check rule card shows staff name
3. Expected: "John Doe • Preferred Shift"

### Test 2: Multiple Staff Rule
1. Create rule with 3 staff members
2. Check rule card shows count
3. Expected: "3 staff members • Preferred Shift"

### Test 3: No Staff (Incomplete Rule)
1. Create rule without staff (shouldn't save to DB)
2. If somehow in UI, should show warning
3. Expected: "No staff assigned • Preferred Shift" (red text)

### Test 4: Old Format Compatibility
1. Load old rule with `conditions.staff_id`
2. Check staff name displays
3. Expected: Shows staff name from old format

## Related Fixes

This fix works together with:
1. **Staff ID Loading Fix** (`PRIORITY-RULES-TWO-ISSUES-FIX.md`)
   - Loads staff IDs from both old and new formats
2. **Validation Fix** (`PRIORITY-RULES-STAFF-IDS-FIX.md`)
   - Prevents creating rules without staff
3. **Schema Cleanup** (`PRIORITY-RULES-SCHEMA-CLEANUP.md`)
   - Single source of truth in JSONB

## Files Modified

1. **`src/components/settings/tabs/PriorityRulesTab.jsx`**
   - Lines 595-597: Get all staff members
   - Lines 648-658: Display logic for staff names

## Status

✅ **Code Fixed**: UI now displays staff members correctly
⏳ **User Testing**: Restart dev server and refresh browser
⏳ **Verification**: Check that staff names appear in rule cards

---

**Date**: 2025-11-13
**Issue**: Staff IDs saved to database but not displayed in UI
**Cause**: UI only checked legacy `staffId` (singular), ignored `staffIds` array
**Fix**: Get all staff from `staffIds` array and display appropriately
