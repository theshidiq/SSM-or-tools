# Debug: Staff IDs Not Saving to Database

## Issue
User reports that when adding staff members in edit mode and clicking save, the staff IDs are not being saved to the database.

## Debugging Logs Added

I've added comprehensive console logging to track the entire flow from UI interaction to database write.

### Log Points

#### 1. When Adding Staff (UI Component)
**File**: `src/components/settings/tabs/PriorityRulesTab.jsx` (Lines 522-524)

```javascript
console.log(`✅ Added staff member to rule "${rule.name}": ${staffId}`);
console.log(`🔍 [addStaffMember] Updated staffIds:`, updatedStaffIds);
console.log(`🔍 [addStaffMember] Edit buffer now:`, { [ruleId]: { staffIds: updatedStaffIds } });
```

**What to check**:
- Is `updatedStaffIds` array populated with UUIDs?
- Is edit buffer being updated correctly?

#### 2. When Syncing to Server (UI Component)
**File**: `src/components/settings/tabs/PriorityRulesTab.jsx` (Lines 238-252)

```javascript
console.log(`⚠️ [syncRuleToServer] No buffered updates for rule ${ruleId}`);
// OR
console.log(`🔄 [DEBOUNCE] Syncing buffered updates for rule ${ruleId}:`, bufferedUpdates);
console.log(`🔍 [syncRuleToServer] Merged rule:`, merged);
console.log(`🔍 [syncRuleToServer] staffIds in merged:`, merged.staffIds);
```

**What to check**:
- Is buffer present when save is clicked?
- Does the merged rule contain staffIds?

#### 3. When Building Database Update (Supabase Hook)
**File**: `src/hooks/usePriorityRulesData.js` (Lines 195-201)

```javascript
console.log(`🔍 [updatePriorityRule] Setting staff_ids in JSONB:`, updates.staffIds);
// OR
console.log(`🔍 [updatePriorityRule] Converting legacy staffId to array:`, [updates.staffId]);
```

**What to check**:
- Are staff IDs being added to rule_definition?

#### 4. Before Database Write (Supabase Hook)
**File**: `src/hooks/usePriorityRulesData.js` (Lines 210-211)

```javascript
console.log(`🔍 [updatePriorityRule] Final updateData being sent to database:`, updateData);
console.log(`🔍 [updatePriorityRule] rule_definition.staff_ids:`, updateData.rule_definition?.staff_ids);
```

**What to check**:
- Does `updateData.rule_definition.staff_ids` contain the correct UUIDs?

## Testing Instructions

### Step 1: Restart Development Server
```bash
npm start
```

### Step 2: Open Browser Console
- Open http://localhost:3001
- Open DevTools (F12 or Cmd+Opt+I)
- Go to Console tab

### Step 3: Reproduce the Issue
1. Click "Add Rule" in Priority Rules
2. Add rule name
3. Select days
4. **Add 2-3 staff members** using the "+ Add Staff" button
5. Click Save (checkmark icon)

### Step 4: Check Console Logs

You should see logs in this order:

```
✅ Added staff member to rule "Test": uuid-1
🔍 [addStaffMember] Updated staffIds: ["uuid-1"]
🔍 [addStaffMember] Edit buffer now: {...}

✅ Added staff member to rule "Test": uuid-2
🔍 [addStaffMember] Updated staffIds: ["uuid-1", "uuid-2"]
🔍 [addStaffMember] Edit buffer now: {...}

🔄 [DEBOUNCE] Syncing buffered updates for rule...: {...}
🔍 [syncRuleToServer] Merged rule: {...}
🔍 [syncRuleToServer] staffIds in merged: ["uuid-1", "uuid-2"]

🔍 [updatePriorityRule] Setting staff_ids in JSONB: ["uuid-1", "uuid-2"]
🔍 [updatePriorityRule] Final updateData being sent to database: {...}
🔍 [updatePriorityRule] rule_definition.staff_ids: ["uuid-1", "uuid-2"]
```

## Possible Issues to Look For

### Issue 1: Edit Buffer Not Updated
**Symptom**: `[addStaffMember]` shows empty array or old array
**Cause**: `setEditBuffer` not working
**Location**: `PriorityRulesTab.jsx` lines 511-514

### Issue 2: Buffer Not Present at Save Time
**Symptom**: `⚠️ [syncRuleToServer] No buffered updates for rule`
**Cause**: Buffer was cleared before save OR save clicked too quickly
**Location**: `PriorityRulesTab.jsx` line 238

### Issue 3: staffIds Not in Updates Object
**Symptom**: `[updatePriorityRule]` logs don't show staff_ids
**Cause**: Merged object doesn't include staffIds from buffer
**Location**: Check sync merge logic line 249

### Issue 4: rule_definition Not Built
**Symptom**: `updateData.rule_definition` is undefined
**Cause**: Condition on line 179-186 not met
**Location**: `usePriorityRulesData.js` lines 179-208

### Issue 5: JSONB Merge Issue
**Symptom**: `updateData.rule_definition` exists but `staff_ids` is missing
**Cause**: Only partial rule_definition being sent, not merging with existing
**Location**: `usePriorityRulesData.js` line 207

## Expected Console Output (Success Case)

```
✅ Added staff member to rule "Weekend Shifts": 550e8400-e29b-41d4-a716-446655440000
🔍 [addStaffMember] Updated staffIds: ["550e8400-e29b-41d4-a716-446655440000"]
🔍 [addStaffMember] Edit buffer now: { ruleId: { staffIds: ["550e8400-..."] } }

✅ Added staff member to rule "Weekend Shifts": 650e8400-e29b-41d4-a716-446655440001
🔍 [addStaffMember] Updated staffIds: ["550e8400-...", "650e8400-..."]
🔍 [addStaffMember] Edit buffer now: { ruleId: { staffIds: ["550e8400-...", "650e8400-..."] } }

🔄 [DEBOUNCE] Syncing buffered updates for rule abc123: { staffIds: ["550e8400-...", "650e8400-..."] }
🔍 [syncRuleToServer] Merged rule: { id: "abc123", name: "Weekend Shifts", staffIds: ["550e8400-...", "650e8400-..."], ... }
🔍 [syncRuleToServer] staffIds in merged: ["550e8400-...", "650e8400-..."]

🔍 [updatePriorityRule] Setting staff_ids in JSONB: ["550e8400-...", "650e8400-..."]
🔍 [updatePriorityRule] Final updateData being sent to database: { rule_definition: { staff_ids: ["550e8400-...", "650e8400-..."], ... } }
🔍 [updatePriorityRule] rule_definition.staff_ids: ["550e8400-...", "650e8400-..."]
```

## What to Report

After testing, please copy the **entire console log** and look for:

1. **Where does the flow break?**
   - Do staff IDs appear in `addStaffMember`? ✅ or ❌
   - Do they appear in `syncRuleToServer`? ✅ or ❌
   - Do they appear in `updatePriorityRule`? ✅ or ❌
   - Do they appear in final `updateData`? ✅ or ❌

2. **What are the actual values?**
   - Copy the exact arrays being logged
   - Check if UUIDs are valid (36 characters with dashes)

3. **Any errors?**
   - Check for red error messages
   - Check Network tab for database errors

## Quick Check Script

Run this in browser console after attempting to save:

```javascript
// Check localStorage settings
const settings = JSON.parse(localStorage.getItem('settings'));
const rule = settings.priorityRules.find(r => r.name === 'your-rule-name');
console.log('Rule in localStorage:', rule);
console.log('staffIds:', rule.staffIds);
```

---

**Next Steps**: Test with logging enabled and report which log point shows the problem.
