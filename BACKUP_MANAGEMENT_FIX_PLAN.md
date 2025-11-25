# Backup Management - Architecture Fix & AI Integration Plan

**Version**: 1.0
**Date**: 2025-11-24
**Status**: 🚧 PENDING REVIEW
**Priority**: 🔴 CRITICAL (Data Loss Issue)

---

## 📋 Executive Summary

### The Problem

Backup assignments are **created successfully** but **lost on page refresh** because they're:
- ✅ Saved to localStorage (old architecture)
- ❌ **NOT synced to database** (WebSocket integration missing)
- ❌ Lost when page reloads from database

### The Solution

Implement **WebSocket sync for backup assignments** following the same pattern as `staffGroups` and `priorityRules`, then integrate with AI scheduler.

### Estimated Time
- **Phase 1** (Fix data persistence): 4-6 hours
- **Phase 2** (AI integration): 2-3 hours
- **Total**: 6-9 hours

---

## 🔍 Root Cause Analysis

### Current Broken Flow

```
User Creates Backup Assignment
    ↓
useBackupStaffService.addBackupAssignment()
    ↓
ConfigurationService.updateBackupAssignments()
    ↓
saveSettings() → Checks useWebSocket === true
    ↓
"⏭️ Skipping saveSettings - using WebSocket multi-table backend"
    ↓
❌ NO DATABASE WRITE (WebSocket sync not implemented!)
    ↓
Page Refresh → Load from WebSocket/Database
    ↓
❌ backupAssignments = [] (not in database)
    ↓
USER SEES EMPTY LIST
```

### Why This Happens

**The backup feature uses OLD ARCHITECTURE** while the app uses **NEW HYBRID ARCHITECTURE**:

| Feature | Architecture | Persistence | Status |
|---------|-------------|-------------|--------|
| Staff Groups | ✅ WebSocket + DB | Supabase `staff_groups` | ✅ Working |
| Priority Rules | ✅ WebSocket + DB | Supabase `priority_rules` | ✅ Working |
| Weekly Limits | ✅ WebSocket + DB | Supabase `weekly_limits` | ✅ Working |
| Daily Limits | ✅ Object format | localStorage | ✅ Working |
| **Backup Assignments** | ❌ localStorage only | ❌ Not synced | ❌ **BROKEN** |

---

## 📂 Current Implementation Overview

### Files Involved

#### **✅ Complete (No Changes Needed)**
1. **`src/services/BackupStaffService.js`** (955 lines)
   - Core backup logic and validation
   - Business rules implementation
   - Coverage compensation logic

2. **`src/hooks/useBackupStaffService.js`** (264 lines)
   - React hook wrapper
   - UI state management
   - Calls ConfigurationService

3. **`src/components/settings/tabs/StaffGroupsTab.jsx`** (lines 998-1198)
   - Backup Management UI section
   - Create/delete backup assignments
   - Visual display of assignments

4. **`src/ai/constraints/ConstraintEngine.js`** (lines 1219-1400)
   - `validateCoverageCompensation()` function
   - Already accepts `backupAssignments` parameter
   - Validation logic complete

5. **`database/add-missing-tables.sql`** (lines 14-38)
   - `staff_backup_assignments` table schema
   - Foreign keys and indexes defined
   - RLS policies configured

#### **⚠️ Needs Modification**
1. **`src/hooks/useWebSocketSettings.js`**
   - Add: `wsCreateBackupAssignment()`
   - Add: `wsUpdateBackupAssignment()`
   - Add: `wsDeleteBackupAssignment()`

2. **`src/hooks/useSettingsData.js`** (lines 454-699)
   - Add backup assignment change detection
   - Add WebSocket method calls
   - Similar to staffGroups logic

3. **`src/services/ConfigurationService.js`**
   - Update `syncExternalSettings()` to include backupAssignments

4. **`go-server/handlers/settings.go`**
   - Add `BACKUP_ASSIGNMENT_CREATE` handler
   - Add `BACKUP_ASSIGNMENT_UPDATE` handler
   - Add `BACKUP_ASSIGNMENT_DELETE` handler

#### **❌ Missing (Needs Creation)**
1. **`go-server/supabase/backup_assignments.go`** (NEW FILE)
   - CRUD operations for `staff_backup_assignments` table
   - Similar to `staff_groups.go` pattern
   - ~200 lines estimated

---

## 🎯 Business Logic Requirements

### Expected Behavior

**Scenario**: Kitchen staff member takes day off

