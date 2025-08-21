/**
 * Integration tests for Backup Staff database functionality
 * 
 * Tests the full integration between ConfigurationService and BackupStaffService
 * including localStorage migration and database synchronization.
 */

// Mock Supabase for testing
jest.mock('../../utils/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: [{ id: 'test-id' }], error: null }),
      delete: () => ({ data: [], error: null }),
      eq: () => ({ data: [], error: null }),
      limit: () => ({ data: [], error: null }),
    }),
  },
}));

import { configService } from '../ConfigurationService';
import { BackupStaffService } from '../BackupStaffService';

describe('Backup Staff Database Integration', () => {
  let backupStaffService;
  
  beforeEach(() => {
    backupStaffService = new BackupStaffService();
    // Clear localStorage
    localStorage.clear();
    // Reset config service settings
    configService.settings = configService.getDefaultSettings();
  });

  afterEach(() => {
    backupStaffService.cleanup();
  });

  describe('ConfigurationService Backup Assignment Methods', () => {
    test('getBackupAssignments returns default empty array', () => {
      const assignments = configService.getBackupAssignments();
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments).toHaveLength(0);
    });

    test('updateBackupAssignments saves to settings', async () => {
      const testAssignments = [
        {
          id: 'test-1',
          staffId: 'staff-1',
          groupId: 'group-1',
          assignmentType: 'regular',
          priorityOrder: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      const success = await configService.updateBackupAssignments(testAssignments);
      expect(success).toBe(true);

      const savedAssignments = configService.getBackupAssignments();
      expect(savedAssignments).toHaveLength(1);
      expect(savedAssignments[0]).toMatchObject(testAssignments[0]);
    });
  });

  describe('BackupStaffService Integration Methods', () => {
    test('loadBackupAssignments loads from ConfigurationService', async () => {
      // Set up some assignments in ConfigurationService
      const testAssignments = [
        {
          id: 'test-1',
          staffId: 'staff-1',
          groupId: 'group-1',
          assignmentType: 'regular',
          priorityOrder: 1,
          createdAt: new Date().toISOString(),
        },
      ];
      await configService.updateBackupAssignments(testAssignments);

      // Load via BackupStaffService
      const loadedAssignments = await backupStaffService.loadBackupAssignments();
      expect(loadedAssignments).toHaveLength(1);
      expect(loadedAssignments[0]).toMatchObject(testAssignments[0]);
    });

    test('saveBackupAssignments saves via ConfigurationService', async () => {
      const testAssignments = [
        {
          id: 'test-1',
          staffId: 'staff-1',
          groupId: 'group-1',
          assignmentType: 'regular',
          priorityOrder: 1,
          createdAt: new Date().toISOString(),
        },
      ];

      const success = await backupStaffService.saveBackupAssignments(testAssignments);
      expect(success).toBe(true);

      // Verify it was saved in ConfigurationService
      const savedAssignments = configService.getBackupAssignments();
      expect(savedAssignments).toHaveLength(1);
      expect(savedAssignments[0]).toMatchObject(testAssignments[0]);
    });

    test('addBackupAssignment creates new assignment', async () => {
      const success = await backupStaffService.addBackupAssignment('staff-1', 'group-1', {
        assignmentType: 'regular',
        priorityOrder: 1,
      });
      expect(success).toBe(true);

      const assignments = configService.getBackupAssignments();
      expect(assignments).toHaveLength(1);
      expect(assignments[0].staffId).toBe('staff-1');
      expect(assignments[0].groupId).toBe('group-1');
      expect(assignments[0].assignmentType).toBe('regular');
    });

    test('removeBackupAssignment removes assignment by staffId and groupId', async () => {
      // First add an assignment
      await backupStaffService.addBackupAssignment('staff-1', 'group-1');
      let assignments = configService.getBackupAssignments();
      expect(assignments).toHaveLength(1);

      // Then remove it
      const success = await backupStaffService.removeBackupAssignment('staff-1', 'group-1');
      expect(success).toBe(true);

      assignments = configService.getBackupAssignments();
      expect(assignments).toHaveLength(0);
    });

    test('initializeWithConfiguration loads assignments automatically', async () => {
      // Set up some assignments in ConfigurationService
      const testAssignments = [
        {
          id: 'test-1',
          staffId: 'staff-1',
          groupId: 'group-1',
          assignmentType: 'regular',
          priorityOrder: 1,
          createdAt: new Date().toISOString(),
        },
      ];
      await configService.updateBackupAssignments(testAssignments);

      const staffMembers = [{ id: 'staff-1', name: 'Staff 1' }];
      const staffGroups = [{ id: 'group-1', name: 'Group 1', members: [] }];

      const success = await backupStaffService.initializeWithConfiguration(
        staffMembers,
        staffGroups
      );
      expect(success).toBe(true);
      expect(backupStaffService.initialized).toBe(true);

      // Check that backup assignments were loaded
      expect(backupStaffService.backupAssignments.size).toBe(1);
      expect(backupStaffService.groupBackups.size).toBe(1);
    });
  });

  describe('localStorage Migration', () => {
    test('migrateFromLocalStorage migrates legacy data', async () => {
      // Set up legacy data in localStorage
      const legacyData = [
        {
          id: 'legacy-1',
          staffId: 'staff-1',
          groupId: 'group-1',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      localStorage.setItem('backup-staff-assignments', JSON.stringify(legacyData));

      // Trigger migration
      const migratedAssignments = await backupStaffService.migrateFromLocalStorage();
      expect(migratedAssignments).toHaveLength(1);
      expect(migratedAssignments[0].staffId).toBe('staff-1');
      expect(migratedAssignments[0].assignmentType).toBe('regular'); // Default value

      // Verify legacy data was removed
      expect(localStorage.getItem('backup-staff-assignments')).toBeNull();

      // Verify data was saved to ConfigurationService
      const savedAssignments = configService.getBackupAssignments();
      expect(savedAssignments).toHaveLength(1);
    });

    test('loadBackupAssignments triggers migration when no data in ConfigurationService', async () => {
      // Set up legacy data
      const legacyData = [
        {
          id: 'legacy-1',
          staffId: 'staff-1',
          groupId: 'group-1',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      localStorage.setItem('backup-staff-assignments', JSON.stringify(legacyData));

      // Load assignments (should trigger migration)
      const loadedAssignments = await backupStaffService.loadBackupAssignments();
      expect(loadedAssignments).toHaveLength(1);
      expect(loadedAssignments[0].staffId).toBe('staff-1');

      // Verify migration occurred
      expect(localStorage.getItem('backup-staff-assignments')).toBeNull();
      const configAssignments = configService.getBackupAssignments();
      expect(configAssignments).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('handles invalid localStorage data gracefully', async () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('backup-staff-assignments', 'invalid-json');

      const migratedAssignments = await backupStaffService.migrateFromLocalStorage();
      expect(migratedAssignments).toHaveLength(0);
    });

    test('handles empty assignments gracefully', async () => {
      const success = await backupStaffService.saveBackupAssignments([]);
      expect(success).toBe(true);

      const assignments = await backupStaffService.loadBackupAssignments();
      expect(assignments).toHaveLength(0);
    });

    test('handles duplicate assignment prevention', async () => {
      // Add first assignment
      const success1 = await backupStaffService.addBackupAssignment('staff-1', 'group-1');
      expect(success1).toBe(true);

      // Try to add duplicate
      const success2 = await backupStaffService.addBackupAssignment('staff-1', 'group-1');
      expect(success2).toBe(false);

      // Should still only have one assignment
      const assignments = configService.getBackupAssignments();
      expect(assignments).toHaveLength(1);
    });
  });

  describe('Data Consistency', () => {
    test('internal maps stay in sync with saved data', async () => {
      const staffMembers = [
        { id: 'staff-1', name: 'Staff 1' },
        { id: 'staff-2', name: 'Staff 2' },
      ];
      const staffGroups = [
        { id: 'group-1', name: 'Group 1', members: [] },
        { id: 'group-2', name: 'Group 2', members: [] },
      ];
      
      // Initialize service
      await backupStaffService.initialize(staffMembers, staffGroups, []);

      // Add assignments via service methods
      await backupStaffService.addBackupAssignment('staff-1', 'group-1');
      await backupStaffService.addBackupAssignment('staff-2', 'group-1');
      await backupStaffService.addBackupAssignment('staff-1', 'group-2');

      // Check internal maps
      expect(backupStaffService.getStaffBackupAssignments('staff-1')).toHaveLength(2);
      expect(backupStaffService.getGroupBackupStaff('group-1')).toHaveLength(2);
      expect(backupStaffService.isBackupStaff('staff-1')).toBe(true);
      expect(backupStaffService.isBackupStaff('staff-3')).toBe(false);

      // Check ConfigurationService data
      const savedAssignments = configService.getBackupAssignments();
      expect(savedAssignments).toHaveLength(3);
    });
  });
});