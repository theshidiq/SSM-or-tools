# Settings Data Fix - Complete Solution

## Problems Identified

### 1. Staff Groups Not Showing
- **Symptom**: Staff group ID `4a881f59-5076-430d-8d1e-152ff3c3eb1e` exists in database but doesn't appear in UI
- **Root Cause**:
  - Groups created with `is_active = false` or `NULL`
  - Transform in `useStaffGroupsData.js` wasn't mapping `is_active` field
  - UI filtering removes groups where `isActive === false`

### 2. Priority Rules Not Showing
- **Symptom**: Priority rule ID `8d927439-3411-4283-832a-b8a406e73113` has `is_active = true` but doesn't appear in UI
- **Root Cause**:
  - Foreign key `priority_rules.staff_id` points to WRONG table (`staff_members` which is EMPTY)
  - Should point to `staff` table (which has 18 active staff members)
  - Query can't find matching staff, so rules don't display

## Code Fixes Applied

### File: `src/hooks/useStaffGroupsData.js`

#### Fix 1: Map `is_active` in transform (line 40)
```javascript
isActive: group.is_active ?? true, // Default to true if not set
```

#### Fix 2: Set `is_active` when creating groups (line 83)
```javascript
is_active: true, // ✅ FIX: Explicitly set is_active to prevent soft-delete
```

**Why**: Prevents future groups from being accidentally soft-deleted on creation

### File: `src/hooks/usePriorityRulesData.js`

Already correctly:
- Maps `isActive` field in transform (line 49)
- Filters to only load active rules (line 27)

**Issue**: Foreign key constraint prevents valid staff_id from matching

## Database Fixes Required

Run this SQL script in Supabase SQL Editor: `fix-settings-data.sql`

The script will:

1. **Check Current State**
   - View all staff_groups and their `is_active` status
   - View all priority_rules and check if `staff_id` references exist

2. **Fix Staff Groups**
   - Set `is_active = true` for all groups
   - Verify the update

3. **Fix Priority Rules Foreign Key**
   - Drop incorrect FK constraint pointing to `staff_members`
   - Add correct FK constraint pointing to `staff` table
   - Create performance index

4. **Verification**
   - Count active vs inactive entities
   - Verify staff_id references are valid
   - Show final summary

## Steps to Apply Fix

### 1. Run Database Migration
```bash
# Open Supabase SQL Editor
# Paste and run the contents of: fix-settings-data.sql
```

### 2. Clear Browser Cache
Run in browser console:
```javascript
localStorage.removeItem('shift-schedule-settings');
location.reload();
```

### 3. Verify Fix
Check browser console logs:
```
✅ Loaded 1 staff groups from database and synced to settings
✅ Loaded X priority rules from database and synced to settings
🔍 [staffGroups useMemo] Group 0: {id: '...', name: 'chef', isActive: true, willBeFiltered: false}
```

The groups and rules should now appear in the Settings UI!

## Prevention - Future Groups/Rules

### Staff Groups
✅ Now when creating new groups:
- `is_active: true` is explicitly set in database
- Transform maps `is_active` → `isActive`
- Groups appear in UI by default

### Priority Rules
✅ After fixing foreign key:
- Rules can reference staff from `staff` table
- Foreign key ensures referential integrity
- Invalid `staff_id` values are prevented

## Related Issues Fixed

This fix also addresses:
- AI validation not seeing priority rules (PRIORITY-RULES-FIX.md)
- Staff groups being filtered out in AI configuration
- Soft-delete behavior happening unintentionally

## Testing Checklist

After applying fixes:

- [ ] Staff groups tab shows existing groups
- [ ] Can create new staff groups (appear immediately)
- [ ] Priority rules tab shows existing rules
- [ ] Can create new priority rules for valid staff
- [ ] AI respects priority rules during schedule generation
- [ ] Staff groups appear in AI settings/configuration

## Technical Details

### Database Schema

**staff_groups table**:
```sql
- id (UUID)
- name (VARCHAR)
- description (TEXT)
- group_config (JSONB) - contains {color, members[]}
- is_active (BOOLEAN) - DEFAULT true
- created_at, updated_at (TIMESTAMP)
```

**priority_rules table**:
```sql
- id (UUID)
- name (VARCHAR)
- description (TEXT)
- staff_id (UUID) - FK to staff(id) ✅ FIXED
- rule_definition (JSONB)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

### Data Flow

1. **Database** → Supabase tables with `is_active` column
2. **Hook** → `useStaffGroupsData`/`usePriorityRulesData` load and transform
3. **Transform** → Maps database format to localStorage format (includes `isActive`)
4. **Settings** → Synced to `SettingsContext` and localStorage
5. **UI** → Filters out items where `isActive === false`
6. **AI** → Uses settings from localStorage for validation

## Files Modified

1. `src/hooks/useStaffGroupsData.js` - Added isActive mapping and creation fix
2. `fix-settings-data.sql` - Database migration script (NEW)
3. `SETTINGS-DATA-FIX-COMPLETE.md` - This documentation (NEW)
