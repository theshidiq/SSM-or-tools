# Integration Plan: Staff & Settings with Schedule WebSocket

## Overview
This document outlines the integration strategy for connecting StaffEditModal and SettingsModal with the new Go WebSocket shift management system.

## Current Architecture

### Data Flow
```
User Action (UI)
    ↓
React Component (StaffEditModal / SettingsModal)
    ↓
WebSocket Hook (useWebSocketStaff / useWebSocketSettings)
    ↓
Go WebSocket Server (main.go)
    ↓
Supabase Database
    ↓
Broadcast to All Clients (Real-time sync)
```

### Database Schema

#### Staff Table
```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  type TEXT, -- 'regular' or 'part-time'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Schedules Table
```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY,
  schedule_data JSONB NOT NULL, -- { staffId: { dateKey: shiftValue } }
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Schedule-Period Link
```sql
CREATE TABLE schedule_staff_assignments (
  id UUID PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id),
  staff_id UUID REFERENCES staff(id), -- NULL for period-level schedules
  period_index INTEGER NOT NULL,
  UNIQUE(schedule_id, period_index)
);
```

## Key Integration Points

### 1. Staff Edit Modal → Schedule Synchronization

#### When Staff is Deleted
```javascript
// StaffEditModal.jsx
const handleDeleteStaff = useCallback(async (staffId) => {
  try {
    // Step 1: Delete staff via WebSocket
    await deleteStaff(staffId);

    // Step 2: Clean up schedule data for this staff across ALL periods
    const periodsToUpdate = await findPeriodsWithStaffData(staffId);

    for (const periodIndex of periodsToUpdate) {
      const scheduleId = await getScheduleIdForPeriod(periodIndex);
      const currentSchedule = await fetchScheduleData(scheduleId);

      // Remove staff from schedule
      const updatedSchedule = { ...currentSchedule };
      delete updatedSchedule[staffId];

      // Broadcast via shift WebSocket
      await webSocketShifts.bulkUpdate(scheduleId, [{
        type: 'DELETE_STAFF_SHIFTS',
        staffId,
        scheduleData: updatedSchedule
      }]);
    }

    toast.success(`Staff deleted and schedule updated`);
  } catch (error) {
    console.error('Failed to delete staff:', error);
    toast.error('Failed to delete staff');
  }
}, [deleteStaff, webSocketShifts]);
```

#### When Staff is Updated
```javascript
// StaffEditModal.jsx
const handleUpdateStaff = useCallback(async (staffId, updates) => {
  try {
    // Step 1: Update staff via WebSocket
    const updatedStaff = await updateStaff(staffId, updates);

    // Step 2: Check if staff type changed (regular ↔ part-time)
    if (updates.type && updates.type !== selectedStaffForEdit.type) {
      // Validate schedule against new staff type constraints
      const violations = await validateStaffScheduleConstraints(
        staffId,
        updates.type
      );

      if (violations.length > 0) {
        toast.warning(`${violations.length} schedule adjustments needed`);
      }
    }

    // Step 3: If invalidateAllPeriodsCache provided, refresh all data
    if (invalidateAllPeriodsCache) {
      await invalidateAllPeriodsCache();
    }

    toast.success('Staff updated successfully');
  } catch (error) {
    console.error('Failed to update staff:', error);
    toast.error('Failed to update staff');
  }
}, [updateStaff, invalidateAllPeriodsCache]);
```

### 2. Settings Modal → Schedule Validation

#### Staff Groups Conflict Detection
```javascript
// SettingsModal.jsx - StaffGroupsTab
const validateStaffGroupConflicts = useCallback(async (newStaffGroups) => {
  // Get current schedule for active period
  const currentSchedule = await fetchScheduleData(currentScheduleId);

  // Check each date for group conflicts
  const conflicts = [];
  Object.keys(currentSchedule).forEach(staffId => {
    const staffSchedule = currentSchedule[staffId];

    Object.keys(staffSchedule).forEach(dateKey => {
      const shift = staffSchedule[dateKey];
      if (!shift || shift === '×') return; // Skip off days

      // Find staff members working on this date
      const workingStaff = Object.keys(currentSchedule)
        .filter(id => {
          const otherShift = currentSchedule[id]?.[dateKey];
          return otherShift && otherShift !== '×';
        });

      // Check if any conflict groups are working together
      newStaffGroups.forEach(group => {
        const groupMembersWorking = workingStaff.filter(id =>
          group.members.includes(id)
        );

        if (groupMembersWorking.length > 1) {
          conflicts.push({
            date: dateKey,
            group: group.name,
            members: groupMembersWorking
          });
        }
      });
    });
  });

  return conflicts;
}, [currentScheduleId]);

// Use in settings change handler
const handleStaffGroupsChange = useCallback(async (newStaffGroups) => {
  const conflicts = await validateStaffGroupConflicts(newStaffGroups);

  if (conflicts.length > 0) {
    toast.warning(
      `Warning: ${conflicts.length} existing schedule conflicts with new staff groups`,
      {
        description: 'Review schedule for conflicting assignments',
        action: {
          label: 'View Conflicts',
          onClick: () => showConflictsModal(conflicts)
        }
      }
    );
  }

  // Update settings via WebSocket
  await updateStaffGroups(newStaffGroups);
}, [validateStaffGroupConflicts, updateStaffGroups]);
```

