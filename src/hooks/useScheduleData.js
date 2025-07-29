import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { generateDateRange } from '../utils/dateUtils';
import { initializeSchedule, migrateScheduleData, migrateStaffMembers } from '../utils/staffUtils';
import { defaultStaffMembersArray } from '../constants/staffConstants';
import { 
  optimizedStorage, 
  migrationUtils, 
  performanceMonitor,
  batchWriter,
  STORAGE_KEYS
} from '../utils/storageUtils';

// Backward compatibility: keep old functions for gradual migration
const loadFromLocalStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
};

export const useScheduleData = (
  currentMonthIndex,
  supabaseScheduleData,
  currentScheduleId,
  setCurrentScheduleId,
  onSaveSchedule
) => {
  // Migration state
  const [migrationCompleted, setMigrationCompleted] = useState(false);
  
  // Schedule states - initialize with optimized storage
  const [schedule, setSchedule] = useState(() => {
    // Check if migration is needed on first load
    if (migrationUtils.hasLegacyData() && !migrationCompleted) {
      const result = migrationUtils.migrateLegacyData();
      if (process.env.NODE_ENV === 'development') {
      }
    }
    
    // Use optimized storage to get existing schedule
    const existingSchedule = optimizedStorage.getScheduleData(currentMonthIndex);
    
    const initial = initializeSchedule(defaultStaffMembersArray, generateDateRange(currentMonthIndex), existingSchedule);
    return initial;
  });
  const [schedulesByMonth, setSchedulesByMonth] = useState({});
  const [staffMembersByMonth, setStaffMembersByMonth] = useState({});
  
  // Auto-save refs
  const autoSaveTimeoutRef = useRef(null);
  
  // Generate date range for current month
  const dateRange = useMemo(() => {
    const range = generateDateRange(currentMonthIndex);
    return range;
  }, [currentMonthIndex]);

  // Load data when component mounts - handle migration if needed
  useEffect(() => {
    const performInitialLoad = async () => {
      // Check for legacy data and migrate if needed
      if (migrationUtils.hasLegacyData() && !migrationCompleted) {
        if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Performing data migration...');
      }
        const migrationResult = migrationUtils.migrateLegacyData();
        
        // Verify migration
        const verification = migrationUtils.verifyMigration();
        if (verification.success) {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Migration successful');
          }
          migrationUtils.cleanupLegacyData();
          setMigrationCompleted(true);
        } else {
          console.warn('⚠️ Migration verification failed:', verification.errors);
        }
      }
      
      // Load current period data using optimized storage
      const currentSchedule = optimizedStorage.getScheduleData(currentMonthIndex);
      const currentStaff = optimizedStorage.getStaffData(currentMonthIndex);
      
      // Set initial current period data
      optimizedStorage.saveCurrentPeriod(currentMonthIndex);
      
      // Log performance metrics (development mode only)
      performanceMonitor.logSummary();
    };
    
    performInitialLoad();
  }, [currentMonthIndex, migrationCompleted]);

  // Clear optimized storage when database is explicitly deleted
  const [hasExplicitlyDeletedData, setHasExplicitlyDeletedData] = useState(false);
  
  useEffect(() => {
    if (supabaseScheduleData === null && hasExplicitlyDeletedData) {
      console.log('🗑️ Clearing all storage due to explicit data deletion');
      
      // Clear optimized storage for all periods (0-5)
      for (let i = 0; i < 6; i++) {
        optimizedStorage.clearPeriodData(i);
      }
      
      // Also clean up any remaining legacy data
      migrationUtils.cleanupLegacyData();
      
      // Force flush any pending writes
      batchWriter.flushWrites();
      
      // Reset to default state
      setSchedulesByMonth({});
      setStaffMembersByMonth({});
      setSchedule(initializeSchedule(defaultStaffMembersArray, generateDateRange(currentMonthIndex)));
      
      // Reset the flag
      setHasExplicitlyDeletedData(false);
    }
  }, [supabaseScheduleData, currentMonthIndex, hasExplicitlyDeletedData]);

  // Handle month switching - prioritize optimized storage over database
  useEffect(() => {
    // Priority 1: Check optimized storage first (memory cache + localStorage)
    const localSchedule = optimizedStorage.getScheduleData(currentMonthIndex);
    const localStaff = optimizedStorage.getStaffData(currentMonthIndex);
    
    // Update current period tracking
    optimizedStorage.saveCurrentPeriod(currentMonthIndex);
    
    if (localSchedule && Object.keys(localSchedule).length > 0) {
      setSchedule(localSchedule);
      // Development mode only: log load success
      if (process.env.NODE_ENV === 'development') {
      }
      return;
    }
    
    // Priority 2: Fallback to database data if no localStorage data
    if (supabaseScheduleData && supabaseScheduleData.schedule_data) {
      const { _staff_members, ...actualScheduleData } = supabaseScheduleData.schedule_data;
      
      // First, migrate the staff members from database
      const migratedStaffMembers = _staff_members ? migrateStaffMembers(_staff_members) : [];
      
      // Then migrate the schedule data to use UUIDs
      const migratedScheduleData = migrateScheduleData(actualScheduleData, migratedStaffMembers);
      
      // Always use database data if it exists and we have no localStorage data
      if (migratedStaffMembers.length > 0 || Object.keys(migratedScheduleData).length > 0) {
        // Check if database data has dates that match current month range
        const currentDateRange = generateDateRange(currentMonthIndex);
        const hasMatchingDates = currentDateRange.some(date => {
          const dateKey = date.toISOString().split('T')[0];
          return Object.keys(migratedScheduleData).some(staffId => 
            migratedScheduleData[staffId] && migratedScheduleData[staffId][dateKey] !== undefined
          );
        });
        
        if (hasMatchingDates) {
          setSchedule(migratedScheduleData);
        } else {
          setSchedule(initializeSchedule(migratedStaffMembers.length > 0 ? migratedStaffMembers : defaultStaffMembersArray, currentDateRange));
        }
      }
    } else {
      // Priority 3: Initialize with default data for new periods
      // Try to find the most recent period with data
      let mostRecentStaff = null;
      for (let i = 5; i >= 0; i--) {
        if (i !== currentMonthIndex) {
          const periodStaff = optimizedStorage.getStaffData(i);
          if (periodStaff && Array.isArray(periodStaff) && periodStaff.length > 0) {
            mostRecentStaff = periodStaff;
            break;
          }
        }
      }
      
      if (mostRecentStaff) {
        // Initialize schedule for current period with existing staff
        const newSchedule = initializeSchedule(mostRecentStaff, generateDateRange(currentMonthIndex));
        setSchedule(newSchedule);
        
        // Save staff for current period using optimized storage
        optimizedStorage.saveStaffData(currentMonthIndex, mostRecentStaff);
        
        // Set staff for current period
        setStaffMembersByMonth(prev => ({
          ...prev,
          [currentMonthIndex]: mostRecentStaff
        }));
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`📋 Initialized period ${currentMonthIndex} with staff from previous period`);
        }
      } else {
        const newSchedule = initializeSchedule(defaultStaffMembersArray, generateDateRange(currentMonthIndex));
        setSchedule(newSchedule);
        if (process.env.NODE_ENV === 'development') {
          console.log(`📋 Initialized period ${currentMonthIndex} with default staff`);
        }
      }
    }
  }, [currentMonthIndex, supabaseScheduleData]);

  // Update schedule ID when supabase data changes
  useEffect(() => {
    if (supabaseScheduleData?.id && currentScheduleId !== supabaseScheduleData.id) {
      setCurrentScheduleId(supabaseScheduleData.id);
    }
  }, [supabaseScheduleData?.id, supabaseScheduleData?.updated_at, currentMonthIndex, currentScheduleId, setCurrentScheduleId]);

  // Use useRef to store current month index to avoid dependencies
  const currentMonthRef = useRef(currentMonthIndex);
  currentMonthRef.current = currentMonthIndex;

  // Auto-save function with optimized storage and debouncing
  const scheduleAutoSave = useCallback((newScheduleData, newStaffMembers = null) => {
    // Clear existing timer
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Save to optimized storage (uses memory cache + debounced writes)
    optimizedStorage.saveScheduleData(currentMonthRef.current, newScheduleData);
    
    if (newStaffMembers) {
      optimizedStorage.saveStaffData(currentMonthRef.current, newStaffMembers);
    }

    // Set debounced auto-save timer (2 seconds)
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (onSaveSchedule && typeof onSaveSchedule === 'function') {
        try {
          // Get current staff members - prioritize passed staff, then optimized storage, then extract from schedule
          let currentMonthStaff = newStaffMembers || [];
          
          if (currentMonthStaff.length === 0) {
            // Try optimized storage
            currentMonthStaff = optimizedStorage.getStaffData(currentMonthRef.current) || [];
          }
          
          if (currentMonthStaff.length === 0 && Object.keys(newScheduleData).length > 0) {
            // Try to extract staff IDs from schedule data keys
            const staffIds = Object.keys(newScheduleData);
            
            // Create minimal staff objects for saving
            currentMonthStaff = staffIds.map(staffId => ({
              id: staffId,
              name: `Staff-${staffId.slice(-4)}`, // Use last 4 chars of ID as name
              position: 'Unknown',
              status: '社員'
            }));
            
            // Save to optimized storage for future use
            optimizedStorage.saveStaffData(currentMonthRef.current, currentMonthStaff);
          }
          
          // Filter schedule data to only include currently active staff
          const activeStaffIds = (newStaffMembers || currentMonthStaff).map(staff => staff.id);
          const filteredScheduleData = {};
          
          // Only include schedule data for active staff members
          activeStaffIds.forEach(staffId => {
            if (newScheduleData[staffId]) {
              filteredScheduleData[staffId] = newScheduleData[staffId];
            }
          });
          
          // Also filter by current date range to remove old dates
          const currentDateRange = generateDateRange(currentMonthRef.current);
          const validDateKeys = currentDateRange.map(date => date.toISOString().split('T')[0]);
          
          // Clean up dates that are outside current period
          const dateFilteredScheduleData = {};
          activeStaffIds.forEach(staffId => {
            if (filteredScheduleData[staffId]) {
              dateFilteredScheduleData[staffId] = {};
              validDateKeys.forEach(dateKey => {
                if (filteredScheduleData[staffId][dateKey] !== undefined) {
                  dateFilteredScheduleData[staffId][dateKey] = filteredScheduleData[staffId][dateKey];
                }
              });
            }
          });
          
          // Prepare data in the format expected by the database
          const saveData = {
            ...dateFilteredScheduleData,
            _staff_members: newStaffMembers || currentMonthStaff
          };
          
          // Prevent saving empty data that would overwrite good database records
          const finalStaffForSave = newStaffMembers || currentMonthStaff;
          if (finalStaffForSave.length === 0) {
            return;
          }
          
          await onSaveSchedule(saveData);
        } catch (error) {
          console.error('❌ Failed to save to database:', error);
        }
      }
    }, 2000);
  }, [onSaveSchedule, supabaseScheduleData]); // Include dependencies

  // Update schedule with auto-save
  const updateSchedule = useCallback((newSchedule, staffForSave = null) => {
    // Skip filtering if this is an initialization call (just pass through the schedule as-is)
    if (Object.keys(newSchedule).length > 0) {
      // Use flushSync to force immediate synchronous update
      // This ensures bulk operations update all selected cells immediately
      flushSync(() => {
        setSchedule(newSchedule);
      });
      
      // Pass staff members to auto-save if available
      let staffToSave = staffForSave;
      if (!staffToSave && supabaseScheduleData?.schedule_data?._staff_members) {
        staffToSave = migrateStaffMembers(supabaseScheduleData.schedule_data._staff_members);
      }
      
      scheduleAutoSave(newSchedule, staffToSave);
      return;
    }
    
    // Only apply filtering for empty schedules or when explicitly needed
    // Get current active staff for filtering from optimized storage
    const currentMonthStaff = optimizedStorage.getStaffData(currentMonthRef.current) || [];
    const activeStaffIds = currentMonthStaff.map(staff => staff.id);
    
    // Filter schedule to only include active staff
    const filteredSchedule = {};
    activeStaffIds.forEach(staffId => {
      if (newSchedule[staffId]) {
        filteredSchedule[staffId] = newSchedule[staffId];
      }
    });
    
    setSchedule(filteredSchedule);
    
    // Auto-save (this will handle localStorage updates)
    scheduleAutoSave(filteredSchedule);
  }, [scheduleAutoSave, supabaseScheduleData]);

  // Update shift for specific staff and date
  const updateShift = useCallback((staffId, dateKey, shiftValue) => {
    const newSchedule = {
      ...schedule,
      [staffId]: {
        ...schedule[staffId],
        [dateKey]: shiftValue
      }
    };
    updateSchedule(newSchedule);
  }, [schedule, updateSchedule]);

  // Manual sync function to transfer localStorage data to database
  const syncLocalStorageToDatabase = useCallback(async () => {
    if (!onSaveSchedule || typeof onSaveSchedule !== 'function') {
      return;
    }

    try {
      // Get data from optimized storage
      const currentScheduleData = optimizedStorage.getScheduleData(currentMonthIndex);
      const currentStaffData = optimizedStorage.getStaffData(currentMonthIndex);

      if (!currentScheduleData || !currentStaffData || currentStaffData.length === 0) {
        return;
      }

      // Filter schedule data to only include current date range
      const currentDateRange = generateDateRange(currentMonthIndex);
      const validDateKeys = currentDateRange.map(date => date.toISOString().split('T')[0]);
      
      // Clean up dates that are outside current period
      const dateFilteredScheduleData = {};
      currentStaffData.forEach(staff => {
        if (currentScheduleData[staff.id]) {
          dateFilteredScheduleData[staff.id] = {};
          validDateKeys.forEach(dateKey => {
            if (currentScheduleData[staff.id][dateKey] !== undefined) {
              dateFilteredScheduleData[staff.id][dateKey] = currentScheduleData[staff.id][dateKey];
            }
          });
        }
      });

      // Prepare data for database
      const saveData = {
        ...dateFilteredScheduleData,
        _staff_members: currentStaffData
      };

      // Save to database
      await onSaveSchedule(saveData);
      
    } catch (error) {
      console.error('❌ MANUAL SYNC: Failed to transfer data:', error);
    }
  }, [onSaveSchedule, currentMonthIndex]);

  return {
    schedule,
    schedulesByMonth,
    staffMembersByMonth,
    dateRange,
    setSchedule,
    setSchedulesByMonth,
    setStaffMembersByMonth,
    updateSchedule,
    updateShift,
    scheduleAutoSave,
    setHasExplicitlyDeletedData,
    syncLocalStorageToDatabase
  };
};