# Backup Staff Management System - Integration Guide

## Overview

The Backup Staff Management System provides automatic assignment of backup staff when group members have day offs, ensuring continuous coverage and operational efficiency. This system integrates seamlessly with the existing scheduling and constraint validation systems.

## Key Components

### 1. BackupStaffService (`/src/services/BackupStaffService.js`)

The core service that handles:

- **Backup Detection**: Automatically identifies when group members have day offs
- **Assignment Logic**: Assigns backup staff to normal shifts when coverage is needed
- **Validation**: Ensures backup assignments are applied correctly
- **Performance Optimization**: Caches results and provides metrics

#### Key Methods:

```javascript
// Initialize the service
await backupService.initialize(staffMembers, staffGroups, backupAssignments);

// Process backup assignments for a date
const updatedSchedule = backupService.processBackupAssignments(
  schedule,
  staffMembers,
  staffGroups,
  dateKey,
);

// Validate backup coverage
const validation = backupService.validateBackupAssignments(
  schedule,
  staffMembers,
  staffGroups,
  dateRange,
);

// Get backup status for a specific date
const status = backupService.getBackupStatus(
  schedule,
  staffMembers,
  staffGroups,
  dateKey,
);
```

### 2. Enhanced Constraint Engine (`/src/ai/constraints/ConstraintEngine.js`)

Updated to include backup staff validation:

#### New Functions:

```javascript
// Enhanced coverage compensation validation
export const validateCoverageCompensation = async(
  scheduleData,
  dateKey,
  staffMembers,
  (backupAssignments = []),
);

// Validates both legacy Group 2 rules and general backup assignments
export const validateAllConstraints = async(
  scheduleData,
  staffMembers,
  dateRange,
  (backupAssignments = []),
);
```

#### Validation Features:

- **Legacy Support**: Maintains backward compatibility with existing Group 2 coverage rules
- **General Backup Validation**: Validates backup assignments for all groups
- **Comprehensive Reporting**: Provides detailed violation reports with recommendations

### 3. Schedule Generator Integration (`/src/ai/core/ScheduleGenerator.js`)

Enhanced to automatically apply backup staff assignments:

#### Integration Points:

```javascript
// Initialize with backup assignments
await scheduleGenerator.initialize({
  staffMembers,
  staffGroups,
  backupAssignments,
});

// Automatic backup processing in all generation strategies
const finalSchedule = await this.applyBackupStaffAssignments(
  workingSchedule,
  staffMembers,
  dateRange,
);
```

#### Generation Strategies:

- **Priority First**: Applies priority rules, then backup assignments
- **Balance First**: Balances workload, then ensures backup coverage
- **Pattern Based**: Follows patterns, then applies backup logic

### 4. React Hook (`/src/hooks/useBackupStaffService.js`)

Provides React integration for components:

```javascript
const {
  isInitialized,
  processBackupAssignments,
  validateBackupAssignments,
  getBackupStatusForDate,
  processAutomaticBackups,
} = useBackupStaffService(staffMembers, onScheduleUpdate);
```

## Business Logic

### Backup Assignment Rules

1. **Trigger Condition**: A group member has a day off (× symbol)
2. **Backup Selection**: Find backup staff assigned to that group
3. **Availability Check**: Ensure backup staff is available (not already assigned to work)
4. **Assignment**: Assign backup staff to normal shift (○ symbol)

### Priority Order

1. **Existing Assignments**: Preserve manually set assignments
2. **Priority Rules**: Apply high-priority staff assignments
3. **Backup Coverage**: Assign backup staff when group members are off
4. **Balance Optimization**: Distribute workload evenly

### Constraint Integration

The backup system integrates with existing constraints:

- **Daily Limits**: Backup assignments respect maximum staff limits
- **Group Conflicts**: Prevents backup staff from creating new conflicts
- **Monthly Limits**: Considers monthly off-day allocations
- **Priority Rules**: Works alongside existing priority assignments

## Configuration

### Staff Groups Configuration

```javascript
const staffGroups = [
  {
    id: "group-1",
    name: "Kitchen Team",
    members: ["chef-1", "chef-2"], // Staff IDs
    // ... other group properties
  },
];
```

### Backup Assignments Configuration

```javascript
const backupAssignments = [
  {
    id: "backup-1",
    staffId: "backup-chef-1", // Backup staff member ID
    groupId: "group-1", // Group to backup
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];
```

### Settings Integration

The system integrates with the existing settings system:

```javascript
// In settings
{
  staffGroups: [...],
  backupAssignments: [...],
  // ... other settings
}
```

## Usage Examples

### 1. Basic Backup Assignment

```javascript
// Setup
const backupService = new BackupStaffService();
await backupService.initialize(staffMembers, staffGroups, backupAssignments);

// Schedule with group member off
const schedule = {
  "chef-1": { "2024-01-01": "×" }, // Day off
  "backup-chef-1": { "2024-01-01": "" }, // Available
};

// Process backup assignments
const updatedSchedule = backupService.processBackupAssignments(
  schedule,
  staffMembers,
  staffGroups,
  "2024-01-01",
);

// Result: backup-chef-1 assigned to work (○)
console.log(updatedSchedule["backup-chef-1"]["2024-01-01"]); // '○'
```

### 2. Schedule Generation with Backup Logic

