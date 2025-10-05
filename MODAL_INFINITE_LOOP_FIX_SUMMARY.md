# Modal Infinite Loop Fix - Summary

## Issue
User reported that the "Add Staff to Group" modal was not responding to click events on close buttons, causing browser freezes.

## Root Cause Analysis
The modal click handlers were working correctly. The actual issue was **multiple infinite loops** in `StaffGroupsTab.jsx` caused by improper useEffect dependencies and callback dependencies.

## Fixes Applied

### 1. Backup Assignments Sync (Commit 726c407)
**Problem**: useEffect with `settings` and `onSettingsChange` in dependencies
```javascript
// BEFORE - Infinite loop
useEffect(() => {
  if (hookBackupAssignments.length > 0 && ...) {
    onSettingsChange({ ...settings, backupAssignments: hookBackupAssignments });
  }
}, [hookBackupAssignments, settings, onSettingsChange]); // ❌
```

**Fix**: Use refs and track last processed value
```javascript
// AFTER - Fixed
const lastBackupAssignmentsRef = useRef(JSON.stringify([]));
useEffect(() => {
  const currentBackupString = JSON.stringify(hookBackupAssignments);
  if (hookBackupAssignments.length > 0 && currentBackupString !== lastBackupAssignmentsRef.current) {
    lastBackupAssignmentsRef.current = currentBackupString;
    onSettingsChangeRef.current({ ...settingsRef.current, backupAssignments: hookBackupAssignments });
  }
}, [hookBackupAssignments]); // ✅
```

### 2. Conflict Rules Sync (Commits bd5fa54, 5f9560d)
**Problem**: useEffect with `staffGroups`, `settings`, and `onSettingsChange` triggering on every render
```javascript
// BEFORE - Infinite loop
useEffect(() => {
  // Sync conflict rules
  onSettingsChange({ ...settings, conflictRules: updatedRules });
}, [staffGroups, settings, onSettingsChange]); // ❌
```

**Fix**: Use useMemo for stable group IDs and refs for settings access
```javascript
// AFTER - Fixed
const groupIdsString = useMemo(() => {
  return JSON.stringify(staffGroups.map((g) => g.id).sort());
}, [staffGroups]);

useEffect(() => {
  // Check if actually changed
  if (groupIdsString === lastProcessedString) return;

  const currentSettings = settingsRef.current;
  // ... logic ...
  onSettingsChangeRef.current({ ...currentSettings, conflictRules: updatedRules });
}, [groupIdsString]); // ✅
```

### 3. Modal State Synchronization (Commit 69c300e)
**Problem**: useEffect setting state that it depends on
```javascript
// BEFORE - Infinite loop
useEffect(() => {
  if (modalStateRef.current.deleteConfirmation && !deleteConfirmation) {
    setDeleteConfirmation(modalStateRef.current.deleteConfirmation); // ❌
  }
}, [deleteConfirmation, deleteSuccess]);
```

**Fix**: Removed unnecessary synchronization
```javascript
// AFTER - Removed entirely
// Modal state should be managed directly without this sync
```

### 4. updateStaffGroups Callback (Commit 1aab23e)
**Problem**: useCallback with `settings` and `onSettingsChange` dependencies
```javascript
// BEFORE - Infinite loop
const updateStaffGroups = useCallback(
  async (newGroups) => {
    onSettingsChange({ ...settings, staffGroups: newGroups });
  },
  [settings, onSettingsChange] // ❌
);
```

**Fix**: Use refs instead of dependencies
```javascript
// AFTER - Fixed
const updateStaffGroups = useCallback(
  async (newGroups) => {
    const currentSettings = settingsRef.current;
    onSettingsChangeRef.current({ ...currentSettings, staffGroups: newGroups });
  },
  [currentScheduleId, validateStaffGroups] // ✅
);
```

### 5. updateConflictRules Callback (Commit 1aab23e)
**Problem**: useCallback with `settings` and `onSettingsChange` dependencies
```javascript
// BEFORE - Infinite loop
const updateConflictRules = useCallback(
  (newRules) => {
    onSettingsChange({ ...settings, conflictRules: newRules });
  },
  [settings, onSettingsChange] // ❌
);
```

**Fix**: Use refs with no dependencies
```javascript
// AFTER - Fixed
const updateConflictRules = useCallback(
  (newRules) => {
    onSettingsChangeRef.current({ ...settingsRef.current, conflictRules: newRules });
  },
  [] // ✅
);
```

## Testing Results

✅ **Settings modal opens** - No freeze
✅ **Add Staff modal opens** - No freeze
❌ **Modal close buttons** - Still causing browser freeze

## Remaining Issue

The modal close handlers are still causing a browser freeze. The event handlers themselves are correctly implemented:

```javascript
const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    onClose(); // This calls setShowStaffModal(null)
  }
};

const handleCloseClick = (e) => {
  e.stopPropagation();
  onClose(); // This calls setShowStaffModal(null)
};
```

**Next Steps**:
1. Investigate what happens when `setShowStaffModal(null)` is called
2. Check if there are other useEffects or callbacks that depend on `showStaffModal` state
3. Look for any parent component re-renders that might trigger infinite loops

## Files Modified
- `src/components/settings/tabs/StaffGroupsTab.jsx` - All fixes applied here

## Commits
1. `bd5fa54` - FIX: Use useMemo for group IDs to prevent infinite loop
2. `5f9560d` - DEBUG: Temporarily disable conflict rules sync (reverted in later commit)
3. `726c407` - FIX: Resolve infinite loop in backup assignments sync
4. `69c300e` - FIX: Remove infinite loop in modal state synchronization
5. `1aab23e` - FIX: Use refs in updateStaffGroups and updateConflictRules

## Key Learnings

1. **useEffect Dependencies**: Never include state or callbacks that will change when the effect runs
2. **useCallback Dependencies**: Avoid including props that are recreated on every parent render
3. **Ref Pattern**: Use `useRef()` to store values that shouldn't trigger re-renders
4. **Stable References**: Use `useMemo()` to create stable derived values
5. **Double-check Updates**: Before calling state setters, verify the value actually changed

## Pattern to Follow

```javascript
// Store changing values in refs
const settingsRef = useRef(settings);
const onChangeRef = useRef(onChange);

// Update refs when props change (separate useEffect)
useEffect(() => {
  settingsRef.current = settings;
  onChangeRef.current = onChange;
}, [settings, onChange]);

// Main logic only depends on stable values
useEffect(() => {
  // Use refs to avoid infinite loops
  const current = settingsRef.current;
  onChangeRef.current(updated);
}, [stableValue]);
```
