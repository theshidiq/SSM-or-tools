# Fix: Group Cards Jumping When Editing

## Problem
When clicking edit on a staff group card, the cards would reorder/jump positions instead of staying in place.

## Root Cause
The group header had inconsistent flex layout structure when toggling between edit and view modes:

**Before (Problematic):**
```jsx
{isEditing ? (
  <div className="flex-1 min-w-0">
    <input ... />
  </div>
) : (
  <h3 className="... truncate">{displayName}</h3>
)}
```

The conditional rendering created different DOM structures:
- **Edit mode**: Input wrapped in a `div.flex-1`
- **View mode**: H3 directly in parent (no wrapper)

This caused React to recalculate the flex layout differently, leading to cards reordering.

## Solution
Wrap both the input and h3 in a consistent container element:

**After (Fixed):**
```jsx
<div className="flex-1 min-w-0">
  {isEditing ? (
    <input ... />
  ) : (
    <h3 className="... truncate">{displayName}</h3>
  )}
</div>
```

Now both states have the same flex structure, maintaining stable positioning.

## Files Changed
- `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/settings/tabs/StaffGroupsTab.jsx` (lines 924-947)

## Testing
1. Open Settings modal
2. Navigate to "Staff Groups" tab
3. Click edit on any group card
4. **Expected**: Card stays in same position
5. Type in the name field
6. **Expected**: Card doesn't move
7. Save or cancel
8. **Expected**: Card remains in place

## Technical Details
- The fix ensures consistent DOM structure regardless of edit state
- React's reconciliation algorithm now sees the same structure and doesn't reorder
- The `key` prop (`group.id`) was already correct, but the layout shift was causing visual reordering
- The wrapper `div` with `flex-1 min-w-0` ensures proper flex behavior in both modes