```javascript
// Initialize generator with backup support
const generator = new ScheduleGenerator();
await generator.initialize({
  staffMembers,
  staffGroups,
  backupAssignments,
});

// Generate schedule (automatically includes backup assignments)
const result = await generator.generateSchedule({
  staffMembers,
  dateRange,
  strategy: "priority_first",
});

// Schedule includes backup coverage
console.log(result.schedule);
```

### 3. React Component Integration

```javascript
function ScheduleEditor() {
  const { processAutomaticBackups, getBackupStatusForDate } =
    useBackupStaffService(staffMembers, onScheduleUpdate);

  const handleShiftChange = async (staffId, dateKey, newShift) => {
    // Update schedule
    const updatedSchedule = { ...schedule };
    updatedSchedule[staffId][dateKey] = newShift;

    // Process automatic backup assignments
    const finalSchedule = await processAutomaticBackups(
      updatedSchedule,
      dateKey,
      staffId,
    );

    setSchedule(finalSchedule);
  };

  const getDateStatus = (dateKey) => {
    return getBackupStatusForDate(schedule, dateKey);
  };
}
```

## Validation and Error Handling

### Backup Coverage Validation

```javascript
const validation = await backupService.validateBackupAssignments(
  schedule,
  staffMembers,
  staffGroups,
  dateRange,
);

if (!validation.valid) {
  validation.violations.forEach((violation) => {
    console.warn(`Backup issue: ${violation.message}`);

    if (violation.type === "backup_coverage_missing") {
      // Handle missing coverage
      const { groupName, groupMembersOff, backupStaffAvailable } =
        violation.details;
      console.log(
        `Group ${groupName} needs backup for ${groupMembersOff.join(", ")}`,
      );
      console.log(`Available backups: ${backupStaffAvailable.join(", ")}`);
    }
  });
}
```

### Coverage Statistics

```javascript
const validation = await backupService.validateBackupAssignments(/*...*/);

// Overall statistics
console.log(
  `Coverage rate: ${validation.statistics.averageCoverageRate * 100}%`,
);

// Per-group coverage
Object.entries(validation.coverage).forEach(([groupId, coverage]) => {
  console.log(
    `${coverage.groupName}: ${coverage.daysCovered}/${coverage.totalDaysNeeded} days covered`,
  );
});
```

## Performance Considerations

### Caching

The service implements intelligent caching:

```javascript
// Results are cached automatically
const result1 = backupService.processBackupAssignments(/*...*/);
const result2 = backupService.processBackupAssignments(/*...*/); // Uses cache

// Clear cache when needed
backupService.clearCache();
```

### Metrics

Monitor performance with built-in metrics:

```javascript
const status = backupService.getStatus();
console.log(
  `Processed ${status.performanceMetrics.assignmentsProcessed} assignments`,
);
console.log(`Cache hit rate: ${status.performanceMetrics.cacheHitRate}%`);
```

## Testing

Comprehensive test coverage includes:

- **Unit Tests**: Individual service methods
- **Integration Tests**: End-to-end backup assignment flows
- **Edge Cases**: Error handling and boundary conditions
- **Performance Tests**: Caching and optimization

Run tests:

```bash
npm test BackupStaffService.test.js
```

## Migration Guide

### From Legacy System

The backup system maintains compatibility with existing Group 2 coverage rules:

```javascript
// Legacy: Group 2 specific rule
const group2 = {
  name: "Group 2",
  members: ["料理長", "古藤"],
  coverageRule: {
    backupStaff: "中田",
    requiredShift: "normal",
  },
};

// New: General backup assignment
const backupAssignments = [
  {
    id: "backup-1",
    staffId: "staff-nakata", // 中田
    groupId: "group-2", // Group 2
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];
```

### Gradual Adoption

1. **Phase 1**: Deploy backup service alongside existing system
2. **Phase 2**: Configure backup assignments for critical groups
3. **Phase 3**: Enable automatic backup processing in schedule generation
4. **Phase 4**: Migrate from legacy coverage rules to general backup system

## Troubleshooting

### Common Issues

1. **Backup not assigned**: Check if backup staff is available
2. **Performance slow**: Review cache configuration and clear if needed
3. **Validation errors**: Verify staff groups and backup assignments are correctly configured
4. **Integration issues**: Ensure all components are initialized with same data

### Debug Mode

Enable detailed logging:

```javascript
// Set in development
process.env.NODE_ENV = "development";

// Service will log detailed information
const result = backupService.processBackupAssignments(/*...*/);
```

## Future Enhancements

Planned improvements:

1. **Dynamic Backup Selection**: AI-powered backup staff selection based on skills and preferences
2. **Predictive Coverage**: Forecast backup needs based on historical patterns
3. **Real-time Notifications**: Alert managers when backup coverage is needed
4. **Advanced Metrics**: Detailed analytics on backup utilization and effectiveness
5. **Multi-level Backup**: Support for primary and secondary backup assignments

## API Reference

For detailed API documentation, see the inline JSDoc comments in:

- `/src/services/BackupStaffService.js`
- `/src/hooks/useBackupStaffService.js`
- `/src/ai/constraints/ConstraintEngine.js`

## Support

For issues or questions regarding the backup staff system:

1. Check the test files for usage examples
2. Review constraint validation outputs for detailed error information
3. Monitor service status and performance metrics
4. Consult the existing business rule documentation for context
