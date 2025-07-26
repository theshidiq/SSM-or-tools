import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { generateDateRange } from '../utils/dateUtils';
import { initializeSchedule, migrateScheduleData, migrateStaffMembers } from '../utils/staffUtils';
import { defaultStaffMembersArray } from '../constants/staffConstants';

const STORAGE_KEYS = {
  SCHEDULE: 'shift-schedule-data',
  STAFF_BY_MONTH: 'staff-by-month-data',
  CURRENT_MONTH: 'current-month-index'
};

// Local storage utilities
const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

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
  // Schedule states
  const [schedule, setSchedule] = useState(() => 
    initializeSchedule(defaultStaffMembersArray, generateDateRange(currentMonthIndex))
  );
  const [schedulesByMonth, setSchedulesByMonth] = useState({});
  const [staffMembersByMonth, setStaffMembersByMonth] = useState({});
  
  // Auto-save refs
  const autoSaveTimeoutRef = useRef(null);
  
  // Generate date range for current month
  const dateRange = useMemo(() => generateDateRange(currentMonthIndex), [currentMonthIndex]);

  // Load data when component mounts
  useEffect(() => {
    const savedSchedules = loadFromLocalStorage(STORAGE_KEYS.SCHEDULE);
    const savedStaffByMonth = loadFromLocalStorage(STORAGE_KEYS.STAFF_BY_MONTH);
    
    if (savedSchedules) {
      setSchedulesByMonth(savedSchedules);
    }
    
    if (savedStaffByMonth) {
      setStaffMembersByMonth(savedStaffByMonth);
    }
  }, []);

  // Clear localStorage when database is explicitly deleted (not just null)
  const [hasExplicitlyDeletedData, setHasExplicitlyDeletedData] = useState(false);
  
  useEffect(() => {
    if (supabaseScheduleData === null && hasExplicitlyDeletedData) {
      // Database is empty due to explicit deletion, clear localStorage to sync
      console.log('CLEARING: Database explicitly deleted, clearing localStorage cache...');
      localStorage.removeItem(STORAGE_KEYS.SCHEDULE);
      localStorage.removeItem(STORAGE_KEYS.STAFF_BY_MONTH);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_MONTH);
      
      // Also remove old localStorage keys that might exist from previous versions
      localStorage.removeItem('shift_schedules_by_month');
      localStorage.removeItem('shift_staff_by_month'); 
      localStorage.removeItem('shift_schedule_data');
      localStorage.removeItem('shift_staff_members');
      
      // Reset to default state
      setSchedulesByMonth({});
      setStaffMembersByMonth({});
      setSchedule(initializeSchedule(defaultStaffMembersArray, generateDateRange(currentMonthIndex)));
      
      // Reset the flag
      setHasExplicitlyDeletedData(false);
    }
  }, [supabaseScheduleData, currentMonthIndex, hasExplicitlyDeletedData]);

  // Handle month switching - separate effects to avoid circular dependencies
  useEffect(() => {
    // Load schedule for new month
    const savedSchedules = loadFromLocalStorage(STORAGE_KEYS.SCHEDULE) || {};
    const savedSchedule = savedSchedules[currentMonthIndex];
    
    if (savedSchedule) {
      setSchedule(savedSchedule);
    } else {
      // Check if we have database data that matches current month dates
      if (supabaseScheduleData && supabaseScheduleData.schedule_data) {
        const { _staff_members, ...actualScheduleData } = supabaseScheduleData.schedule_data;
        
        // First, migrate the staff members from database
        const migratedStaffMembers = _staff_members ? migrateStaffMembers(_staff_members) : defaultStaffMembersArray;
        
        // Then migrate the schedule data to use UUIDs
        const migratedScheduleData = migrateScheduleData(actualScheduleData, migratedStaffMembers);
        
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
          setSchedule(initializeSchedule(migratedStaffMembers, currentDateRange));
        }
      } else {
        setSchedule(initializeSchedule(defaultStaffMembersArray, generateDateRange(currentMonthIndex)));
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

  // Auto-save function with debouncing - no dependencies to prevent re-creation
  const scheduleAutoSave = useCallback((newScheduleData, newStaffMembers = null) => {
    // Clear existing timer
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Use refs to get current values without dependencies
    const currentSchedulesByMonth = loadFromLocalStorage(STORAGE_KEYS.SCHEDULE) || {};
    const currentStaffByMonth = loadFromLocalStorage(STORAGE_KEYS.STAFF_BY_MONTH) || {};

    // Immediately save to localStorage as backup
    saveToLocalStorage(STORAGE_KEYS.SCHEDULE, {
      ...currentSchedulesByMonth,
      [currentMonthRef.current]: newScheduleData
    });

    if (newStaffMembers) {
      saveToLocalStorage(STORAGE_KEYS.STAFF_BY_MONTH, {
        ...currentStaffByMonth,
        [currentMonthRef.current]: newStaffMembers
      });
    }

    // Set debounced auto-save timer (2 seconds)
    autoSaveTimeoutRef.current = setTimeout(async () => {
      
      if (onSaveSchedule && typeof onSaveSchedule === 'function') {
        try {
          // Get current staff members for this month
          const currentStaffByMonth = loadFromLocalStorage(STORAGE_KEYS.STAFF_BY_MONTH) || {};
          const currentMonthStaff = currentStaffByMonth[currentMonthRef.current] || [];
          
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
          
          await onSaveSchedule(saveData);
        } catch (error) {
          console.error('❌ Failed to save to database:', error);
        }
      } else {
        console.warn('⚠️ onSaveSchedule function not available');
      }
    }, 2000);
  }, [onSaveSchedule]); // Include onSaveSchedule dependency

  // Update schedule with auto-save
  const updateSchedule = useCallback((newSchedule) => {
    // Get current active staff for filtering
    const currentStaffByMonth = loadFromLocalStorage(STORAGE_KEYS.STAFF_BY_MONTH) || {};
    const currentMonthStaff = currentStaffByMonth[currentMonthRef.current] || [];
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
  }, [scheduleAutoSave]);

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
    setHasExplicitlyDeletedData
  };
};