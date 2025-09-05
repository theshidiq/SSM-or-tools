/**
 * Phase 4: Staff Data Migration Utilities
 * Migrates localStorage staff data to Supabase app_staff table
 */

import { supabase } from './supabase';

// Storage keys used for staff data in localStorage
const STAFF_STORAGE_KEYS = {
  // Period-based staff keys (0-5 for 6 periods)
  getStaffKey: (period) => `staff-${period}`,
  getOptimizedStaffKey: (period) => `optimized_staff_${period}`,
  // Legacy keys
  LEGACY_STAFF: 'staffMembers',
  STAFF_MEMBERS: 'staff_members',
};

/**
 * Check if there's existing staff data in localStorage that needs migration
 */
export const hasLocalStorageStaffData = () => {
  try {
    const staffKeys = [];
    
    // Check for period-based staff data (0-5)
    for (let period = 0; period < 6; period++) {
      const staffKey = STAFF_STORAGE_KEYS.getStaffKey(period);
      const optimizedStaffKey = STAFF_STORAGE_KEYS.getOptimizedStaffKey(period);
      
      if (localStorage.getItem(staffKey) || localStorage.getItem(optimizedStaffKey)) {
        staffKeys.push(`Period ${period}`);
      }
    }
    
    // Check for legacy staff data
    if (localStorage.getItem(STAFF_STORAGE_KEYS.LEGACY_STAFF) || 
        localStorage.getItem(STAFF_STORAGE_KEYS.STAFF_MEMBERS)) {
      staffKeys.push('Legacy');
    }
    
    // Check for additional patterns from inject-schedule.js
    for (let period = 0; period < 6; period++) {
      if (localStorage.getItem(`staff_members_${period}`)) {
        staffKeys.push(`Injected Period ${period}`);
      }
    }
    
    return {
      hasData: staffKeys.length > 0,
      foundKeys: staffKeys,
      count: staffKeys.length
    };
  } catch (error) {
    console.warn('Error checking localStorage staff data:', error);
    return { hasData: false, foundKeys: [], count: 0 };
  }
};

/**
 * Extract all staff data from localStorage for migration
 */
export const extractLocalStorageStaffData = () => {
  try {
    const extractedData = {
      periodBased: {},
      legacy: null,
      injected: {},
      metadata: {
        extractedAt: new Date().toISOString(),
        source: 'localStorage-staff-migration'
      }
    };
    
    // Extract period-based staff data (0-5)
    for (let period = 0; period < 6; period++) {
      const staffKey = STAFF_STORAGE_KEYS.getStaffKey(period);
      const optimizedStaffKey = STAFF_STORAGE_KEYS.getOptimizedStaffKey(period);
      
      const staffData = localStorage.getItem(staffKey);
      const optimizedStaffData = localStorage.getItem(optimizedStaffKey);
      
      if (staffData || optimizedStaffData) {
        // Prefer optimized data if available
        const rawData = optimizedStaffData || staffData;
        try {
          const parsedData = JSON.parse(rawData);
          extractedData.periodBased[period] = {
            data: parsedData,
            source: optimizedStaffData ? 'optimized' : 'regular',
            storageKey: optimizedStaffData ? optimizedStaffKey : staffKey
          };
        } catch (parseError) {
          console.warn(`Failed to parse staff data for period ${period}:`, parseError);
        }
      }
      
      // Check for injected data pattern
      const injectedData = localStorage.getItem(`staff_members_${period}`);
      if (injectedData) {
        try {
          extractedData.injected[period] = JSON.parse(injectedData);
        } catch (parseError) {
          console.warn(`Failed to parse injected staff data for period ${period}:`, parseError);
        }
      }
    }
    
    // Extract legacy staff data
    const legacyStaff = localStorage.getItem(STAFF_STORAGE_KEYS.LEGACY_STAFF);
    const staffMembers = localStorage.getItem(STAFF_STORAGE_KEYS.STAFF_MEMBERS);
    
    if (legacyStaff || staffMembers) {
      try {
        const legacyData = legacyStaff || staffMembers;
        extractedData.legacy = {
          data: JSON.parse(legacyData),
          source: legacyStaff ? 'legacy' : 'staff_members',
          storageKey: legacyStaff ? STAFF_STORAGE_KEYS.LEGACY_STAFF : STAFF_STORAGE_KEYS.STAFF_MEMBERS
        };
      } catch (parseError) {
        console.warn('Failed to parse legacy staff data:', parseError);
      }
    }
    
    return extractedData;
  } catch (error) {
    console.error('Error extracting localStorage staff data:', error);
    return null;
  }
};

