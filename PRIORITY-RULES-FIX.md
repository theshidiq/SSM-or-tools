# Settings Data Sync Fix (Priority Rules + Staff Groups)

## Problem Summary

The AI was violating priority rules AND staff groups were not showing in the UI because they had NO ACCESS to the data stored in the database.

### Root Cause

1. **Priority Rules Storage**: Priority rules are correctly stored in `priority_rules` table in Supabase
2. **AI Validation Source**: AI validation (`ConstraintEngine.js`) loads rules from `ConfigurationService.getPriorityRules()`
3. **ConfigurationService Source**: ConfigurationService ONLY loads from **localStorage** (`shift-schedule-settings`)
4. **Missing Sync**: There was **NO CODE** that syncs priority rules from Supabase database to localStorage

**Result**: AI validation always used empty or stale priority rules from localStorage, so it never knew about rules and violated them.

## The Fix

### 1. Created `usePriorityRulesData` Hook
**File**: `src/hooks/usePriorityRulesData.js`

This hook:
- ✅ Loads priority rules from `priority_rules` table in Supabase on app mount
- ✅ Transforms database format (`rule_definition` JSONB) to localStorage format
- ✅ Syncs rules to localStorage via `updateSettings()`
- ✅ Provides CRUD operations (create, update, delete) that keep database and localStorage in sync

### 2. Created `useStaffGroupsData` Hook
**File**: `src/hooks/useStaffGroupsData.js`

This hook:
- ✅ Loads staff groups from `staff_groups` table in Supabase on app mount
- ✅ Transforms database format (`group_config` JSONB) to localStorage format
- ✅ Syncs groups to localStorage via `updateSettings()`
- ✅ Provides CRUD operations (create, update, delete) that keep database and localStorage in sync

### 3. Integrated Hooks into App
**File**: `src/App.js` (lines 27, 31)

Added both hooks in `AppContent` component to ensure data is loaded when app starts:
- `usePriorityRulesData()` - loads priority rules
- `useStaffGroupsData()` - loads staff groups

## Database Schema Reference

### Priority Rules Table
```sql
CREATE TABLE priority_rules (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  staff_id UUID NOT NULL,  -- Should FK to staff(id), NOT staff_members(id)
  rule_definition JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Staff Groups Table
```sql
CREATE TABLE staff_groups (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  group_config JSONB NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### group_config JSONB Structure
```json
{
  "color": "#3B82F6",
  "members": ["staff-id-1", "staff-id-2", "staff-id-3"]
}
```

### rule_definition JSONB Structure
```json
{
  "rule_type": "preferred_shift" | "avoid_shift" | "required_off",
  "shift_type": "early" | "late" | "off",
  "days_of_week": [0, 1, 2, 3, 4, 5, 6],
  "priority_level": 1-5,
  "preference_strength": 0.0-1.0,
  "is_hard_constraint": true/false,
  "penalty_weight": 0-100,
  "effective_from": "YYYY-MM-DD" or null,
  "effective_until": "YYYY-MM-DD" or null
}
```

## Testing the Fix

1. **Reload the app** - priority rules will be loaded from database on mount
2. **Check console logs** - should see: `✅ Loaded X priority rules from database and synced to settings`
3. **Check localStorage** - `localStorage.getItem('shift-schedule-settings')` should contain `priorityRules` array
4. **Generate schedule** - AI should now respect priority rules

## Console Debugging Script

Run in browser console to verify rules are loaded:

```javascript
// Check priority rules in localStorage
const settings = JSON.parse(localStorage.getItem('shift-schedule-settings') || '{}');
console.log('Priority rules count:', settings.priorityRules?.length || 0);
console.log('Priority rules:', settings.priorityRules);

// Check specific rule
const ruleId = 'c0413588-8427-407e-b36c-e38eb890b91d';
const rule = settings.priorityRules?.find(r => r.id === ruleId);
console.log('Rule details:', rule);
```

## Related Issues Fixed

This fix also addresses the same root cause for:
- **Staff Groups** - Need similar database sync (already working via SettingsContext)
- **Daily Limits** - Need similar database sync (already working via SettingsContext)
- **Monthly Limits** - Need similar database sync (already working via SettingsContext)

## Next Steps

The user still needs to:
1. ✅ Run `fix-foreign-key-to-staff-table.sql` to fix FK constraint (points to wrong table)
2. ✅ Reload the app to trigger priority rules sync
3. ✅ Test AI schedule generation

## Important Notes

- **Foreign Key Issue**: The `priority_rules.staff_id` still references `staff_members(id)` which is EMPTY. This should be fixed to reference `staff(id)` using the migration script `go-server/fix-foreign-key-to-staff-table.sql`
- **Real-time Sync**: Priority rules are now synced on app mount, but changes in the database won't be reflected until page reload. Consider adding real-time subscriptions if needed.
- **Validation Debug Logs**: ConstraintEngine.js has debug logs enabled. Check console for `🔍 [VALIDATION-DEBUG]` messages to see rule matching process.
