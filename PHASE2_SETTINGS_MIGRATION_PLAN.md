# Phase 2 Migration Plan: SettingsModal → useSettings() Hook

## Executive Summary

Migrate SettingsModal from prop drilling to Context-based `useSettings()` hook to eliminate infinite loop risks and improve maintainability.

**Files Affected:**
- `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/settings/SettingsModal.jsx` (primary changes)
- `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/ShiftScheduleEditorPhase3.jsx` (remove props)

---

## Current Architecture Analysis

### SettingsModal Current Props (Lines 45-66)
```javascript
const SettingsModal = ({
  isOpen,                    // ✅ KEEP - Modal control
  onClose,                   // ✅ KEEP - Modal control
  isAutoSaving = false,      // ❌ REMOVE - From hook
  error = null,              // ❌ REMOVE - From hook
  // Settings data
  settings,                  // ❌ REMOVE - From hook
  onSettingsChange,          // ❌ REMOVE - From hook (updateSettings)
  // Staff data for reference
  staffMembers = [],         // ✅ KEEP - External dependency
  // Configuration management
  onResetConfig,             // ❌ REMOVE - From hook (resetToDefaults)
  // Validation and preview
  validationErrors = {},     // ❌ REMOVE - From hook
  // Autosave state
  autosaveError = null,      // ❌ REMOVE - From hook
  isAutosaveEnabled = true,  // ❌ REMOVE - From hook
  onToggleAutosave,          // ❌ REMOVE - From hook (setIsAutosaveEnabled)
  lastSaveTime = null,       // ❌ REMOVE - From hook
  // Phase 2: Schedule validation
  currentScheduleId = null,  // ✅ KEEP - External dependency
}) => {
```

### Current Hook Usage (Lines 68-75)
```javascript
// PROBLEM: SettingsModal already calls useSettingsData()
// This creates duplicate hook instances and prop redundancy!
const {
  backendMode,
  isConnectedToBackend,
  connectionStatus,
  currentVersion,
  versionName,
  isVersionLocked,
} = useSettingsData();
```

---

## Step-by-Step Migration Plan

### Step 1: Update SettingsModal Imports

**File:** `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/settings/SettingsModal.jsx`

**Line 23-24 (BEFORE):**
```javascript
import { useSettingsCache } from "../../hooks/useConfigurationCache";
import { useSettingsData } from "../../hooks/useSettingsData";
```

**Line 23-24 (AFTER):**
```javascript
import { useSettingsCache } from "../../hooks/useConfigurationCache";
import { useSettings } from "../../contexts/SettingsContext";
```

**Rationale:** Replace direct hook import with context consumer hook.

---

### Step 2: Update Function Signature

**Lines 45-66 (BEFORE):**
```javascript
const SettingsModal = ({
  isOpen,
  onClose,
  isAutoSaving = false,
  error = null,
  settings,
  onSettingsChange,
  staffMembers = [],
  onResetConfig,
  validationErrors = {},
  autosaveError = null,
  isAutosaveEnabled = true,
  onToggleAutosave,
  lastSaveTime = null,
  currentScheduleId = null,
}) => {
```

**Lines 45-66 (AFTER):**
```javascript
const SettingsModal = ({
  // Modal control props (REQUIRED)
  isOpen,
  onClose,
  // External dependencies (REQUIRED)
  staffMembers = [],
  currentScheduleId = null,
}) => {
```

**Rationale:**
- Keep only props that can't be obtained from context
- Remove 11 props that are available via `useSettings()`
- Cleaner API with 4 props instead of 15

---

### Step 3: Replace useSettingsData with useSettings

**Lines 68-75 (BEFORE):**
```javascript
// Backend mode and version info from useSettingsData
const {
  backendMode,
  isConnectedToBackend,
  connectionStatus,
  currentVersion,
  versionName,
  isVersionLocked,
} = useSettingsData();
```

**Lines 68-90 (AFTER):**
```javascript
// Get all settings data and actions from context
const {
  // Settings state
  settings,
  validationErrors,
  error,

  // Actions
  updateSettings: onSettingsChange,
  resetToDefaults: onResetConfig,
  setIsAutosaveEnabled: onToggleAutosave,

  // Autosave state
  isAutosaving: isAutoSaving,
  autosaveError,
  isAutosaveEnabled,
  lastSaveTime,

  // Backend mode and version info
  backendMode,
  isConnectedToBackend,
  connectionStatus,
  currentVersion,
  versionName,
  isVersionLocked,
} = useSettings();
```