**Before Backup Coverage:**
```
Date: 2025-01-15
- 佐藤 (キッチン): ×  ← Day off
- 中田 (パート):     ← Not assigned
- ❌ Kitchen group has no coverage!
```

**After Backup Coverage:**
```
Date: 2025-01-15
- 佐藤 (キッチン): ×  ← Day off
- 中田 (パート):  ○  ← Automatically assigned by AI!
- ✅ Kitchen group has backup coverage!
```

### AI Integration Points

**Where AI Should Use Backup Data:**
1. **Load Phase**: Get `backupAssignments` from settings
2. **Initialize**: `BackupStaffService.initialize(staffMembers, staffGroups, backupAssignments)`
3. **Generation**: Call `processBackupAssignments(schedule)` during or after schedule creation
4. **Validation**: Use `validateCoverageCompensation()` to check coverage

**Current Status:**
- ✅ Validation logic exists
- ✅ Processing logic exists
- ❌ Data loading broken (persistence issue)
- ❌ AI not calling backup methods

---

## 🛠️ Implementation Plan

### Phase 1: Fix Data Persistence (CRITICAL)

**Priority**: 🔴 CRITICAL
**Time**: 4-6 hours
**Goal**: Make backup assignments survive page refresh

#### Step 1.1: Create Go Database Operations (2 hours)

**File**: `go-server/supabase/backup_assignments.go` (NEW)

**Functions to Implement:**
```go
// CreateBackupAssignment - Insert new backup assignment
func (c *Client) CreateBackupAssignment(ctx context.Context, assignment BackupAssignment) error

// UpdateBackupAssignment - Update existing assignment
func (c *Client) UpdateBackupAssignment(ctx context.Context, assignment BackupAssignment) error

// DeleteBackupAssignment - Soft delete (set is_active = false)
func (c *Client) DeleteBackupAssignment(ctx context.Context, assignmentID string) error

// HardDeleteBackupAssignment - Permanent delete
func (c *Client) HardDeleteBackupAssignment(ctx context.Context, assignmentID string) error

// GetBackupAssignments - Fetch all active assignments for restaurant/version
func (c *Client) GetBackupAssignments(ctx context.Context, restaurantID, versionID string) ([]BackupAssignment, error)
```

**Data Structure:**
```go
type BackupAssignment struct {
    ID             string    `json:"id"`
    RestaurantID   string    `json:"restaurant_id"`
    VersionID      string    `json:"version_id"`
    StaffID        string    `json:"staff_id"`
    GroupID        string    `json:"group_id"`
    AssignmentType string    `json:"assignment_type"`
    PriorityOrder  int       `json:"priority_order"`
    EffectiveFrom  *string   `json:"effective_from"`
    EffectiveUntil *string   `json:"effective_until"`
    IsActive       bool      `json:"is_active"`
    Notes          string    `json:"notes"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
}
```

#### Step 1.2: Add WebSocket Message Handlers (1-2 hours)

**File**: `go-server/handlers/settings.go`

**Message Types to Add:**
```go
const (
    BACKUP_ASSIGNMENT_CREATE = "BACKUP_ASSIGNMENT_CREATE"
    BACKUP_ASSIGNMENT_UPDATE = "BACKUP_ASSIGNMENT_UPDATE"
    BACKUP_ASSIGNMENT_DELETE = "BACKUP_ASSIGNMENT_DELETE"
)
```

**Handler Implementation:**
```go
case BACKUP_ASSIGNMENT_CREATE:
    assignment := parseBackupAssignment(payload)
    err := supabaseClient.CreateBackupAssignment(ctx, assignment)
    // Broadcast to all clients
    broadcastBackupAssignmentUpdate(assignment)

case BACKUP_ASSIGNMENT_UPDATE:
    assignment := parseBackupAssignment(payload)
    err := supabaseClient.UpdateBackupAssignment(ctx, assignment)
    broadcastBackupAssignmentUpdate(assignment)

case BACKUP_ASSIGNMENT_DELETE:
    assignmentID := payload["assignmentId"]
    err := supabaseClient.DeleteBackupAssignment(ctx, assignmentID)
    broadcastBackupAssignmentDelete(assignmentID)
