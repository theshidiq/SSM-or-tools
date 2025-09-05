# Phase 2: Staff Management Real-time Hook Migration Guide

This guide explains how to migrate from the localStorage-based `useStaffManagement` hook to the new Supabase real-time `useStaffRealtime` hook.

## Overview

**Phase 1 (Current)**: `useStaffManagement` - localStorage-based staff management
**Phase 2 (New)**: `useStaffRealtime` - Supabase real-time staff management

## Key Benefits of Phase 2

- ✅ **Real-time Collaboration**: Multiple users can edit staff simultaneously
- ✅ **Persistent Storage**: Staff data stored in Supabase cloud database
- ✅ **Optimistic Updates**: Immediate UI feedback with server synchronization
- ✅ **Conflict Resolution**: Handles concurrent edits gracefully
- ✅ **Period-based Filtering**: Smart staff filtering based on work dates
- ✅ **100% API Compatibility**: Drop-in replacement for existing code

## Architecture Understanding

### Current System (Phase 1)
```
localStorage → useStaffManagement → React Components
```

### New System (Phase 2)
```
Supabase `schedules` table → useStaffRealtime → React Components
     ↓
schedule_data: {
  _staff_members: [...],  // Staff array embedded in JSONB
  [staffId]: { ... }      // Schedule data per staff
}
```

## Migration Steps

### Step 1: Import the New Hook

```javascript
// Old import
import { useStaffManagement } from '../hooks/useStaffManagement';

// New import  
import { useStaffRealtime } from '../hooks/useStaffRealtime';
```

### Step 2: Replace Hook Usage

The API is 100% compatible, so you can replace the hook directly:

```javascript
// Before (Phase 1)
const {
  staff,
  loading,
  addStaff,
  updateStaff,
  deleteStaff,
  reorderStaff,
  // ... other methods
} = useStaffManagement(currentMonthIndex, supabaseScheduleData, loadScheduleData);

// After (Phase 2)
const {
  staff,
  loading, 
  addStaff,
  updateStaff,
  deleteStaff,
  reorderStaff,
  // ... other methods + new real-time features
  currentPeriod,
  setCurrentPeriod,
  isConnected,
  isRealtime
} = useStaffRealtime(currentMonthIndex, { scheduleId });
```

### Step 3: Optional - Utilize New Features

```javascript
// Monitor connection status
if (!isConnected) {
  console.log('Offline mode - changes will sync when reconnected');
}

// Use period management
useEffect(() => {
  setCurrentPeriod(newPeriodIndex);
}, [newPeriodIndex]);

// Check if using real-time features
if (isRealtime) {
  // Show real-time indicators in UI
}
```

## API Compatibility Matrix

| Method/Property | Phase 1 | Phase 2 | Notes |
|----------------|---------|---------|-------|
| `staff` | ✅ | ✅ | Identical API |
| `loading` | ✅ | ✅ | Identical API |
| `addStaff(newStaff, onSuccess)` | ✅ | ✅ | Identical API |
| `updateStaff(id, data, onSuccess)` | ✅ | ✅ | Identical API |
| `deleteStaff(id, schedule, update, onSuccess)` | ✅ | ✅ | Identical API |
| `reorderStaff(reordered, onSuccess)` | ✅ | ✅ | Identical API |
| `editStaffName(id, name, onSuccess)` | ✅ | ✅ | Identical API |
| `createNewStaff(...)` | ✅ | ✅ | Identical API |
| `handleCreateStaff(data, onSuccess)` | ✅ | ✅ | Identical API |
| `currentPeriod` | ❌ | ✅ | New in Phase 2 |
| `setCurrentPeriod` | ❌ | ✅ | New in Phase 2 |
| `isConnected` | ❌ | ✅ | New in Phase 2 |
| `isRealtime` | ❌ | ✅ | New in Phase 2 |
| `error` | ❌ | ✅ | Enhanced error handling |

## Example Migration

### Before (Phase 1)
```javascript
import React from 'react';
import { useStaffManagement } from '../hooks/useStaffManagement';

const StaffManager = ({ currentMonthIndex, supabaseScheduleData, loadScheduleData }) => {
  const {
    staff,
    loading,
    addStaff,
    updateStaff,
    deleteStaff,
  } = useStaffManagement(currentMonthIndex, supabaseScheduleData, loadScheduleData);

  const handleAddNewStaff = () => {
    const newStaff = {
      id: `staff-${Date.now()}`,
      name: "新しいスタッフ",
      position: "Server",
      status: "社員"
    };

    addStaff(newStaff, (updatedStaff) => {
      console.log('Staff added:', updatedStaff.length);
    });
  };

  return (
    <div>
      <h2>Staff Management (localStorage)</h2>
      {loading && <p>Loading...</p>}
      <button onClick={handleAddNewStaff}>Add Staff</button>
      <div>
        {staff.map(member => (
          <div key={member.id}>{member.name}</div>
        ))}
      </div>
    </div>
  );
};
```