**Rationale:**
- Single source of truth from context
- All properties destructured with meaningful aliases
- No duplicate hook instances
- Stable references prevent infinite loops

---

### Step 4: Verify No Other Changes Needed

**Lines 179-185 (commonProps object - NO CHANGES):**
```javascript
const commonProps = {
  settings,               // ✅ Now from useSettings()
  onSettingsChange,       // ✅ Now from useSettings()
  staffMembers,           // ✅ Still from props
  validationErrors: validationErrors[activeTab] || {},  // ✅ Now from useSettings()
  currentScheduleId,      // ✅ Still from props
};
```

**Lines 322-359 (Footer autosave UI - NO CHANGES):**
```javascript
{isAutoSaving && (        // ✅ Now from useSettings()
  <div className="flex items-center gap-2 text-blue-600">
    <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <span className="text-sm font-medium">Auto-saving...</span>
  </div>
)}
```

**Rationale:** Rest of component works unchanged because variable names are aliased correctly.

---

### Step 5: Update Parent Component (ShiftScheduleEditorPhase3.jsx)

**File:** `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/ShiftScheduleEditorPhase3.jsx`

**Lines 735-751 (BEFORE):**
```javascript
{showSettingsModal && (
  <SettingsModal
    isOpen={showSettingsModal}
    onClose={() => setShowSettingsModal(false)}
    settings={settings}
    onSettingsChange={updateSettings}
    onResetConfig={resetToDefaults}
    validationErrors={validationErrors}
    isAutoSaving={isAutosaving}
    lastSaveTime={lastSaveTime}
    autosaveError={autosaveError}
    isAutosaveEnabled={isAutosaveEnabled}
    onToggleAutosave={setIsAutosaveEnabled}
    currentScheduleId={currentScheduleId}
    staffMembers={effectiveStaffMembers}
  />
)}
```

**Lines 735-741 (AFTER):**
```javascript
{showSettingsModal && (
  <SettingsModal
    isOpen={showSettingsModal}
    onClose={() => setShowSettingsModal(false)}
    currentScheduleId={currentScheduleId}
    staffMembers={effectiveStaffMembers}
  />
)}
```

**Rationale:**
- Remove 11 props that are now obtained from context
- Keep only 4 essential props
- Cleaner parent component
- No prop drilling needed

---

### Step 6: Verify SettingsProvider is Wrapping App

**File:** `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/ShiftScheduleEditorPhase3.jsx`

**Check Lines 24 and component structure:**
```javascript
import { SettingsProvider } from "../contexts/SettingsContext";

// Ensure component is wrapped:
<SettingsProvider autosaveEnabled={true}>
  <ShiftScheduleEditorPhase3 ... />
</SettingsProvider>
```

**Rationale:** Context must be provided before `useSettings()` is called.

---

## Potential Issues & Mitigations

### Issue 1: Duplicate Hook Instances (CRITICAL - Currently Happening!)

**Problem:**
- SettingsModal currently calls `useSettingsData()` directly (line 75)
- Parent also calls `useSettingsData()` (line 233)
- This creates TWO separate instances with different state!

**Symptom:**
- Changes in modal might not reflect in parent
- Potential race conditions and data desync

**Solution:**
- ✅ Use context to share single hook instance
- ✅ Parent wraps with `<SettingsProvider>`
- ✅ Both components use `useSettings()` hook
- ✅ Single source of truth guaranteed

---

### Issue 2: Infinite Loop Risk from Prop Wrapping

**Problem (Lines 87-89 - ALREADY FIXED):**
```javascript
// ❌ OLD CODE (caused infinite loops):
const handleSettingsChange = useCallback((newSettings) => {
  onSettingsChange(newSettings);
}, [onSettingsChange]);
```

**Current Status:**
- Already fixed in current code (lines 87-90 comment)
- Direct prop passing prevents infinite loops
- Migration to context eliminates this entirely

**Solution:**
- ✅ Context provides stable function references
- ✅ No need for prop wrapping
- ✅ useCallback inside hook prevents recreation

