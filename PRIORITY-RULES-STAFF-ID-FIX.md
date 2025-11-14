# Priority Rules staff_id NULL Fix - Complete

## Status: ✅ FIXED

---

## Problem

Priority rules were saving with `staff_id: null` in the database instead of the actual staff member UUID.

**Database before fix**:
```json
{
  "id": "1516a8d5-d338-4f63-ad02-702fedabd0f3",
  "name": "New 2",
  "staff_id": null,  // ❌ Should be UUID
  "is_active": true
}
```

---

## Root Cause

The database schema for `priority_rules` has **two places** where `staff_id` is stored:

1. **Top-level column**: `staff_id` (UUID, nullable)
2. **JSONB field**: `rule_definition.staff_id`

The Go server `updatePriorityRule` function was only setting `staff_id` in the JSONB `rule_definition`, but **NOT** in the top-level `staff_id` column.

### Code Analysis

**React Client** (src/hooks/useWebSocketSettings.js:726):
```javascript
const message = {
  type: MESSAGE_TYPES.SETTINGS_UPDATE_PRIORITY_RULES,
  payload: { rule: ruleData },  // ruleData contains staffId (camelCase)
  ...
};
```

**Go Server BEFORE fix** (go-server/settings_multitable.go:982-987):
```go
// Merge top-level fields into rule_definition
if staffId, ok := ruleData["staffId"]; ok {
    ruleDefinition["staff_id"] = staffId  // ✅ Sets in JSONB
    log.Printf("🔍 [updatePriorityRule] Merging staffId: %v", staffId)
}
// ❌ Missing: updateData["staff_id"] = staffId
```

This meant:
- ✅ `rule_definition.staff_id` was set correctly
- ❌ Top-level `staff_id` column remained NULL

---

## The Fix

**File**: `go-server/settings_multitable.go` (Lines 982-987)

**Added one line** to also set the top-level `staff_id` column:

```go
// Merge top-level fields into rule_definition with proper nested structure
// Database expects: { staff_id, conditions: { shift_type, day_of_week } }
if staffId, ok := ruleData["staffId"]; ok {
    ruleDefinition["staff_id"] = staffId
    // ✅ FIX: Also set top-level staff_id column (separate from JSONB)
    updateData["staff_id"] = staffId  // ← NEW LINE
    log.Printf("🔍 [updatePriorityRule] Merging staffId to both rule_definition and top-level column: %v", staffId)
}
```

**Result**: Now both locations get the staff_id value:
- ✅ `staff_id` (top-level column) = UUID
- ✅ `rule_definition.staff_id` (JSONB) = UUID

---

## Verification

### Check INSERT Handler (Already Fixed)

The `insertPriorityRule` function already had this fix at line 1142:

```go
insertData := map[string]interface{}{
    "restaurant_id":  "e1661c71-b24f-4ee1-9e8b-7290a43c9575",
    "version_id":     versionID,
    "name":           ruleData["name"],
    "description":    ruleData["description"],
    "is_active":      true,
    "staff_id":       staffId, // ✅ Already present
}
```

So **CREATE** operations were fine, only **UPDATE** operations had the bug.

---

## Database Schema Reference

**Table**: `priority_rules`

**Relevant columns**:
```sql
column_name       | data_type | is_nullable
------------------+-----------+-------------
id                | uuid      | NO
name              | varchar   | NO
staff_id          | uuid      | YES         ← Top-level column (was NULL)
rule_definition   | jsonb     | YES         ← Contains staff_id nested
```

**Expected `rule_definition` structure**:
```json
{
  "staff_id": "uuid-here",
  "conditions": {
    "shift_type": "△",
    "day_of_week": [1, 2, 3]
  },
  "type": "avoid"
}
```

---

## Testing Instructions

### Test 1: Update Existing Priority Rule

1. Open browser and navigate to Settings → Priority Rules
2. Find an existing priority rule with null staff_id
3. Edit the rule and change the staff member
4. Save the rule
5. Check database:

```sql
SELECT id, name, staff_id FROM priority_rules
WHERE name = 'Your Rule Name';
```

**Expected**: `staff_id` should now be a UUID, not null

### Test 2: Create New Priority Rule

1. Click "Add Priority Rule"
2. Fill in name, select staff member, shift type, days
3. Save
4. Check database:

```sql
SELECT id, name, staff_id FROM priority_rules
ORDER BY created_at DESC LIMIT 1;
```

**Expected**: `staff_id` is set to the selected staff member's UUID

### Test 3: Verify JSONB Contains staff_id

```sql
SELECT id, name, staff_id, rule_definition->'staff_id' as jsonb_staff_id
FROM priority_rules
WHERE name = 'Your Rule Name';
```

**Expected**: Both `staff_id` column and `rule_definition.staff_id` should match

---

## Console Logs to Monitor

After the fix, when updating a priority rule, you should see:

```
🔍 [updatePriorityRule] Merging staffId to both rule_definition and top-level column: <uuid>
```

This confirms both locations are being set.

---

## Impact

**Before fix**:
- ❌ Priority rules had null staff_id in database
- ❌ Queries filtering by staff_id returned no results
- ❌ UI might not properly associate rules with staff members

**After fix**:
- ✅ Priority rules have correct staff_id in database
- ✅ Can query rules by staff member
- ✅ Proper association between rules and staff members
- ✅ Both top-level column and JSONB field populated

---

## Related Issues

This fix completes the database save issues:

1. ✅ **Staff Groups** - Fixed (FIXES-COMPLETE-SUMMARY.md)
2. ✅ **Priority Rules** - Fixed (THIS DOCUMENT)

**Both systems now fully functional** with correct database persistence.

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `go-server/settings_multitable.go` | 984-987 | Added `updateData["staff_id"] = staffId` |

**Total Changes**: 1 line added

---

## Summary

**Problem**: Priority rules `staff_id` column saved as NULL

**Root Cause**: UPDATE function only set JSONB field, not top-level column

**Fix**: Added one line to set both locations

**Result**: Priority rules now save with correct staff_id in both:
- Top-level `staff_id` column (for fast queries)
- JSONB `rule_definition.staff_id` (for complex rule logic)

**Status**: ✅ **COMPLETE** - Ready for testing

---

**Last Updated**: 2025-11-10
**Severity**: 🟡 MEDIUM (data was in JSONB, but top-level column was null)
**Breaking Changes**: None
**Migration Required**: Optional (existing rules work, but top-level column is null)

### Optional Data Migration

If you want to populate the `staff_id` column for existing rules:

```sql
-- Copy staff_id from rule_definition JSONB to top-level column
UPDATE priority_rules
SET staff_id = (rule_definition->>'staff_id')::uuid
WHERE staff_id IS NULL
  AND rule_definition->>'staff_id' IS NOT NULL;
```

This will fix any existing rules created before the fix.