```

#### Step 1.3: Add React WebSocket Methods (1 hour)

**File**: `src/hooks/useWebSocketSettings.js`

**Add to Hook Return:**
```javascript
const {
  // ... existing methods ...

  // NEW: Backup assignment methods
  wsCreateBackupAssignment,
  wsUpdateBackupAssignment,
  wsDeleteBackupAssignment,
  wsHardDeleteBackupAssignment,
} = useWebSocketSettings();
```

**Method Implementations:**
```javascript
const wsCreateBackupAssignment = useCallback((assignment) => {
  if (!isConnected) return;

  sendMessage({
    type: 'BACKUP_ASSIGNMENT_CREATE',
    payload: {
      id: assignment.id,
      staffId: assignment.staffId,
      groupId: assignment.groupId,
      assignmentType: assignment.assignmentType || 'regular',
      priorityOrder: assignment.priorityOrder || 1,
      notes: assignment.notes || '',
      isActive: true,
    },
  });
}, [isConnected, sendMessage]);

// Similar for Update and Delete...
```

#### Step 1.4: Add Change Detection in useSettingsData (1-2 hours)

**File**: `src/hooks/useSettingsData.js` (add after line 697)

**Add Backup Assignment Detection:**
```javascript
// Detect and update backup assignments
if (
  JSON.stringify(oldSettings.backupAssignments) !==
  JSON.stringify(newSettings.backupAssignments)
) {
  console.log("  - Detecting backup_assignments table changes...");

  const oldAssignments = oldSettings?.backupAssignments ?? [];
  const newAssignments = newSettings?.backupAssignments ?? [];

  const oldAssignmentIds = new Set(oldAssignments.map((a) => a.id));
  const newAssignmentIds = new Set(newAssignments.map((a) => a.id));

  // Detect CREATED assignments
  const createdAssignments = newAssignments.filter(
    (a) => !oldAssignmentIds.has(a.id)
  );
  if (createdAssignments.length > 0) {
    console.log(`    - ${createdAssignments.length} new assignment(s) created`);
    createdAssignments.forEach((assignment) => {
      console.log(`      - Creating assignment "${assignment.id}"`);
      callbacks.wsCreateBackupAssignment(assignment);
    });
  }

  // Detect DELETED assignments
  const deletedAssignmentIds = [...oldAssignmentIds].filter(
    (id) => !newAssignmentIds.has(id)
  );
  if (deletedAssignmentIds.length > 0) {
    console.log(`    - ${deletedAssignmentIds.length} assignment(s) deleted`);
    deletedAssignmentIds.forEach((id) => {
      console.log(`      - Deleting assignment "${id}"`);
      callbacks.wsDeleteBackupAssignment(id);
    });
  }

  // Detect UPDATED assignments
  const updatedAssignments = newAssignments.filter((newAssignment) => {
    if (!oldAssignmentIds.has(newAssignment.id)) return false;
    const oldAssignment = oldAssignments.find((a) => a.id === newAssignment.id);
    return JSON.stringify(oldAssignment) !== JSON.stringify(newAssignment);
  });
  if (updatedAssignments.length > 0) {
    console.log(`    - ${updatedAssignments.length} assignment(s) updated`);
    updatedAssignments.forEach((assignment) => {
      console.log(`      - Updating assignment "${assignment.id}"`);
      callbacks.wsUpdateBackupAssignment(assignment);
    });
  }
}
```

**Add to WebSocket Sync (line 172-180):**
```javascript
const aggregatedSettings = {
  staffGroups: normalizedStaffGroups,
  weeklyLimits: wsSettings?.weeklyLimits ?? [],
  monthlyLimits: wsSettings?.monthlyLimits ?? [],
  dailyLimits: wsSettings?.dailyLimits ?? { maxOffPerDay: 3, maxEarlyPerDay: 2, maxLatePerDay: 3 },
  priorityRules: wsSettings?.priorityRules ?? [],
  backupAssignments: wsSettings?.backupAssignments ?? [], // NEW
  mlParameters: wsSettings?.mlModelConfigs?.[0] ?? {},
  version: wsVersion,
};
```

---

### Phase 2: AI Scheduler Integration (HIGH PRIORITY)

**Priority**: 🟡 HIGH
**Time**: 2-3 hours
**Goal**: Enable automatic backup coverage when group members are off

#### Step 2.1: Load Backup Assignments in AI (30 min)

**File**: `src/ai/core/ScheduleGenerator.js`

**Add to Constructor or Initialization:**
```javascript
class ScheduleGenerator {
  constructor(staffMembers, dateRange, settings, backupAssignments = []) {
    this.staffMembers = staffMembers;
    this.dateRange = dateRange;
    this.settings = settings;
    this.backupAssignments = backupAssignments; // NEW

    // Initialize backup staff service
    this.backupStaffService = new BackupStaffService();
    this.backupStaffService.initialize(
      staffMembers,
      settings.staffGroups,
      backupAssignments // Pass loaded assignments
    );
  }
}
```

**Update Calls to ScheduleGenerator:**
```javascript
// Where schedule generator is instantiated
const generator = new ScheduleGenerator(
  staffMembers,
  dateRange,
  settings,
  settings.backupAssignments // NEW: Pass backup assignments
);
```

#### Step 2.2: Apply Backup Logic During Generation (1 hour)

**File**: `src/ai/core/ScheduleGenerator.js`

**Option A: Post-Processing (Recommended)**
```javascript
async generateSchedule() {
  // 1. Generate initial schedule using AI algorithms
  let schedule = await this.runGeneticAlgorithm();

  // 2. Apply backup coverage
  console.log("🔄 Applying backup coverage...");
  schedule = this.backupStaffService.processBackupAssignments(
    schedule,
    this.staffMembers,
    this.settings.staffGroups,
    this.dateRange
  );

  // 3. Validate constraints (including backup coverage)
  const validation = await this.validateSchedule(schedule);

  return schedule;
}
```

**Option B: Integration During Generation**
```javascript
canAssignShift(schedule, staff, dateKey, shift) {
  // Existing constraint checks...

  // NEW: Check if staff is a backup for a group where member is off
  const isBackupNeeded = this.backupStaffService.isBackupNeeded(
    schedule,
    staff,
    dateKey
  );

  if (isBackupNeeded && shift !== "○") {
    return false; // Force backup staff to normal shift
  }

  return true;
}
```

#### Step 2.3: Add Validation Step (30 min)

**File**: `src/ai/core/ScheduleGenerator.js`

**Add to Validation Pipeline:**
```javascript
async validateSchedule(schedule) {
  const violations = [];

  // Existing validations...

  // NEW: Validate backup coverage
  for (const dateKey of this.dateRange.map(d => d.toISOString().split('T')[0])) {
    const coverageViolations = await validateCoverageCompensation(
      schedule,
      dateKey,
      this.staffMembers,
      this.backupAssignments
    );
    violations.push(...coverageViolations);
  }

  return violations;
}
```

#### Step 2.4: Update AI Hook (30 min)

**File**: `src/hooks/useAIAssistant.js`

**Ensure Backup Assignments Are Passed:**
```javascript
const handleGenerateSchedule = async () => {
  const result = await generateSchedule({
    staffMembers,
    dateRange,
    settings,
    backupAssignments: settings.backupAssignments, // NEW
    // ... other params
  });
};
```

---

## 🧪 Testing Strategy

### Unit Tests

**File**: `go-server/supabase/backup_assignments_test.go` (NEW)
```go
func TestCreateBackupAssignment(t *testing.T) {
    assignment := BackupAssignment{
        ID: "test-id",
        StaffID: "staff-123",
        GroupID: "group-456",
    }
    err := client.CreateBackupAssignment(ctx, assignment)
    assert.NoError(t, err)
}