---

### Issue 3: Backend Mode Props Redundancy

**Problem:**
- SettingsModal receives `error` prop from parent
- Also has `backendMode`, `connectionStatus` from own hook call
- Conflicting sources of truth

**Solution:**
- ✅ Context provides single backend status
- ✅ Remove `error` prop
- ✅ Use `error` from `useSettings()` hook

---

### Issue 4: Validation Errors Structure

**Current Code (Line 183):**
```javascript
validationErrors: validationErrors[activeTab] || {},
```

**Potential Issue:**
- Parent might pass different validation structure
- Context might have different format

**Verification Needed:**
- Check if `validationErrors` from hook matches expected structure
- Ensure it has tab-based organization: `{ 'staff-groups': {...}, ... }`

**Solution:**
- ✅ useSettingsData already returns `validationErrors` object (line 14)
- ✅ Structure is compatible (set by configService validation)
- ✅ No changes needed to consumption code

---

### Issue 5: useEffect Dependency Arrays

**Check all useEffect hooks for removed props:**

**Line 91-100 (Modal visibility - SAFE):**
```javascript
useEffect(() => {
  if (isOpen) {
    setIsVisible(true);
    setActiveTab("staff-groups");
  } else {
    const timer = setTimeout(() => setIsVisible(false), 300);
    return () => clearTimeout(timer);
  }
}, [isOpen]);  // ✅ isOpen still a prop - NO CHANGE
```

**Line 117-156 (Keyboard shortcuts - SAFE):**
```javascript
useEffect(() => {
  if (!isOpen) return;
  // ... keyboard handlers
}, [isOpen, onClose]);  // ✅ Both still props - NO CHANGE
```

**Conclusion:** No useEffect dependency issues - migration is safe!

---

## Migration Sequence (Order of Operations)

### Phase 1: Prepare (5 minutes)
1. ✅ Verify SettingsProvider is wrapping app (already done - line 24)
2. ✅ Run tests to establish baseline
3. ✅ Backup current SettingsModal.jsx

### Phase 2: Update SettingsModal (10 minutes)
1. Update imports (Step 1)
2. Simplify function signature (Step 2)
3. Replace useSettingsData with useSettings (Step 3)
4. Test modal in isolation

### Phase 3: Update Parent (5 minutes)
1. Remove 11 props from SettingsModal usage (Step 5)
2. Keep only 4 essential props
3. Test parent-child integration

### Phase 4: Validation (10 minutes)
1. Open settings modal - verify no freezing
2. Change staff groups - verify updates work
3. Toggle autosave - verify state persists
4. Check browser console - no errors
5. Verify WebSocket mode indicator shows correctly
6. Test reset to defaults - confirm modal closes

### Total Time: ~30 minutes

---

## Testing Checklist

### Functional Tests
- [ ] Modal opens without freezing or delay
- [ ] Settings display correctly on open
- [ ] Staff groups tab updates work
- [ ] Daily limits tab updates work
- [ ] Priority rules tab updates work
- [ ] ML parameters tab updates work
- [ ] Data migration tab loads correctly
- [ ] Reset to defaults works
- [ ] No console errors or warnings

### State Management Tests
- [ ] Changes in modal reflect in parent immediately
- [ ] Autosave indicator shows correct state
- [ ] WebSocket mode indicator accurate
- [ ] Version info displays (if WebSocket mode)
- [ ] Validation errors show on correct tabs
- [ ] Last save time updates correctly

### Edge Cases
- [ ] Open modal → change settings → close → reopen (state preserved)
- [ ] Toggle autosave while editing (no crashes)
- [ ] Reset while unsaved changes (confirmation works)
- [ ] WebSocket disconnect during edit (fallback works)
- [ ] Multiple rapid setting changes (no race conditions)

### Performance Tests
- [ ] Modal opens in <100ms
- [ ] No infinite render loops (check React DevTools)
- [ ] No unnecessary re-renders
- [ ] Memory usage stable (no leaks)

### Integration Tests
- [ ] Settings from modal affect schedule table
- [ ] Staff groups validation uses current staff
- [ ] Schedule ID passed for validation context
- [ ] Import/export configuration works
- [ ] WebSocket multi-table sync functional

---

## Rollback Plan

If migration causes issues:

