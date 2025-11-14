# Priority Rules - Complete Test Plan

## Quick Test (5 minutes)

This test verifies all fixes are working together:

### Setup
1. Make sure Go server is running:
   ```bash
   cd go-server
   ./shift-schedule-go-server
   ```

2. Start React app:
   ```bash
   npm start
   ```

3. Open browser console (F12 or Cmd+Opt+I)

### Test Steps

#### Step 1: Create New Rule with Multiple Staff ✅
1. Go to Settings → Priority Rules
2. Click "Add Rule"
3. Fill in:
   - Name: "Test Multiple Staff"
   - Rule Type: "Preferred Shift"
   - Shift Type: "Early"
   - Days: Select Monday, Tuesday, Wednesday
   - **Staff: Add 3 different staff members**
4. Click Save (checkmark icon)

**Expected**:
- ✅ Rule card shows "3 staff members"
- ✅ Console shows: `✅ Created priority rule "Test Multiple Staff" with 3 staff member(s)`
- ✅ No console errors

#### Step 2: Verify Database Save ✅
Run this query in Supabase SQL Editor:

```sql
SELECT
  name,
  rule_definition->'staff_ids' as staff_ids,
  rule_definition->'shift_type' as shift_type,
  rule_definition->'days_of_week' as days_of_week
FROM priority_rules
WHERE name = 'Test Multiple Staff';
```

**Expected**:
- ✅ `staff_ids`: Array with 3 UUIDs `["uuid-1", "uuid-2", "uuid-3"]`
- ✅ `shift_type`: `"early"`
- ✅ `days_of_week`: `[0, 1, 2]` (Monday, Tuesday, Wednesday)

#### Step 3: Edit Rule - Add More Staff ✅
1. Click edit (pencil icon) on the rule
2. Add 2 more staff members (total 5)
3. Click Save

**Expected**:
- ✅ Rule card updates to "5 staff members"
- ✅ Console shows: `1 rule(s) updated` (NOT "0 updated")
- ✅ Database shows 5 UUIDs in staff_ids array

#### Step 4: Critical Test - Restart npm ✅
1. Stop React app (Ctrl+C in terminal)
2. Restart: `npm start`
3. Wait for app to fully load
4. Go to Settings → Priority Rules

**Expected**:
- ✅ Rule still shows "5 staff members" (NOT "No staff assigned")
- ✅ Click edit - all 5 staff members still selected
- ✅ Database still has 5 UUIDs in staff_ids

**If this fails**: Go server fix didn't work - check Go server logs

#### Step 5: Edit Rule - Remove Staff ✅
1. Click edit on the rule
2. Remove 2 staff members (leave 3)
3. Click Save

**Expected**:
- ✅ Rule card updates to "3 staff members"
- ✅ Console shows: `1 rule(s) updated`
- ✅ Database shows 3 UUIDs (removed ones are gone)

## Console Log Verification

During testing, watch for these log patterns:

### ✅ Good Logs (Success)
```
✅ Added staff member to rule "Test": uuid-xxx
🔍 [addStaffMember] Updated staffIds: ["uuid-1", "uuid-2", "uuid-3"]
🔄 [DEBOUNCE] Syncing buffered updates for rule...
🔍 [syncRuleToServer] staffIds in merged: ["uuid-1", "uuid-2", "uuid-3"]
🔍 [updatePriorityRule] Setting staff_ids in JSONB: ["uuid-1", "uuid-2", "uuid-3"]
✅ Created priority rule "Test" with 3 staff member(s)
```

### ❌ Bad Logs (Problems)
```
⚠️ [syncRuleToServer] No buffered updates for rule xxx
  ← Buffer not present at save time (timing issue)

Summary: 0 created, 0 updated, 0 deleted
  ← Update detection not working (normalizeRule issue)

❌ Cannot create priority rule without staff members
  ← Validation blocking save (check if staffIds is empty)
```

## Go Server Log Verification

When app starts, check Go server console for:

### ✅ Good Go Server Logs
```
✅ [ToReactFormat] Extracted staffIds array from JSONB staff_ids: [uuid-1 uuid-2 uuid-3]
```

### ❌ Bad Go Server Logs
```
⚠️ [ToReactFormat] staffIds array NOT FOUND in RuleDefinition
  ← Go server not extracting staffIds (check if fix applied)

✅ [ToReactFormat] Extracted staffId from JSONB staffId: uuid-1
  ← Only single staffId extracted, missing array (old bug)
```

## Database Verification Queries

### Check All Priority Rules with Staff
```sql
SELECT
  id,
  name,
  rule_definition->'staff_ids' as staff_ids,
  jsonb_array_length(rule_definition->'staff_ids') as staff_count,
  is_active
FROM priority_rules
ORDER BY created_at DESC;
```

