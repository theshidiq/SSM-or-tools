# Database Constraint Fix - Staff Groups Name Reuse

## Problem
Cannot create a new staff group with the same name as a previously deleted (soft-deleted) group.

### Error Message
```
duplicate key value violates unique constraint "staff_groups_restaurant_id_version_id_name_active_key"
```

## Root Cause
The database unique constraint was incorrectly enforcing uniqueness on **ALL groups** (both active and inactive), preventing name reuse after soft-deletion.

**Old Constraint**: `UNIQUE (restaurant_id, version_id, name, is_active)`
- This makes BOTH active AND inactive groups enforce uniqueness
- Result: Can't reuse names of deleted groups ❌

## Solution
Change to a **partial unique index** that only enforces uniqueness for **active groups**.

**New Constraint**: `UNIQUE (restaurant_id, version_id, name) WHERE is_active = true`
- Only active groups enforce uniqueness
- Soft-deleted groups (is_active = false) don't participate in constraint
- Result: Can reuse names of deleted groups ✅

## How to Apply Migration

### Option 1: Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and paste the migration SQL**
   - Open: `supabase/migrations/20251010_fix_staff_groups_unique_constraint.sql`
   - Copy the entire contents
   - Paste into SQL Editor

4. **Run the migration**
   - Click "Run" button (or press Cmd+Enter / Ctrl+Enter)
   - Wait for success message ✅

5. **Verify the fix**
   - Try creating a new group with the same name as a deleted group
   - It should now work without errors!

### Option 2: Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Navigate to project root
cd /Users/kamalashidiq/Documents/Apps/shift-schedule-manager

# Apply migration
supabase db push

# Or apply specific migration
supabase migration up
```

## Testing

After applying the migration:

1. **Test Case 1: Reuse deleted group name** ✅
   - Create group "Test Group"
   - Delete "Test Group" (soft-delete with is_active=false)
   - Create new group "Test Group" again
   - **Expected**: Should succeed without errors

2. **Test Case 2: Duplicate active names** ❌
   - Create group "Active Group"
   - Try to create another "Active Group" (without deleting first)
   - **Expected**: Should fail with unique constraint error

3. **Test Case 3: Multiple deleted groups with same name** ✅
   - Create "Repeat Name"
   - Delete "Repeat Name"
   - Create "Repeat Name" again
   - Delete "Repeat Name" again
   - Create "Repeat Name" again
   - **Expected**: Should work - multiple soft-deleted versions allowed

## What Changed

### Before Migration
```sql
-- Old constraint (WRONG)
ALTER TABLE staff_groups
ADD CONSTRAINT staff_groups_restaurant_id_version_id_name_active_key
UNIQUE (restaurant_id, version_id, name, is_active);
```

### After Migration
```sql
-- New partial unique index (CORRECT)
CREATE UNIQUE INDEX staff_groups_active_name_unique
ON staff_groups (restaurant_id, version_id, name)
WHERE is_active = true;
```

## Impact
- ✅ Can now reuse names of soft-deleted groups
- ✅ Still prevents duplicate names among active groups
- ✅ Maintains data integrity
- ✅ No breaking changes to existing functionality
- ✅ No data loss

## Rollback (if needed)

If you need to rollback this change:

```sql
-- Remove new index
DROP INDEX IF EXISTS staff_groups_active_name_unique;

-- Restore old constraint (NOT RECOMMENDED - has the bug)
ALTER TABLE staff_groups
ADD CONSTRAINT staff_groups_restaurant_id_version_id_name_active_key
UNIQUE (restaurant_id, version_id, name, is_active);
```

## Related Files
- Migration: `supabase/migrations/20251010_fix_staff_groups_unique_constraint.sql`
- Go Server: `go-server/settings_multitable.go` (deleteStaffGroup function)
- Client: `src/components/settings/tabs/StaffGroupsTab.jsx` (soft-delete UI)

## Status
- [x] Migration file created
- [ ] Migration applied to Supabase
- [ ] Tested in browser
- [ ] Verified fix works