/**
 * Transform localStorage staff data format to database format
 */
export const transformStaffDataForDatabase = (localStaffData) => {
  if (!localStaffData || (!Array.isArray(localStaffData) && typeof localStaffData !== 'object')) {
    return [];
  }
  
  // Handle array format (most common)
  if (Array.isArray(localStaffData)) {
    return localStaffData.map((staff, index) => transformStaffMember(staff, index));
  }
  
  // Handle object format (some legacy cases)
  if (typeof localStaffData === 'object') {
    return Object.values(localStaffData).map((staff, index) => transformStaffMember(staff, index));
  }
  
  return [];
};

/**
 * Transform a single staff member from localStorage format to database format
 */
const transformStaffMember = (staff, index) => {
  if (!staff || typeof staff !== 'object') {
    return null;
  }
  
  // Generate ID if not present
  const id = staff.id || staff.staffId || `migrated-${Date.now()}-${index}`;
  
  // Transform date periods
  const transformPeriod = (period) => {
    if (!period) return null;
    if (typeof period === 'object') {
      return {
        year: period.year || new Date().getFullYear(),
        month: period.month || 1,
        day: period.day || 1
      };
    }
    return null;
  };
  
  return {
    id: id,
    name: staff.name || staff.staffName || `Staff ${index + 1}`,
    position: staff.position || '',
    department: staff.department || null,
    type: staff.type || null, // 'regular' or 'part-time'
    status: staff.status || '社員', // Default to '社員' (regular employee)
    color: staff.color || 'position-server',
    staff_order: typeof staff.staff_order !== 'undefined' ? staff.staff_order : 
                 typeof staff.order !== 'undefined' ? staff.order : index,
    start_period: transformPeriod(staff.startPeriod || staff.start_period),
    end_period: transformPeriod(staff.endPeriod || staff.end_period),
    metadata: {
      migrated_from: 'localStorage',
      migrated_at: new Date().toISOString(),
      original_data: staff // Keep original for debugging
    }
  };
};

/**
 * Check for duplicate staff members in database
 */
export const checkForDuplicateStaff = async (staffToMigrate) => {
  if (!Array.isArray(staffToMigrate)) {
    return { duplicates: [], unique: [] };
  }
  
  try {
    // Get existing staff from database
    const { data: existingStaff, error } = await supabase
      .from('app_staff')
      .select('id, name, position');
    
    if (error) {
      console.error('Error checking for duplicates:', error);
      return { duplicates: [], unique: staffToMigrate };
    }
    
    const duplicates = [];
    const unique = [];
    
    staffToMigrate.forEach(staff => {
      const isDuplicate = existingStaff.some(existing => 
        existing.name === staff.name && 
        existing.position === staff.position
      );
      
      if (isDuplicate) {
        duplicates.push(staff);
      } else {
        unique.push(staff);
      }
    });
    
    return { duplicates, unique };
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { duplicates: [], unique: staffToMigrate };
  }
};

/**
 * Migrate staff data to database using bulk import
 */
