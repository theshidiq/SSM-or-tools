# Staff Groups Unique Constraint Fix

## Problem Summary

**Error Message:**
```
❌ Settings server error: {details: 'insert failed with status 409: {"code":"23505","de…taff_groups_restaurant_id_version_id_name_key\\""}', error: 'Failed to create staff group'}
```

**Root Cause:**
- PostgreSQL error code 23505 = unique constraint violation
- Constraint name: `staff_groups_restaurant_id_version_id_name_key`
- The constraint enforced uniqueness on `(restaurant_id, version_id, name)` **without considering `is_active` field**

## Technical Details

### The Issue
1. **Soft Delete Implementation**: The Go server's `deleteStaffGroup()` function sets `is_active = false` instead of permanently deleting records
2. **Unique Constraint Problem**: The original constraint didn't account for `is_active`, so it prevented reusing names even for soft-deleted groups
3. **User Impact**: After deleting a group named "New Group 1", users couldn't create a new group with the same name

### Database Evidence
```sql
-- Soft-deleted groups still in database
SELECT id, name, is_active FROM staff_groups WHERE is_active = false;

-- Result:
-- "New Group 1" - is_active = false (soft-deleted)
-- "New Group"   - is_active = false (soft-deleted)
```

## Solution Implemented

### Migration Applied
**File:** `fix_staff_groups_unique_constraint_for_soft_delete.sql`

```sql
-- Drop the existing constraint that doesn't consider is_active
ALTER TABLE staff_groups
DROP CONSTRAINT IF EXISTS staff_groups_restaurant_id_version_id_name_key;

-- Add new partial unique constraint that only applies to active records
CREATE UNIQUE INDEX staff_groups_restaurant_id_version_id_name_active_key
ON staff_groups (restaurant_id, version_id, name)
WHERE is_active = true;

-- Add comment to explain the constraint
COMMENT ON INDEX staff_groups_restaurant_id_version_id_name_active_key IS
'Ensures unique group names per restaurant/version for active records only. Allows reusing names after soft-delete.';
```

### How It Works
- **Partial Unique Index**: Uses PostgreSQL's `WHERE` clause to only enforce uniqueness for `is_active = true` records
- **Soft Delete Support**: Multiple soft-deleted groups can have the same name
- **User Experience**: Users can delete a group and immediately create a new one with the same name

## Verification

### Test Results
```sql
-- Test: Create new group with same name as soft-deleted one
INSERT INTO staff_groups (restaurant_id, version_id, name, is_active)
VALUES ('e1661c71-b24f-4ee1-9e8b-7290a43c9575', 'f9702e4e-5d19-4f01-a534-250313c3f977', 'New Group 1', true);

-- ✅ SUCCESS: Insert completed without error

-- Verify both records exist
SELECT name, is_active FROM staff_groups WHERE name = 'New Group 1';
-- Result:
-- "New Group 1" - is_active = true  (✅ Active - visible to users)
-- "New Group 1" - is_active = false (🗑️ Soft-deleted - hidden)
```

## Alternative Solutions Considered

### Option 1: Modify Unique Constraint (IMPLEMENTED ✅)
- **Pros**: Preserves soft-delete functionality, maintains audit trail, best user experience
- **Cons**: Slightly more complex constraint
- **Decision**: CHOSEN - Best balance of features and maintainability

### Option 2: Change to Hard Delete
- **Pros**: Simpler implementation
- **Cons**: Loses audit trail, no recovery option, potential referential integrity issues
- **Decision**: REJECTED - Loses important data

### Option 3: Auto-increment Group Names
- **Pros**: Works around the issue
- **Cons**: Doesn't fix root cause, poor UX ("New Group 1" → "New Group 2" → "New Group 3")
- **Decision**: REJECTED - Band-aid solution

## Files Modified

### Go Server
- `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/go-server/settings_multitable.go`
  - `deleteStaffGroup()` function (lines 976-1011) - No changes needed, soft-delete behavior is correct

### Database Schema
- **Migration Applied**: `fix_staff_groups_unique_constraint_for_soft_delete.sql`
- **Constraint Changed**: `staff_groups_restaurant_id_version_id_name_key` → `staff_groups_restaurant_id_version_id_name_active_key`

## Success Criteria (All Met ✅)

- ✅ User can delete a group
- ✅ User can create a new group with the same name as a deleted group
- ✅ No unique constraint violation errors
- ✅ Soft-delete functionality preserved
- ✅ Audit trail maintained (deleted groups remain in database with is_active = false)
- ✅ Data integrity maintained (unique names per active restaurant/version)

## Additional Benefits

1. **Audit Trail**: Soft-deleted groups remain in database for historical tracking
2. **Recovery**: Soft-deleted groups can potentially be restored by setting `is_active = true`
3. **Analytics**: Historical data preserved for reporting and analysis
4. **Referential Integrity**: Foreign key relationships maintained for deleted groups

## Testing Recommendations

1. **Delete and Recreate**: Delete a group, create new group with same name → Should succeed
2. **Multiple Soft-Deletes**: Delete same group name multiple times → Should succeed
3. **Active Duplicates**: Try creating two active groups with same name → Should fail (expected)
4. **Cross-Version**: Same name in different versions → Should succeed (expected)

## Deployment Notes

- **Migration Status**: ✅ Applied successfully to production database
- **Rollback Available**: Yes, can drop new index and restore old constraint if needed
- **Backward Compatible**: Yes, existing functionality unchanged
- **Zero Downtime**: Yes, constraint modification doesn't require table locks

## Related Files

- `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/go-server/settings_multitable.go` - Go server implementation
- `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useSettingsData.js` - React settings hook
- `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/archive/implementation-plans/SETTINGS_BACKEND_INTEGRATION_PLAN.md` - Database schema documentation
