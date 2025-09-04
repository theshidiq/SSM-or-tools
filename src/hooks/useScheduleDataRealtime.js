import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { generateDateRange, monthPeriods } from "../utils/dateUtils";
import {
  initializeSchedule,
  migrateScheduleData,
  migrateStaffMembers,
} from "../utils/staffUtils";
import { defaultStaffMembersArray } from "../constants/staffConstants";
import { useSupabaseRealtime, QUERY_KEYS } from "./useSupabaseRealtime";
import { dataValidation } from "../utils/dataIntegrityUtils";

export const useScheduleDataRealtime = (
  currentMonthIndex,
  initialScheduleId = null,
  totalPeriods = 0
) => {
  const queryClient = useQueryClient();
  
  // Use the new Supabase real-time hook
  const {
    isConnected,
    isLoading: isSupabaseLoading,
    error: supabaseError,
    scheduleData: supabaseScheduleData,
    currentScheduleId,
    setCurrentScheduleId,
    saveSchedule,
    saveScheduleAsync,
    isSupabaseSaving,
    autoSave: supabaseAutoSave,
  } = useSupabaseRealtime(initialScheduleId);

  // Local state for immediate UI updates
  const [schedule, setSchedule] = useState(() => {
    // Initialize with empty schedule structure - will be populated when periods load
    return initializeSchedule(
      defaultStaffMembersArray,
      [] // Start with empty date range, will be updated when periods load
    );
  });
  
  const [staffMembersByMonth, setStaffMembersByMonth] = useState({});
  const [migrationCompleted, setMigrationCompleted] = useState(false);

  // Auto-save refs for debouncing
  const autoSaveTimeoutRef = useRef(null);
  const currentMonthRef = useRef(currentMonthIndex);
  currentMonthRef.current = currentMonthIndex;

  // Helper function to safely generate date ranges
  const safeGenerateDateRange = (monthIndex) => {
    try {
      if (monthPeriods && monthPeriods.length > 0) {
        return generateDateRange(monthIndex);
      }
      return []; // Return empty array while periods are loading
    } catch (error) {
      return []; // Return empty array if periods not ready
    }
  };

  // Generate date range for current month - only when periods are available
  const dateRange = useMemo(() => {
    return safeGenerateDateRange(currentMonthIndex);
  }, [currentMonthIndex]);

  // Mutation for optimistic schedule updates
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ newSchedule, staffForSave }) => {
      // Prepare data for saving
      const currentMonthStaff = staffForSave || staffMembersByMonth[currentMonthIndex] || [];
      
      // Filter schedule data to only include current date range and active staff
      const currentDateRange = generateDateRange(currentMonthIndex);
      const validDateKeys = currentDateRange.map(
        (date) => date.toISOString().split("T")[0]
      );
      
      const activeStaffIds = currentMonthStaff.map((staff) => staff.id);
      const filteredScheduleData = {};
      
      activeStaffIds.forEach((staffId) => {
        if (newSchedule[staffId]) {
          filteredScheduleData[staffId] = {};
          validDateKeys.forEach((dateKey) => {
            if (newSchedule[staffId][dateKey] !== undefined) {
              filteredScheduleData[staffId][dateKey] = newSchedule[staffId][dateKey];
            }
          });
        }
      });

      // Prepare save data
      const saveData = {
        ...filteredScheduleData,
        _staff_members: currentMonthStaff,
      };

      // Save to Supabase
      await saveScheduleAsync({ data: saveData, scheduleId: currentScheduleId });
      
      return { newSchedule, staffForSave };
    },
    onMutate: async ({ newSchedule, staffForSave }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: QUERY_KEYS.schedule(currentScheduleId) 
      });

      // Snapshot the previous value for rollback
      const previousSchedule = schedule;
      
      // Optimistically update the UI immediately
      flushSync(() => {
        setSchedule(newSchedule);
      });

      // Update staff members if provided
      if (staffForSave) {
        setStaffMembersByMonth(prev => ({
          ...prev,
          [currentMonthIndex]: staffForSave,
        }));
      }

      // Return context for potential rollback
      return { previousSchedule };
    },
    onError: (error, variables, context) => {
      // Rollback the optimistic update
      if (context?.previousSchedule) {
        setSchedule(context.previousSchedule);
      }
      
      console.error("❌ Schedule update failed, rolling back:", error);
    },
    onSuccess: (result, variables) => {
      // Success - the UI is already updated optimistically
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Schedule update successful with optimistic UI');
      }
    }
  });

  // Single-cell update mutation for real-time typing
  const updateShiftMutation = useMutation({
    mutationFn: async ({ staffId, dateKey, shiftValue }) => {
      // Create new schedule with the single cell update
      const newSchedule = {
        ...schedule,
        [staffId]: {
          ...schedule[staffId],
          [dateKey]: shiftValue,
        },
      };
      
      // Use the same save logic as bulk updates
      const currentMonthStaff = staffMembersByMonth[currentMonthIndex] || [];
      const saveData = {
        ...newSchedule,
        _staff_members: currentMonthStaff,
      };
      
      // Debounced auto-save to Supabase
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      return new Promise((resolve, reject) => {
        autoSaveTimeoutRef.current = setTimeout(async () => {
          try {
            await saveScheduleAsync({ data: saveData, scheduleId: currentScheduleId });
            resolve({ staffId, dateKey, shiftValue, newSchedule });
          } catch (error) {
            reject(error);
          }
        }, 1000); // 1 second debounce for individual cell updates
      });
    },
    onMutate: async ({ staffId, dateKey, shiftValue }) => {
      // Immediate UI update for typing responsiveness
      const previousSchedule = schedule;
      
      const newSchedule = {
        ...schedule,
        [staffId]: {
          ...schedule[staffId],
          [dateKey]: shiftValue,
        },
      };
      
      // Immediate UI update
      setSchedule(newSchedule);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 Instant update: ${staffId} → ${dateKey} = "${shiftValue}"`);
      }
      
      return { previousSchedule };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousSchedule) {
        setSchedule(context.previousSchedule);
      }
      console.error("❌ Single cell update failed:", error);
    }
  });

  // Load and migrate data from Supabase when available
  useEffect(() => {
    // Skip if currentMonthIndex is invalid (negative)
    if (currentMonthIndex < 0) {
      console.log(`⚠️ Skipping data load for negative period index: ${currentMonthIndex}`);
      return;
    }
    
    // Skip if we have explicit totalPeriods count and index exceeds it
    if (totalPeriods > 0 && currentMonthIndex >= totalPeriods) {
      console.log(`⚠️ Skipping data load for period index ${currentMonthIndex} >= totalPeriods ${totalPeriods}`);
      return;
    }
    
    // Additional safety check: skip if index seems unreasonably high (prevents loading deleted periods)
    if (currentMonthIndex > 20) { // No restaurant should have more than 20 periods
      console.log(`⚠️ Skipping data load for unreasonably high period index: ${currentMonthIndex}`);
      return;
    }
    
    if (supabaseScheduleData && supabaseScheduleData.schedule_data) {
      const { _staff_members, ...actualScheduleData } = supabaseScheduleData.schedule_data;

      // Migrate staff members from database
      const migratedStaffMembers = _staff_members
        ? migrateStaffMembers(_staff_members)
        : [];

      // Migrate schedule data to use UUIDs
      const migratedScheduleData = migrateScheduleData(
        actualScheduleData,
        migratedStaffMembers
      );

      // Only update if we have meaningful data AND valid period index
      if ((migratedStaffMembers.length > 0 || Object.keys(migratedScheduleData).length > 0) && currentMonthIndex >= 0) {
        console.log(`🔄 Loading period ${currentMonthIndex} from Supabase real-time`);
        
        // Update staff members
        if (migratedStaffMembers.length > 0) {
          setStaffMembersByMonth(prev => ({
            ...prev,
            [currentMonthIndex]: migratedStaffMembers,
          }));
        }
        
        // Update schedule data
        const currentDateRange = generateDateRange(currentMonthIndex);
        
        if (Object.keys(migratedScheduleData).length > 0) {
          setSchedule(migratedScheduleData);
        } else {
          // Initialize with staff structure
          const newSchedule = initializeSchedule(
            migratedStaffMembers.length > 0 ? migratedStaffMembers : defaultStaffMembersArray,
            currentDateRange
          );
          setSchedule(newSchedule);
        }
      }
    }
  }, [supabaseScheduleData, currentMonthIndex, totalPeriods]);

  // Handle month switching with staff preservation
  useEffect(() => {
    if (!supabaseScheduleData) {
      // When switching months without Supabase data, try to preserve staff from other periods
      let staffToUse = defaultStaffMembersArray;
      
      // Try to find staff from the most recent period
      for (let i = 5; i >= 0; i--) {
        if (i !== currentMonthIndex) {
          const periodStaff = staffMembersByMonth[i];
          if (periodStaff && Array.isArray(periodStaff) && periodStaff.length > 0) {
            staffToUse = periodStaff;
            break;
          }
        }
      }

      // Initialize new schedule with appropriate staff
      const newSchedule = initializeSchedule(staffToUse, safeGenerateDateRange(currentMonthIndex));
      setSchedule(newSchedule);
      
      if (staffToUse !== defaultStaffMembersArray) {
        setStaffMembersByMonth(prev => ({
          ...prev,
          [currentMonthIndex]: staffToUse,
        }));
        console.log(`🔄 Initialized period ${currentMonthIndex} with staff from previous period`);
      }
    }
  }, [currentMonthIndex, supabaseScheduleData, staffMembersByMonth]);

  // Optimistic update functions
  const updateSchedule = useCallback(
    (newSchedule, staffForSave = null, source = 'auto') => {
      if (Object.keys(newSchedule).length === 0) return;
      
      // Use the mutation for optimistic updates
      updateScheduleMutation.mutate({ newSchedule, staffForSave });
    },
    [updateScheduleMutation]
  );

  const updateShift = useCallback(
    (staffId, dateKey, shiftValue) => {
      // Input validation
      if (!dataValidation.isValidStaffId(staffId)) {
        console.warn('⚠️ Invalid staffId in updateShift:', staffId);
        return;
      }

      if (!dataValidation.isValidDateKey(dateKey)) {
        console.warn('⚠️ Invalid dateKey in updateShift:', dateKey);
        return;
      }

      if (!dataValidation.isValidShiftValue(shiftValue)) {
        console.warn('⚠️ Invalid shiftValue in updateShift:', shiftValue);
        return;
      }

      // Use the mutation for instant UI update + background save
      updateShiftMutation.mutate({ staffId, dateKey, shiftValue });
    },
    [updateShiftMutation]
  );

  // Legacy auto-save function for compatibility
  const scheduleAutoSave = useCallback(
    (newScheduleData, newStaffMembers = null, source = 'auto') => {
      // This now uses the mutation system
      updateScheduleMutation.mutate({
        newSchedule: newScheduleData,
        staffForSave: newStaffMembers
      });
    },
    [updateScheduleMutation]
  );

  // Update schedule when periods are loaded (if schedule is still empty)
  useEffect(() => {
    const currentDateRange = safeGenerateDateRange(currentMonthIndex);
    if (currentDateRange.length > 0 && (!schedule || Object.keys(schedule).length === 0)) {
      // Periods are now loaded but schedule is still empty - reinitialize
      const newSchedule = initializeSchedule(defaultStaffMembersArray, currentDateRange);
      setSchedule(newSchedule);
    }
  }, [monthPeriods, currentMonthIndex, schedule]);

  return {
    // Schedule data
    schedule,
    schedulesByMonth: { [currentMonthIndex]: schedule }, // For compatibility
    staffMembersByMonth,
    dateRange,
    
    // State setters (for compatibility)
    setSchedule,
    setStaffMembersByMonth,
    
    // Update functions with optimistic updates
    updateSchedule,
    updateShift,
    scheduleAutoSave,
    
    // Supabase state
    currentScheduleId,
    setCurrentScheduleId,
    isConnected,
    isLoading: isSupabaseLoading,
    isSaving: isSupabaseSaving || updateScheduleMutation.isPending || updateShiftMutation.isPending,
    error: supabaseError,
    
    // Utilities
    setHasExplicitlyDeletedData: () => {}, // Placeholder for compatibility
    syncLocalStorageToDatabase: () => Promise.resolve(), // No longer needed
  };
};