export const migrateStaffToDatabase = async (staffData, options = {}) => {
  const { 
    skipDuplicates = true, 
    updateDuplicates = false,
    dryRun = false 
  } = options;
  
  if (!Array.isArray(staffData) || staffData.length === 0) {
    return {
      success: false,
      message: 'No valid staff data to migrate',
      migrated: 0,
      duplicates: 0,
      errors: []
    };
  }
  
  try {
    // Filter out null/invalid entries
    const validStaff = staffData.filter(staff => staff !== null && staff.name);
    
    if (validStaff.length === 0) {
      return {
        success: false,
        message: 'No valid staff members found after filtering',
        migrated: 0,
        duplicates: 0,
        errors: []
      };
    }
    
    // Check for duplicates if requested
    let staffToMigrate = validStaff;
    let duplicateInfo = { duplicates: [], unique: validStaff };
    
    if (skipDuplicates || updateDuplicates) {
      duplicateInfo = await checkForDuplicateStaff(validStaff);
      staffToMigrate = updateDuplicates ? validStaff : duplicateInfo.unique;
    }
    
    if (dryRun) {
      return {
        success: true,
        message: 'Dry run completed successfully',
        migrated: staffToMigrate.length,
        duplicates: duplicateInfo.duplicates.length,
        errors: [],
        dryRun: true,
        preview: staffToMigrate
      };
    }
    
    // Perform the migration
    const errors = [];
    let migrated = 0;
    
    // Use batch insertion for better performance
    const batchSize = 10;
    for (let i = 0; i < staffToMigrate.length; i += batchSize) {
      const batch = staffToMigrate.slice(i, i + batchSize);
      
      try {
        const { error } = await supabase
          .from('app_staff')
          .upsert(batch, { onConflict: updateDuplicates ? 'id' : undefined });
        
        if (error) {
          errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        } else {
          migrated += batch.length;
        }
      } catch (batchError) {
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${batchError.message}`);
      }
    }
    
    const success = migrated > 0;
    return {
      success,
      message: success ? 
        `Successfully migrated ${migrated} staff members` : 
        'Migration failed - no staff members were migrated',
      migrated,
      duplicates: duplicateInfo.duplicates.length,
      errors,
      totalAttempted: staffToMigrate.length
    };
    
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      migrated: 0,
      duplicates: 0,
      errors: [error.message]
    };
  }
};

/**
 * Create backup of localStorage staff data before migration
 */
export const backupLocalStorageStaffData = () => {
  try {
    const timestamp = new Date().toISOString();
    const backupData = extractLocalStorageStaffData();
    
    if (!backupData) {
      return { success: false, message: 'No data to backup' };
    }
    
    // Check if there's actually any data to backup
    const hasActualData = Object.keys(backupData.periodBased).length > 0 || 
                          Object.keys(backupData.injected).length > 0 || 
                          backupData.legacy !== null;
    
    if (!hasActualData) {
      return { success: false, message: 'No data to backup' };
    }
    
    const backupKey = `staff_migration_backup_${timestamp}`;
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    
    console.log(`📦 Created staff backup: ${backupKey}`);
    return { 
      success: true, 
      backupKey, 
      message: `Backup created: ${backupKey}` 
    };
  } catch (error) {
    console.error('Staff backup creation failed:', error);
    return { 
      success: false, 
      message: `Backup failed: ${error.message}` 
    };
  }
};

/**
 * Clean up localStorage staff data after successful migration
 */
export const cleanupLocalStorageStaffData = (keepBackup = true) => {
  try {
    const keysToRemove = [];
    
    // Collect all staff-related keys
    for (let period = 0; period < 6; period++) {
      const keys = [
        STAFF_STORAGE_KEYS.getStaffKey(period),
        STAFF_STORAGE_KEYS.getOptimizedStaffKey(period),
        `staff_members_${period}`
      ];
      
      keys.forEach(key => {
        if (localStorage.getItem(key)) {
          keysToRemove.push(key);
        }
      });
    }
    
    // Add legacy keys
    const legacyKeys = [
      STAFF_STORAGE_KEYS.LEGACY_STAFF,
      STAFF_STORAGE_KEYS.STAFF_MEMBERS
    ];
    
    legacyKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        keysToRemove.push(key);
      }
    });
    
    // Remove the keys (but preserve backup keys if requested)
    keysToRemove.forEach(key => {
      if (!keepBackup || !key.includes('backup')) {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed localStorage key: ${key}`);
      }
    });
    
    return { 
      success: true, 
      removedKeys: keysToRemove,
      message: `Cleaned up ${keysToRemove.length} localStorage keys` 
    };
  } catch (error) {
    console.error('Cleanup error:', error);
    return { 
      success: false, 
      message: `Cleanup failed: ${error.message}` 
    };
  }
};

/**
 * Complete staff migration workflow
 */
