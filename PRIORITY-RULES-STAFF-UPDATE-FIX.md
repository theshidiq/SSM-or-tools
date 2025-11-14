# Priority Rules - Staff Updates Not Saving to Database

## Problem

When editing a rule and adding/removing staff members, the changes showed in the UI but were **not saved to the database** when clicking the save button (checkmark).

### User Experience
1. Edit rule (click edit button)
2. Add staff member (料理長, 井関)
3. Staff appears in UI chips ✅
4. Click save (checkmark icon)
5. Staff members **NOT saved to database** ❌

### Error Symptom
```javascript
// In edit mode - shows 2 staff
staffIds: ["uuid-1", "uuid-2"]  // UI shows correctly

// After save - database has 0 staff
staffIds: []  // Not saved!
```

## Root Cause

The component uses a **two-layer state system**:

1. **`priorityRules` state** - Main rule data
2. **`editBuffer` state** - Temporary edits during edit mode

### The Flow (Before Fix)

```
User adds staff member
    ↓
addStaffMember() called
    ↓
Updates priorityRules state ✅
    ↓
BUT does NOT update editBuffer ❌
    ↓
User clicks Save
    ↓
handleSaveEdit() syncs from editBuffer only
    ↓
editBuffer doesn't have staffIds changes
    ↓
Database receives empty staffIds ❌
```

### Code Analysis

**addStaffMember function (BEFORE):**
```javascript
const addStaffMember = (ruleId, staffId) => {
  // ... get current staff ...
  const updatedStaffIds = [...currentStaffIds, staffId];

  // ❌ Only updates priorityRules state
  const updatedRules = priorityRules.map(r =>
    r.id === ruleId ? { ...r, staffIds: updatedStaffIds } : r
  );
  updatePriorityRules(updatedRules);

  // ❌ editBuffer NOT updated - staff changes lost on save!
};
```

**handleSaveEdit function:**
```javascript
const handleSaveEdit = () => {
  // ❌ Only syncs from editBuffer
  if (editingRule && editBuffer[editingRule]) {
    syncRuleToServer(editingRule);  // Uses editBuffer data
  }
};
```

**syncRuleToServer function:**
```javascript
const syncRuleToServer = (ruleId) => {
  const bufferedUpdates = editBufferRef.current[ruleId];  // ❌ No staffIds here!

  const updatedRules = priorityRulesRef.current.map((rule) =>
    rule.id === ruleId ? { ...rule, ...bufferedUpdates } : rule  // staffIds missing
  );

  updatePriorityRulesImmediate(updatedRules);  // Saves to database without staffIds
};
```

## Solution

Update `addStaffMember` and `removeStaffMember` to **also update the edit buffer**:

### Code Changes

**File**: `src/components/settings/tabs/PriorityRulesTab.jsx`

#### Fix 1: addStaffMember (Lines 509-514)

**BEFORE:**
```javascript
const updatedStaffIds = [...currentStaffIds, staffId];

// Update rule with new staff member
const updatedRules = priorityRules.map(r =>
  r.id === ruleId ? { ...r, staffIds: updatedStaffIds } : r
);
updatePriorityRules(updatedRules);
```

**AFTER:**
```javascript
const updatedStaffIds = [...currentStaffIds, staffId];

// ✅ FIX: Update edit buffer so changes are included in save
// This ensures staffIds changes are captured when user clicks "Save"
setEditBuffer((prev) => ({
  ...prev,
  [ruleId]: { ...(prev[ruleId] || {}), staffIds: updatedStaffIds },
}));

// Update rule with new staff member
const updatedRules = priorityRules.map(r =>
  r.id === ruleId ? { ...r, staffIds: updatedStaffIds, staffId: undefined } : r
);
updatePriorityRules(updatedRules);
```

#### Fix 2: removeStaffMember (Lines 532-536)

**BEFORE:**
```javascript
const updatedStaffIds = currentStaffIds.filter(id => id !== staffId);

const updatedRules = priorityRules.map(r =>
  r.id === ruleId ? { ...r, staffIds: updatedStaffIds } : r
);
updatePriorityRules(updatedRules);
```