### Immediate Rollback (< 2 minutes)
```bash
# Restore backup
cp SettingsModal.jsx.backup src/components/settings/SettingsModal.jsx
```

### Partial Rollback Strategy
1. Keep context in place (don't remove SettingsProvider)
2. Add back props to SettingsModal
3. Use hybrid approach: context for some, props for others
4. Debug specific issue before full migration

### Prevention Measures
- Commit before migration: `git commit -m "Pre-migration checkpoint"`
- Test each step before proceeding
- Keep browser DevTools open to catch errors immediately

---

## Code Snippets Summary

### Before (Current Code)
```javascript
// SettingsModal.jsx - 15 props
const SettingsModal = ({
  isOpen, onClose, isAutoSaving, error, settings,
  onSettingsChange, staffMembers, onResetConfig,
  validationErrors, autosaveError, isAutosaveEnabled,
  onToggleAutosave, lastSaveTime, currentScheduleId
}) => {
  const { backendMode, ... } = useSettingsData();
  // ...
}

// Parent usage - 11 settings props
<SettingsModal
  isOpen={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
  settings={settings}
  onSettingsChange={updateSettings}
  onResetConfig={resetToDefaults}
  validationErrors={validationErrors}
  isAutoSaving={isAutosaving}
  lastSaveTime={lastSaveTime}
  autosaveError={autosaveError}
  isAutosaveEnabled={isAutosaveEnabled}
  onToggleAutosave={setIsAutosaveEnabled}
  currentScheduleId={currentScheduleId}
  staffMembers={effectiveStaffMembers}
/>
```

### After (Migrated Code)
```javascript
// SettingsModal.jsx - 4 props only
const SettingsModal = ({
  isOpen,
  onClose,
  staffMembers = [],
  currentScheduleId = null,
}) => {
  const {
    settings,
    validationErrors,
    error,
    updateSettings: onSettingsChange,
    resetToDefaults: onResetConfig,
    setIsAutosaveEnabled: onToggleAutosave,
    isAutosaving: isAutoSaving,
    autosaveError,
    isAutosaveEnabled,
    lastSaveTime,
    backendMode,
    isConnectedToBackend,
    connectionStatus,
    currentVersion,
    versionName,
    isVersionLocked,
  } = useSettings();
  // ...
}

// Parent usage - 4 props only
<SettingsModal
  isOpen={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
  currentScheduleId={currentScheduleId}
  staffMembers={effectiveStaffMembers}
/>
```

### Key Improvements
- ✅ **73% fewer props** (15 → 4)
- ✅ **Single source of truth** (no duplicate hooks)
- ✅ **Stable references** (context prevents infinite loops)
- ✅ **Better maintainability** (changes in one place)
- ✅ **Type safety** (context enforces shape)
- ✅ **Cleaner API** (parent doesn't manage settings state)

---

## Success Criteria

Migration is complete when:

1. ✅ SettingsModal uses `useSettings()` hook exclusively
2. ✅ Parent passes only 4 props (isOpen, onClose, staffMembers, currentScheduleId)
3. ✅ All tests pass (functional, state, edge cases, performance)
4. ✅ No console errors or warnings
5. ✅ WebSocket mode indicator works correctly
6. ✅ Autosave functionality unchanged
7. ✅ No infinite loops or performance degradation
8. ✅ Code review approved

---

## Next Steps After Migration

1. **Update Documentation**
   - Update CLAUDE.md with new SettingsModal API
   - Document useSettings() hook usage pattern
   - Add migration notes to INTEGRATION_PLAN

2. **Apply Pattern to Other Components**
   - Migrate other settings consumers to useSettings()
   - Remove redundant prop drilling throughout app
   - Standardize on context-based state management

3. **Add Type Safety**
   - Create TypeScript interfaces for settings
   - Add PropTypes validation to SettingsModal
   - Document expected prop shapes

4. **Performance Optimization**
   - Memoize expensive computations in context
   - Add React DevTools Profiler measurements
   - Optimize re-render patterns if needed

---

## References

- SettingsContext: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/contexts/SettingsContext.jsx`
- useSettingsData: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useSettingsData.js`
- SettingsModal: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/settings/SettingsModal.jsx`
- Parent: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/ShiftScheduleEditorPhase3.jsx`