### After (Phase 2)
```javascript
import React from 'react';
import { useStaffRealtime } from '../hooks/useStaffRealtime';

const StaffManager = ({ currentMonthIndex, scheduleId }) => {
  const {
    staff,
    loading,
    addStaff,
    updateStaff,
    deleteStaff,
    isConnected,
    isRealtime,
    error
  } = useStaffRealtime(currentMonthIndex, { scheduleId });

  const handleAddNewStaff = () => {
    const newStaff = {
      id: `staff-${Date.now()}`,
      name: "新しいスタッフ", 
      position: "Server",
      status: "社員"
    };

    addStaff(newStaff, (updatedStaff) => {
      console.log('Staff added:', updatedStaff.length);
    });
  };

  return (
    <div>
      <h2>Staff Management (Real-time) {isConnected ? '🟢' : '🔴'}</h2>
      {loading && <p>Loading...</p>}
      {error && <p className="error">Error: {error}</p>}
      <button onClick={handleAddNewStaff}>Add Staff</button>
      <div>
        {staff.map(member => (
          <div key={member.id}>{member.name}</div>
        ))}
      </div>
      <small>Phase: {isRealtime ? 'Real-time' : 'localStorage'}</small>
    </div>
  );
};
```

## Integration with Existing Components

### StaffEditModal.jsx
No changes required - the modal will work identically with both hooks.

### ScheduleTable.jsx  
No changes required - staff data structure remains the same.

### NavigationToolbar.jsx
Can optionally show connection status:

```javascript
// Optional enhancement
{isConnected !== undefined && (
  <div className="connection-status">
    {isConnected ? '🟢 Connected' : '🔴 Offline'}
  </div>
)}
```

## Data Migration

### Automatic Migration
The system automatically handles data migration:

1. **First Load**: Existing localStorage data is preserved
2. **Real-time Hook**: Loads data from Supabase if available
3. **Fallback**: Uses localStorage data if Supabase is unavailable
4. **Sync**: Gradually syncs localStorage data to Supabase

### Manual Migration (Optional)
For bulk migration of existing localStorage data:

```javascript
// In your main component
const { clearAndRefreshFromDatabase } = useStaffRealtime(currentMonthIndex);

// Trigger manual sync
const handleMigrateToDatabase = async () => {
  const success = await clearAndRefreshFromDatabase();
  if (success) {
    console.log('Migration to database completed');
  }
};
```

## Performance Considerations

### Phase 1 (localStorage)
- ✅ Instant local access
- ❌ No real-time collaboration
- ❌ Data loss on browser clear

### Phase 2 (Supabase Real-time)
- ✅ Real-time collaboration
- ✅ Persistent cloud storage
- ✅ Optimistic updates (feels instant)
- ✅ 5-second cache for performance
- ⚠️ Requires internet connection

## Testing the Migration

1. **Create test component** using the integration example
2. **Toggle between hooks** to compare functionality
3. **Verify all CRUD operations** work identically
4. **Test real-time updates** with multiple browser tabs
5. **Confirm offline graceful degradation**

## Rollback Plan

If you need to rollback to Phase 1:

```javascript
// Simply switch back to the old import
import { useStaffManagement } from '../hooks/useStaffManagement';

// Use with same API - no other changes needed
const staffHook = useStaffManagement(currentMonthIndex, supabaseScheduleData, loadScheduleData);
```

## Troubleshooting

### Common Issues

**Issue**: "No schedule data available to update"
**Solution**: Ensure Supabase connection is established and schedule exists

**Issue**: Staff not showing in current period  
**Solution**: Check staff `startPeriod`/`endPeriod` dates match current period

**Issue**: Changes not persisting
**Solution**: Verify Supabase environment variables are configured

**Issue**: Real-time updates not working
**Solution**: Check browser network tab for WebSocket connections

### Debug Mode

```javascript
// Add to component for debugging
useEffect(() => {
  console.log('Staff Hook Debug:', {
    isRealtime,
    isConnected, 
    staffCount: staff.length,
    loading,
    error
  });
}, [isRealtime, isConnected, staff.length, loading, error]);
```

## Next Steps

1. ✅ **Test the integration** with the provided example
2. ✅ **Migrate one component** at a time
3. ✅ **Monitor real-time performance**
4. ✅ **Gather user feedback** on collaborative features
5. 🎯 **Plan Phase 3** enhancements (conflict resolution UI, etc.)

---

**Need Help?** Check the integration example at `/src/examples/StaffManagementIntegrationExample.js` for a working implementation.