// Similar for Update, Delete, Get...
```

### Integration Tests

**Test Flow:**
1. ✅ Create backup assignment via UI
2. ✅ Verify WebSocket message sent
3. ✅ Verify database write
4. ✅ Refresh page
5. ✅ Verify assignment still visible
6. ✅ Generate AI schedule
7. ✅ Verify backup coverage applied

### E2E Tests (Chrome MCP)

```javascript
// Test: Backup assignment persistence
1. Open Settings → Staff Groups tab
2. Add backup assignment: 中田 → キッチングループ
3. Verify success toast
4. Hard refresh page (Ctrl+Shift+R)
5. Open Settings → Staff Groups tab
6. Verify assignment still exists ✅

// Test: AI backup coverage
1. Set 佐藤 (キッチン) to × on specific date
2. Generate AI schedule
3. Verify 中田 assigned to ○ on same date ✅
```

---

## 📊 Success Criteria

### Phase 1 Complete When:
- ✅ Backup assignments saved to `staff_backup_assignments` table
- ✅ WebSocket sync working (create/update/delete)
- ✅ Assignments survive page refresh
- ✅ Settings sync across browser tabs
- ✅ No console errors

### Phase 2 Complete When:
- ✅ AI scheduler loads backup assignments
- ✅ When group member has × → backup staff gets ○
- ✅ Coverage validation passes
- ✅ No scheduling conflicts
- ✅ Business logic working as expected

---

## 🚨 Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database table doesn't exist in prod | High | Medium | Run migration first, verify schema |
| WebSocket message conflicts | Medium | Low | Use unique message types |
| AI integration breaks existing logic | High | Low | Comprehensive testing, feature flag |
| Performance degradation | Medium | Low | Profile before/after, optimize queries |
| Backward compatibility | Medium | Low | Support both old/new formats during transition |

---

## 📝 Implementation Checklist

### Phase 1: Database Persistence
- [ ] 1.1: Create `go-server/supabase/backup_assignments.go`
- [ ] 1.2: Add WebSocket handlers in `go-server/handlers/settings.go`
- [ ] 1.3: Add React WebSocket methods in `useWebSocketSettings.js`
- [ ] 1.4: Add change detection in `useSettingsData.js`
- [ ] 1.5: Update ConfigurationService sync
- [ ] 1.6: Test create/update/delete flow
- [ ] 1.7: Test page refresh persistence

### Phase 2: AI Integration
- [ ] 2.1: Update ScheduleGenerator to accept backupAssignments
- [ ] 2.2: Initialize BackupStaffService with assignments
- [ ] 2.3: Apply backup logic (post-processing or inline)
- [ ] 2.4: Add coverage validation step
- [ ] 2.5: Update AI hooks to pass assignments
- [ ] 2.6: Test AI generation with backups
- [ ] 2.7: Verify business logic works correctly

### Documentation
- [ ] Update CLAUDE.md with backup architecture
- [ ] Document backup assignment data structure
- [ ] Add user guide for backup management
- [ ] Update AI_ARCHITECTURE_INDEX.md

### Deployment
- [ ] Run database migration in production
- [ ] Deploy Go server changes
- [ ] Deploy React app changes
- [ ] Monitor for errors
- [ ] Verify existing data migrates correctly

---

## 🔄 Migration Path

### For Existing Users (localStorage → Database)

**One-time Migration:**
```javascript
// ConfigurationService.js - Add migration v5
5: (settings) => {
  console.log("Running migration v5: Migrate backup assignments to database");

  const backupAssignments = settings.backupAssignments || [];

  if (backupAssignments.length > 0 && useWebSocket) {
    console.log(`Migrating ${backupAssignments.length} backup assignments to database...`);

    // Send to WebSocket for database persistence
    backupAssignments.forEach(assignment => {
      wsCreateBackupAssignment(assignment);
    });

    console.log("✅ Migration v5 complete: Backup assignments sent to database");
  }

  return settings;
}
```

---

## 💡 Future Enhancements (Post-Implementation)

### Optional Features
1. **Multi-Backup Priority**:
   - Support multiple backup staff per group
   - Use `priority_order` field to determine assignment order

2. **Time-Based Backups**:
   - Use `effective_from` and `effective_until` for seasonal backups
   - Auto-expire backup assignments

3. **Backup Coverage Dashboard**:
   - Show coverage statistics
   - Alert when groups have no backup

4. **Smart Backup Suggestions**:
   - AI recommends part-time staff for backup based on availability
   - Auto-detect coverage gaps

---

## 📚 References

### Related Files
- `src/services/BackupStaffService.js` - Core logic
- `src/hooks/useBackupStaffService.js` - React hook
- `src/components/settings/tabs/StaffGroupsTab.jsx` - UI
- `src/ai/constraints/ConstraintEngine.js` - Validation
- `database/add-missing-tables.sql` - Schema

### Related Documentation
- `CLAUDE.md` - Project guidelines
- `AI_ARCHITECTURE_INDEX.md` - AI system architecture
- `STAFF-GROUPS-FIX-SUMMARY.md` - Similar WebSocket implementation

### Database Schema
```sql
-- staff_backup_assignments table
CREATE TABLE staff_backup_assignments (
    id UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    version_id UUID NOT NULL,
    staff_id UUID NOT NULL,
    group_id UUID NOT NULL,
    assignment_type VARCHAR(50) DEFAULT 'regular',
    priority_order INTEGER DEFAULT 1,
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## ✅ Approval Required

**This plan requires user approval before implementation.**

**Questions for User:**
1. ✅ Approve Phase 1 (Database Persistence)?
2. ✅ Approve Phase 2 (AI Integration)?
3. ❓ Any specific business rules to add?
4. ❓ Priority order - implement both phases together or Phase 1 first?

**Recommended Approach**: Implement **Phase 1 first** (fix data loss), test thoroughly, then **Phase 2** (AI integration).

---

**Status**: 🟡 AWAITING USER APPROVAL

Once approved, estimated completion: **6-9 hours** total work time.