#### Daily Limits Validation
```javascript
// SettingsModal.jsx - DailyLimitsTab
const validateDailyLimitsCompliance = useCallback(async (newDailyLimits) => {
  const currentSchedule = await fetchScheduleData(currentScheduleId);
  const violations = [];

  // Check each date's shift counts against limits
  const dateShiftCounts = {};
  Object.values(currentSchedule).forEach(staffSchedule => {
    Object.keys(staffSchedule).forEach(dateKey => {
      const shift = staffSchedule[dateKey];
      if (!shift || shift === '×') return;

      if (!dateShiftCounts[dateKey]) {
        dateShiftCounts[dateKey] = { '△': 0, '○': 0, total: 0 };
      }

      if (shift === '△') dateShiftCounts[dateKey]['△']++;
      if (shift === '○') dateShiftCounts[dateKey]['○']++;
      dateShiftCounts[dateKey].total++;
    });
  });

  // Compare against new limits
  Object.keys(dateShiftCounts).forEach(dateKey => {
    const counts = dateShiftCounts[dateKey];
    const dayOfWeek = new Date(dateKey).getDay();
    const limit = newDailyLimits[dayOfWeek];

    if (limit) {
      if (limit.earlyShift && counts['△'] > limit.earlyShift) {
        violations.push({
          date: dateKey,
          type: 'Early shift limit exceeded',
          current: counts['△'],
          limit: limit.earlyShift
        });
      }
      if (limit.totalShifts && counts.total > limit.totalShifts) {
        violations.push({
          date: dateKey,
          type: 'Total shifts limit exceeded',
          current: counts.total,
          limit: limit.totalShifts
        });
      }
    }
  });

  return violations;
}, [currentScheduleId]);
```

### 3. Cleanup Old ULID-based Schedules

**Decision**: Skip migration, delete old schedules and start fresh with UUID system.

#### Cleanup SQL
```sql
-- Delete old ULID-based schedules (created before Oct 2025)
DELETE FROM schedule_staff_assignments
WHERE schedule_id IN (
  SELECT id FROM schedules
  WHERE created_at < '2025-10-01'
);

DELETE FROM schedules
WHERE created_at < '2025-10-01';
```

#### Cleanup Hook (Optional UI)
```javascript
// src/hooks/useScheduleCleanup.js
import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

export const useScheduleCleanup = () => {
  const [isCleaning, setIsCleaning] = useState(false);

  const cleanupOldSchedules = useCallback(async () => {
    setIsCleaning(true);
    try {
      // Delete old assignments first (foreign key constraint)
      const { data: deletedAssignments } = await supabase
        .from('schedule_staff_assignments')
        .delete()
        .in('schedule_id',
          supabase
            .from('schedules')
            .select('id')
            .lt('created_at', '2025-10-01')
        );

      // Delete old schedules
      const { data: deletedSchedules } = await supabase
        .from('schedules')
        .delete()
        .lt('created_at', '2025-10-01')
        .select('id');

      return {
        success: true,
        deletedCount: deletedSchedules?.length || 0
      };
    } catch (error) {
      console.error('Cleanup failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsCleaning(false);
    }
  }, []);

  return {
    cleanupOldSchedules,
    isCleaning
  };
};
```

## Implementation Checklist

### Phase 1: Staff Edit Modal Integration
- [ ] Add schedule cleanup on staff delete
- [ ] Add schedule validation on staff update
- [ ] Implement real-time sync with shift WebSocket
- [ ] Add error handling and rollback logic
- [ ] Test with concurrent users

### Phase 2: Settings Modal Integration
- [ ] Implement staff groups conflict validation
- [ ] Implement daily limits compliance checking
- [ ] Add priority rules impact preview
- [ ] Integrate ML parameter changes with schedule generation
- [ ] Test settings changes with existing schedules

### Phase 3: Database Cleanup
- [ ] Create cleanup hook (useScheduleCleanup)
- [ ] Add cleanup UI in SettingsModal → Data Migration tab
- [ ] Delete old ULID-based schedules (pre-Oct 2025)
- [ ] Verify no orphaned records remain
- [ ] Document cleanup operation in logs

### Phase 4: Testing & Validation
- [ ] Unit tests for migration logic
- [ ] Integration tests for staff CRUD + schedule sync
- [ ] E2E tests for settings changes + schedule validation
- [ ] Load tests for concurrent WebSocket operations
- [ ] Browser compatibility testing

## Risk Mitigation

### Data Loss Prevention
1. **Always backup before migration**
2. **Implement transaction rollback** for failed operations
3. **Maintain old schedule IDs** as references
4. **Log all migration operations** for audit trail

### Performance Considerations
1. **Batch WebSocket messages** for bulk operations
2. **Implement debouncing** for rapid settings changes
3. **Use optimistic updates** for better UX
4. **Cache frequently accessed data**

### User Experience
1. **Show loading states** during operations
2. **Provide clear error messages** with recovery options
3. **Implement undo functionality** for critical changes
4. **Add confirmation dialogs** for destructive actions

## Success Metrics
- ✅ Zero data loss during migration
- ✅ < 100ms response time for WebSocket operations
- ✅ 100% schedule integrity after staff/settings changes
- ✅ Real-time sync working across all clients
- ✅ All tests passing with >80% coverage