**AFTER:**
```javascript
const updatedStaffIds = currentStaffIds.filter(id => id !== staffId);

// ✅ FIX: Update edit buffer so changes are included in save
setEditBuffer((prev) => ({
  ...prev,
  [ruleId]: { ...(prev[ruleId] || {}), staffIds: updatedStaffIds },
}));

const updatedRules = priorityRules.map(r =>
  r.id === ruleId ? { ...r, staffIds: updatedStaffIds, staffId: undefined } : r
);
updatePriorityRules(updatedRules);
```

## Data Flow (After Fix)

```
User adds staff member
    ↓
addStaffMember() called
    ↓
✅ Updates editBuffer with staffIds
    ↓
Updates priorityRules state
    ↓
User clicks Save
    ↓
handleSaveEdit() syncs from editBuffer
    ↓
✅ editBuffer HAS staffIds changes
    ↓
syncRuleToServer merges buffer into rule
    ↓
✅ Database receives correct staffIds
    ↓
✅ Staff members saved successfully!
```

## Technical Details

### Edit Buffer Pattern

The component uses an **edit buffer pattern** for better UX:

1. **Immediate UI updates** - Changes show instantly
2. **Debounced sync** - Only sync to server after 500ms pause
3. **Buffer merge** - On save, buffer is merged into rule state

**Why This Pattern?**
- Prevents excessive server calls while typing
- Better performance for rapid changes
- User sees instant feedback

### The Fix

Staff operations (add/remove) need to **participate in the buffer pattern**:

```javascript
// Pattern for updating during edit mode:
setEditBuffer((prev) => ({
  ...prev,
  [ruleId]: {
    ...(prev[ruleId] || {}),  // Preserve other buffered changes
    staffIds: updatedStaffIds  // Add staff changes
  }
}));
```

This ensures when `syncRuleToServer` reads the buffer, it includes staff changes.

## Testing

### Test Case 1: Add Staff in Edit Mode
1. Create new rule
2. Click edit
3. Add staff member "John Doe"
4. Add another staff "Jane Smith"
5. Click Save (checkmark)
6. **Expected**: Both staff saved to database
7. Refresh browser
8. **Expected**: Both staff still appear

### Test Case 2: Remove Staff in Edit Mode
1. Edit existing rule with 3 staff
2. Remove 1 staff member
3. Click Save
4. **Expected**: Only 2 staff in database
5. Refresh browser
6. **Expected**: Only 2 staff shown

### Test Case 3: Mixed Operations
1. Edit rule with 1 staff
2. Add 2 more staff (total: 3)
3. Remove 1 staff (total: 2)
4. Add 1 more (total: 3)
5. Click Save
6. **Expected**: 3 staff in database

### Verification Command

Check console logs:
```javascript
// When adding staff:
✅ Added staff member to rule "Weekend Shifts": uuid-123

// When saving:
🔄 [DEBOUNCE] Syncing buffered updates for rule uuid-456: { staffIds: [...] }

// In database (check via SQL):
SELECT rule_definition->>'staff_ids' FROM priority_rules WHERE id = 'rule-uuid';
```

## Related Issues

This fix complements:
1. **UI Display Fix** - Shows all staff members
2. **Backward Compatibility** - Loads old format staff IDs
3. **Validation Fix** - Prevents empty staff IDs
4. **Schema Cleanup** - Single source in JSONB

## Files Modified

**`src/components/settings/tabs/PriorityRulesTab.jsx`**
- Lines 509-514: `addStaffMember` - Update edit buffer
- Lines 532-536: `removeStaffMember` - Update edit buffer

## Benefits

✅ **Staff changes persist** when clicking save
✅ **No data loss** during edit mode
✅ **Consistent with other edits** (name, description use same buffer)
✅ **Better UX** - Changes save as expected
✅ **Maintains debounce pattern** for other fields

---

**Date**: 2025-11-13
**Issue**: Staff members added/removed in edit mode not saving to database
**Cause**: `addStaffMember`/`removeStaffMember` didn't update edit buffer
**Fix**: Both functions now update `editBuffer` state before save
**Status**: ✅ FIXED - Ready for testing