### Find Rules with Empty Staff IDs
```sql
SELECT
  id,
  name,
  rule_definition->'staff_ids' as staff_ids
FROM priority_rules
WHERE
  rule_definition->'staff_ids' IS NULL
  OR jsonb_array_length(rule_definition->'staff_ids') = 0;
```

**Expected**: No results (all rules should have staff members)

### Check Legacy Format Rules
```sql
SELECT
  id,
  name,
  rule_definition->'staff_id' as legacy_staff_id,
  rule_definition->'staff_ids' as new_staff_ids,
  rule_definition->'conditions'->'staff_id' as old_conditions_staff_id
FROM priority_rules;
```

**Expected**: Most rules should have `new_staff_ids` populated

## All Fixes Checklist

Verify each fix is working:

- [ ] **Fix 1**: Staff IDs load from database (PRIORITY-RULES-TWO-ISSUES-FIX.md)
  - Test: Create rule with old format data - should load correctly

- [ ] **Fix 2**: UI displays all staff members (PRIORITY-RULES-UI-DISPLAY-FIX.md)
  - Test: Rule card shows "X staff members" not just first name

- [ ] **Fix 3**: Edit buffer captures staff changes (PRIORITY-RULES-STAFF-UPDATE-FIX.md)
  - Test: Add staff in edit mode, click save - should persist immediately

- [ ] **Fix 4**: Update detection sees staffIds changes (PRIORITY-RULES-STAFFIDS-UPDATE-DETECTION-FIX.md)
  - Test: Console shows "1 rule(s) updated" when adding/removing staff

- [ ] **Fix 5**: Go server extracts staffIds array (GO-SERVER-STAFFIDS-EXTRACTION-FIX.md)
  - Test: Restart npm - staff IDs should NOT disappear

## Success Criteria

All tests pass if:

1. ✅ Can create rules with multiple staff members
2. ✅ Staff members display in UI correctly
3. ✅ Editing staff members saves to database
4. ✅ Changes detected and synced immediately
5. ✅ **Data persists after npm restart** ← CRITICAL TEST
6. ✅ No console errors during any operation
7. ✅ Database queries show complete staff_ids arrays
8. ✅ Go server logs show staffIds extraction

## Failure Scenarios

### Scenario 1: Staff IDs disappear after restart
**Symptom**: Rule shows "No staff assigned" after npm restart
**Cause**: Go server not extracting staffIds array
**Fix**: Check GO-SERVER-STAFFIDS-EXTRACTION-FIX.md
**Verify**: Go server logs should show staffIds extraction

### Scenario 2: Console shows "0 updated" when adding staff
**Symptom**: Staff added in UI but not saved to database
**Cause**: Update detection not seeing staffIds changes
**Fix**: Check PRIORITY-RULES-STAFFIDS-UPDATE-DETECTION-FIX.md (line 638 in useSettingsData.js)
**Verify**: normalizeRule should include staffIds field

### Scenario 3: Buffer not present at save time
**Symptom**: Console shows "No buffered updates for rule"
**Cause**: Edit buffer not being updated when staff added
**Fix**: Check PRIORITY-RULES-STAFF-UPDATE-FIX.md (lines 511-514 in PriorityRulesTab.jsx)
**Verify**: addStaffMember/removeStaffMember should call setEditBuffer

### Scenario 4: UI shows only first staff member
**Symptom**: Rule card shows single name instead of "X staff members"
**Cause**: UI rendering using single staffId instead of staffIds array
**Fix**: Check PRIORITY-RULES-UI-DISPLAY-FIX.md (lines 595-658 in PriorityRulesTab.jsx)
**Verify**: renderRuleCard should map over staffIds array

## Quick Recovery

If tests fail, check in this order:

1. **Check browser console** for errors (red messages)
2. **Check Go server console** for extraction logs
3. **Query database** to see actual data format
4. **Check localStorage**: `JSON.parse(localStorage.getItem('settings')).priorityRules`
5. **Review fix documentation** for the failing scenario

## Support Commands

```bash
# Restart Go server
cd go-server && ./shift-schedule-go-server

# Restart React app
npm start

# Rebuild Go server (if needed)
cd go-server && go build -o shift-schedule-go-server *.go

# Clear localStorage (nuclear option)
# Run in browser console:
localStorage.removeItem('settings')
location.reload()
```

---

**Test Duration**: 5 minutes for quick test, 15 minutes for comprehensive test
**Critical Path**: Create → Save → Restart → Verify persistence
**Success Indicator**: Staff IDs persist after npm restart