export const performStaffMigration = async (options = {}) => {
  const { 
    skipDuplicates = true,
    updateDuplicates = false,
    dryRun = false,
    createBackup = true,
    cleanup = true
  } = options;
  
  console.log('🚀 Starting Phase 4 staff migration...');
  
  try {
    // Step 1: Check if migration is needed
    const localStorageCheck = hasLocalStorageStaffData();
    if (!localStorageCheck.hasData) {
      return { 
        success: true, 
        message: 'No staff migration needed - no localStorage data found',
        skipped: true 
      };
    }
    
    console.log(`📊 Found staff data in localStorage: ${localStorageCheck.foundKeys.join(', ')}`);
    
    // Step 2: Create backup if requested
    let backupResult = null;
    if (createBackup) {
      backupResult = backupLocalStorageStaffData();
      if (!backupResult.success) {
        return { 
          success: false, 
          message: `Backup failed: ${backupResult.message}` 
        };
      }
    }
    
    // Step 3: Extract data
    const extractedData = extractLocalStorageStaffData();
    if (!extractedData) {
      return { 
        success: false, 
        message: 'Failed to extract staff data from localStorage' 
      };
    }
    
    // Step 4: Transform and combine all staff data
    let allStaffToMigrate = [];
    
    // Process period-based data
    Object.entries(extractedData.periodBased).forEach(([period, periodData]) => {
      const transformedStaff = transformStaffDataForDatabase(periodData.data);
      allStaffToMigrate = allStaffToMigrate.concat(transformedStaff);
    });
    
    // Process injected data
    Object.entries(extractedData.injected).forEach(([period, injectedData]) => {
      const transformedStaff = transformStaffDataForDatabase(injectedData);
      allStaffToMigrate = allStaffToMigrate.concat(transformedStaff);
    });
    
    // Process legacy data
    if (extractedData.legacy) {
      const transformedStaff = transformStaffDataForDatabase(extractedData.legacy.data);
      allStaffToMigrate = allStaffToMigrate.concat(transformedStaff);
    }
    
    // Remove duplicates within the migration data itself
    const uniqueStaff = [];
    const seenNames = new Set();
    allStaffToMigrate.forEach(staff => {
      const key = `${staff.name}-${staff.position}`;
      if (!seenNames.has(key)) {
        seenNames.add(key);
        uniqueStaff.push(staff);
      }
    });
    
    if (uniqueStaff.length === 0) {
      return { 
        success: false, 
        message: 'No valid staff data found to migrate' 
      };
    }
    
    console.log(`📝 Prepared ${uniqueStaff.length} unique staff members for migration`);
    
    // Step 5: Migrate to database
    const migrationResult = await migrateStaffToDatabase(uniqueStaff, {
      skipDuplicates,
      updateDuplicates,
      dryRun
    });
    
    if (!migrationResult.success && !dryRun) {
      return {
        ...migrationResult,
        backupKey: backupResult?.backupKey
      };
    }
    
    // Step 6: Clean up localStorage if migration was successful and not a dry run
    let cleanupResult = null;
    if (cleanup && migrationResult.success && !dryRun) {
      cleanupResult = cleanupLocalStorageStaffData(true);
    }
    
    console.log('✅ Staff migration completed successfully');
    
    return {
      ...migrationResult,
      backupKey: backupResult?.backupKey,
      cleanupResult,
      extractedFrom: localStorageCheck.foundKeys,
      totalExtracted: allStaffToMigrate.length,
      uniqueProcessed: uniqueStaff.length
    };
    
  } catch (error) {
    console.error('Staff migration error:', error);
    return {
      success: false,
      message: `Staff migration failed: ${error.message}`,
      error: error.message
    };
  }
};

/**
 * Restore staff data from backup (for rollback)
 */
export const restoreStaffFromBackup = (backupKey) => {
  try {
    const backupData = localStorage.getItem(backupKey);
    if (!backupData) {
      return { success: false, message: 'Backup not found' };
    }
    
    const backup = JSON.parse(backupData);
    let restoredCount = 0;
    
    // Restore period-based data
    Object.entries(backup.periodBased || {}).forEach(([period, periodData]) => {
      localStorage.setItem(periodData.storageKey, JSON.stringify(periodData.data));
      restoredCount++;
    });
    
    // Restore injected data
    Object.entries(backup.injected || {}).forEach(([period, injectedData]) => {
      localStorage.setItem(`staff_members_${period}`, JSON.stringify(injectedData));
      restoredCount++;
    });
    
    // Restore legacy data
    if (backup.legacy) {
      localStorage.setItem(backup.legacy.storageKey, JSON.stringify(backup.legacy.data));
      restoredCount++;
    }
    
    console.log(`🔄 Restored ${restoredCount} staff data entries from backup: ${backupKey}`);
    return { 
      success: true, 
      restoredCount,
      message: `Restored ${restoredCount} entries from ${backupKey}` 
    };
  } catch (error) {
    console.error('Staff restore error:', error);
    return { 
      success: false, 
      message: `Restore failed: ${error.message}` 
    };
  }
};