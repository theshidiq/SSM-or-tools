# Priority Rules Schema Cleanup - COMPLETE

## Problem
User reported confusion: "if u using jsonb to sent to rule definition, why it the staff id coulumn exist then? it make me conufse. u have to choose one."

The code had references to a `staff_id` column that **doesn't actually exist** in the database, causing confusion and potentially attempting to write to non-existent columns.

## Root Cause
- **Outdated code** tried to write to `staff_id` column (doesn't exist)
- **Outdated comments** mentioned `staff_id` in JSONB examples
- **Complex fallback logic** checked multiple places for staff IDs
- This created confusion about the **single source of truth**

## Database Schema Reality

### ✅ Actual Schema (Correct)
```sql
CREATE TABLE priority_rules (
    id UUID PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id),
    version_id UUID REFERENCES config_versions(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority_level INTEGER DEFAULT 1,

    -- ✅ SINGLE SOURCE: All rule data in JSONB
    rule_definition JSONB NOT NULL,

    penalty_weight DECIMAL(5,2) DEFAULT 1.0,
    is_hard_constraint BOOLEAN DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### ❌ What Does NOT Exist
- NO `staff_id` column
- NO top-level staff reference
- Staff IDs are **ONLY** in `rule_definition.staff_ids` JSONB array

## Changes Made

### 1. React Hook Cleanup (`usePriorityRulesData.js`)

#### Loading/Reading (Lines 44-48)
**Before (Confusing):**
```javascript
staffIds: rule.rule_definition?.staff_ids ||
  (rule.staff_id ? [rule.staff_id] : []) ||
  (rule.rule_definition?.staff_id ? [rule.rule_definition.staff_id] : []),
staffId: rule.rule_definition?.staff_ids ? undefined : (rule.rule_definition?.staff_id || rule.staff_id),
```

**After (Clean):**
```javascript
// ✅ SINGLE SOURCE: Staff IDs ONLY from rule_definition.staff_ids JSONB
staffIds: rule.rule_definition?.staff_ids || [],
// Legacy staffId for UI compatibility (first item from array)
staffId: rule.rule_definition?.staff_ids?.[0] || undefined,
```

#### Creating Rules (Lines 108-109)
**Before (Wrong):**
```javascript
staff_id: ruleData.staffId || (ruleData.staffIds?.length === 1 ? ruleData.staffIds[0] : null),
rule_definition: {
  staff_ids: staffIds,
}
```

**After (Correct):**
```javascript
// ✅ CLEANUP: Removed staff_id - column doesn't exist
// Staff IDs are ONLY stored in rule_definition.staff_ids JSONB array
rule_definition: {
  staff_ids: staffIds, // SINGLE SOURCE OF TRUTH
}
```

#### Updating Rules (Lines 172-173)
**Before (Wrong):**
```javascript
// Update top-level staff_id for backward compatibility
if (updates.staffId !== undefined) {
  updateData.staff_id = updates.staffId;
} else if (updates.staffIds !== undefined) {
  updateData.staff_id = updates.staffIds.length === 1 ? updates.staffIds[0] : null;
}
```

**After (Correct):**
```javascript
// ✅ CLEANUP: Removed staff_id column updates - column doesn't exist
// Staff IDs are ONLY stored in rule_definition.staff_ids JSONB array
```

### 2. Database Schema Documentation (`database_schema.sql`)

**Before (Outdated Example):**
```sql
/* Example structures: {
    "type": "preferred_shift",
    "staff_id": "staff_uuid",  ❌ Wrong: singular
    "conditions": {
        "day_of_week": [0],
        "shift_type": "early"
    }
} */
```

**After (Correct Example):**
```sql
/* Example structure: {
    "rule_type": "preferred_shift",
    "shift_type": "early",
    "days_of_week": [0, 1, 2],
    "staff_ids": ["uuid-1", "uuid-2"],  ✅ Correct: array
    "preference_strength": 1.0,
    "effective_from": "2025-01-01",
    "effective_until": "2025-12-31"
} */
```

## Benefits of Cleanup

### 1. **Clear Single Source of Truth**
- ✅ Staff IDs **ONLY** in `rule_definition.staff_ids`
- ✅ No confusion about which field to check
- ✅ No redundant storage attempts

### 2. **Simpler Code**
- ✅ Removed 10+ lines of fallback logic
- ✅ One place to read: `rule_definition.staff_ids`
- ✅ One place to write: `rule_definition.staff_ids`

### 3. **Correct Documentation**
- ✅ Example shows array format: `staff_ids: ["uuid1", "uuid2"]`
- ✅ Matches actual implementation
- ✅ No misleading references to non-existent columns

### 4. **No Database Errors**
- ✅ Won't try to write to `staff_id` column (doesn't exist)
- ✅ Won't silently fail on INSERT/UPDATE
- ✅ Clean SQL operations

## Data Structure

### Priority Rule in Database
```json
{
  "id": "rule-uuid",
  "name": "Weekend Early Shifts",
  "description": "Chef team prefers early shifts on weekends",
  "priority_level": 4,
  "penalty_weight": 100.0,
  "is_hard_constraint": true,
  "rule_definition": {
    "rule_type": "preferred_shift",
    "shift_type": "early",
    "days_of_week": [0, 6],
    "staff_ids": [
      "chef-uuid-1",
      "chef-uuid-2",
      "chef-uuid-3"
    ],
    "preference_strength": 1.0,
    "effective_from": null,
    "effective_until": null
  },
  "is_active": true,
  "created_at": "2025-11-12T10:00:00Z",
  "updated_at": "2025-11-12T10:00:00Z"
}
```

### Key Points
- ✅ `staff_ids` is an **array** (supports multiple staff)
- ✅ Stored in **JSONB** `rule_definition`
- ✅ **No top-level** `staff_id` column
- ✅ All rule configuration in **single JSONB object**

## Files Modified

1. **`src/hooks/usePriorityRulesData.js`**
   - Removed `staff_id` column writes
   - Simplified `staffIds` reading logic
   - Clear comments about single source of truth

2. **`database_schema.sql`**
   - Updated JSONB example to show `staff_ids` array
   - Removed outdated `staff_id` reference
   - Added more complete example structure

## Testing

Run this to verify no code tries to access non-existent column:

```bash
# Search for any remaining staff_id column references
grep -r "staff_id.*:" src/hooks/usePriorityRulesData.js
# Should only show comments, not actual code
```

## Before vs After

### Before (Confusing)
```
Database: rule_definition.staff_ids ✅ EXISTS
Code reads: rule.staff_id || rule.rule_definition.staff_id || rule.rule_definition.staff_ids
Code writes: staff_id column ❌ DOESN'T EXIST
Result: Confusion about source of truth, potential silent failures
```

### After (Clear)
```
Database: rule_definition.staff_ids ✅ EXISTS
Code reads: rule.rule_definition.staff_ids
Code writes: rule_definition.staff_ids
Result: Single source of truth, no confusion
```

## Summary

✅ **Eliminated confusion** about staff ID storage location
✅ **Single source of truth**: `rule_definition.staff_ids` JSONB array
✅ **Cleaner code** with simplified read/write logic
✅ **Correct documentation** matching actual schema
✅ **No attempts** to write to non-existent columns

The code now accurately reflects the database schema reality! 🎉

---

**Date**: 2025-11-12
**Status**: ✅ COMPLETE
**Impact**: Code cleanup - No functional changes, just removing confusion
**User Feedback**: "oke it working now, but... u have to choose one"
**Resolution**: Chose JSONB as single source, removed all top-level column references
