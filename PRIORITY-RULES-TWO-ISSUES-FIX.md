# Priority Rules - Two Critical Fixes

## Issue 1: Staff IDs Not Loading ❌

### Problem
```javascript
staffId: undefined  // Staff IDs not appearing from database
```

### Root Cause
Database has **two different formats** for storing staff IDs:

**Old Format** (from previous schema):
```json
{
  "conditions": {
    "staff_id": "uuid-here",  // Singular, inside conditions
    "shift_type": "early"
  }
}
```

**New Format** (current code expects):
```json
{
  "staff_ids": ["uuid-1", "uuid-2"],  // Array, at root level
  "shift_type": "early"
}
```

Our code only checked the new format, so old rules showed `staffId: undefined`.

### Solution
Made the loading code **backward compatible**:

```javascript
// ✅ BACKWARD COMPATIBLE: Support both old and new formats
staffIds: rule.rule_definition?.staff_ids ||  // New format
         (rule.rule_definition?.conditions?.staff_id ?
           [rule.rule_definition.conditions.staff_id] : []) ||  // Old format
         [],

staffId: (rule.rule_definition?.staff_ids?.[0]) ||  // New format
        (rule.rule_definition?.conditions?.staff_id) ||  // Old format
        undefined,
```

Now loads staff IDs from **both** old and new database formats!

---

## Issue 2: Row Level Security Blocking Inserts ❌

### Problem
```
❌ Settings server error:
{
  error: "Failed to create priority rule",
  details: "new row violates row-level security policy for table \"priority_rules\""
}
```

### Root Cause
The database has **Row Level Security (RLS)** enabled on `priority_rules` table with this policy:

```sql
CREATE POLICY priority_rules_access ON priority_rules
FOR ALL USING (
    restaurant_id IN (
        SELECT restaurant_id
        FROM user_profiles
        WHERE user_id = auth.uid()
    )
);
```

This requires:
1. User to be authenticated
2. User to exist in `user_profiles` table
3. User to have a `restaurant_id`

In development, you probably don't have authentication set up, so **all inserts fail**.

### Solution Options

#### Option 1: Disable RLS for Development (Recommended)
Run this SQL in Supabase SQL Editor:

```sql
-- Disable RLS on priority_rules for development
ALTER TABLE priority_rules DISABLE ROW LEVEL SECURITY;
```

Or use the provided script:
```bash
# In Supabase dashboard: SQL Editor → New Query → Paste from file
cat disable-rls-for-dev.sql
```

#### Option 2: Add Your User to user_profiles
```sql
-- Create user_profiles entry (if table exists)
INSERT INTO user_profiles (user_id, restaurant_id)
VALUES (
    auth.uid(),  -- Your current user ID
    'e1661c71-b24f-4ee1-9e8b-7290a43c9575'  -- Your restaurant ID
);
```

#### Option 3: Modify RLS Policy to Allow Inserts
```sql
-- Allow inserts without checking user_profiles
DROP POLICY IF EXISTS priority_rules_access ON priority_rules;

CREATE POLICY priority_rules_dev_access ON priority_rules
FOR ALL
USING (true)  -- Allow all reads
WITH CHECK (true);  -- Allow all writes
```

---

## Quick Fix Guide

### Step 1: Fix Staff ID Loading (Already Done ✅)
The code has been updated to support both formats. Just refresh your app.

### Step 2: Fix RLS Block (Choose One)

**For Development (Easiest):**
1. Go to Supabase Dashboard
2. Click SQL Editor
3. Paste and run:
   ```sql
   ALTER TABLE priority_rules DISABLE ROW LEVEL SECURITY;
   ```

**For Production (Proper):**
1. Set up authentication properly
2. Create `user_profiles` table if missing
3. Link users to restaurants
4. Keep RLS enabled for security

---

## Testing After Fixes

### Test 1: Load Old Rules
```javascript
// Should now show staffId from old rules
console.log('Old rule staffId:', rule.staffId);  // Should NOT be undefined
```

### Test 2: Create New Rule
```javascript
// Should NOT get RLS error
createPriorityRule({
  name: "Test Rule",
  staffIds: ["uuid-123"],
  daysOfWeek: [0, 1, 2]
});
// ✅ Should succeed
```

### Test 3: Browser Console
```javascript
// Check priority rules in console
JSON.parse(localStorage.getItem('settings')).priorityRules.forEach(rule => {
  console.log(rule.name, '→ staffIds:', rule.staffIds, 'staffId:', rule.staffId);
});
```

---

## Files Modified

1. **`src/hooks/usePriorityRulesData.js`** (Lines 44-53)
   - Added backward compatibility for old format
   - Checks both `staff_ids` and `conditions.staff_id`

2. **`disable-rls-for-dev.sql`** (New File)
   - SQL script to disable RLS for development

---

## Summary

### ✅ Staff ID Loading - FIXED
- **Old format**: `conditions.staff_id` (singular)
- **New format**: `staff_ids` (array)
- **Solution**: Check both formats during load

### ⏳ RLS Blocking - NEEDS YOUR ACTION
- **Problem**: Authentication policy blocking inserts
- **Solution**: Disable RLS for dev OR set up proper auth
- **Script**: Use `disable-rls-for-dev.sql`

---

**Date**: 2025-11-13
**Status**:
- ✅ Staff ID loading fixed in code
- ⏳ RLS needs database action by user
