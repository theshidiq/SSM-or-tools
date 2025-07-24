import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { generateDateRange } from '../utils/dateUtils';
import { initializeSchedule } from '../utils/staffUtils';
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
  setCurrentScheduleId
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

  // Handle month switching
  useEffect(() => {
    // Save current month data before switching
    if (schedule && Object.keys(schedule).length > 0) {
      const currentMonthKey = currentMonthIndex.toString();
      setSchedulesByMonth(prev => {
        const updated = {
          ...prev,
          [currentMonthKey]: schedule
        };
        saveToLocalStorage(STORAGE_KEYS.SCHEDULE, updated);
        return updated;
      });
    }
    
    // Load schedule for new month
    const savedSchedule = schedulesByMonth[currentMonthIndex];
    
    if (savedSchedule) {
      setSchedule(savedSchedule);
    } else {
      // Check if we have database data that matches current month dates
      if (supabaseScheduleData && supabaseScheduleData.schedule_data) {
        const { _staff_members, ...actualScheduleData } = supabaseScheduleData.schedule_data;
        
        // Check if database data has dates that match current month range
        const currentDateRange = generateDateRange(currentMonthIndex);
        const hasMatchingDates = currentDateRange.some(date => {
          const dateKey = date.toISOString().split('T')[0];
          return Object.keys(actualScheduleData).some(staffId => 
            actualScheduleData[staffId] && actualScheduleData[staffId][dateKey]
          );
        });
        
        if (hasMatchingDates) {
          setSchedule(actualScheduleData);
        } else {
          setSchedule(initializeSchedule(defaultStaffMembersArray, currentDateRange));
        }
      } else {
        setSchedule(initializeSchedule(defaultStaffMembersArray, generateDateRange(currentMonthIndex)));
      }
    }
  }, [currentMonthIndex, schedulesByMonth, supabaseScheduleData]);

  // Update schedule ID when supabase data changes
  useEffect(() => {
    if (supabaseScheduleData?.id && currentScheduleId !== supabaseScheduleData.id) {
      setCurrentScheduleId(supabaseScheduleData.id);
    }
  }, [supabaseScheduleData?.id, supabaseScheduleData?.updated_at, currentMonthIndex, currentScheduleId, setCurrentScheduleId]);

  // Auto-save function with debouncing
  const scheduleAutoSave = useCallback((newScheduleData, newStaffMembers = null) => {
    // Clear existing timer
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Immediately save to localStorage as backup
    saveToLocalStorage(STORAGE_KEYS.SCHEDULE, {
      ...schedulesByMonth,
      [currentMonthIndex]: newScheduleData
    });

    if (newStaffMembers) {
      saveToLocalStorage(STORAGE_KEYS.STAFF_BY_MONTH, {
        ...staffMembersByMonth,
        [currentMonthIndex]: newStaffMembers
      });
    }

    // Set debounced auto-save timer (2 seconds)
    autoSaveTimeoutRef.current = setTimeout(() => {
      // This would integrate with your existing save mechanism
      console.log('Auto-saving to database...', newScheduleData);
    }, 2000);
  }, [schedulesByMonth, staffMembersByMonth, currentMonthIndex]);

  // Update schedule with auto-save
  const updateSchedule = useCallback((newSchedule) => {
    setSchedule(newSchedule);
    
    // Update cached schedule for current month
    setSchedulesByMonth(prev => ({
      ...prev,
      [currentMonthIndex]: newSchedule
    }));
    
    // Auto-save
    scheduleAutoSave(newSchedule);
  }, [currentMonthIndex, scheduleAutoSave]);

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
    scheduleAutoSave
  };
};