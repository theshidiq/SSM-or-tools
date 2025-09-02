import { addDays, format } from "date-fns";
import { supabase } from "./supabase";

// Default month periods configuration (21st to 20th of next month)
// Using UTC dates to ensure consistent ISO string representation
const defaultMonthPeriods = [
  {
    start: new Date(Date.UTC(2025, 0, 21)),
    end: new Date(Date.UTC(2025, 1, 20)),
    label: "1月・2月",
  }, // Jan-Feb
  {
    start: new Date(Date.UTC(2025, 1, 21)),
    end: new Date(Date.UTC(2025, 2, 20)),
    label: "2月・3月",
  }, // Feb-Mar
  {
    start: new Date(Date.UTC(2025, 2, 21)),
    end: new Date(Date.UTC(2025, 3, 20)),
    label: "3月・4月",
  }, // Mar-Apr
  {
    start: new Date(Date.UTC(2025, 3, 21)),
    end: new Date(Date.UTC(2025, 4, 20)),
    label: "4月・5月",
  }, // Apr-May
  {
    start: new Date(Date.UTC(2025, 4, 21)),
    end: new Date(Date.UTC(2025, 5, 20)),
    label: "5月・6月",
  }, // May-Jun
  {
    start: new Date(Date.UTC(2025, 5, 21)),
    end: new Date(Date.UTC(2025, 6, 20)),
    label: "6月・7月",
  }, // Jun-Jul
];

// Storage key for localStorage migration tracking
const PERIODS_STORAGE_KEY = "shift_manager_periods";
const MIGRATION_KEY = "periods_migrated_to_supabase";

// In-memory cache for periods
let periodsCache = [];
let cacheInitialized = false;

// Function to migrate localStorage periods to Supabase
const migratePeriodsToSupabase = async () => {
  try {
    const migrated = localStorage.getItem(MIGRATION_KEY);
    if (migrated) return; // Already migrated

    const stored = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (stored) {
      const serializedPeriods = JSON.parse(stored);
      
      // Insert periods into Supabase
      for (const period of serializedPeriods) {
        await supabase.rpc('add_period', {
          p_start_date: period.start.split('T')[0], // Convert to DATE format
          p_end_date: period.end.split('T')[0],
          p_label: period.label
        });
      }
      
      console.log('✅ Migrated periods from localStorage to Supabase');
    } else {
      // First time setup - add default periods
      const hasEverHadPeriods = localStorage.getItem('periods_ever_initialized');
      if (!hasEverHadPeriods) {
        for (const period of defaultMonthPeriods) {
          await supabase.rpc('add_period', {
            p_start_date: period.start.toISOString().split('T')[0],
            p_end_date: period.end.toISOString().split('T')[0],
            p_label: period.label
          });
        }
        console.log('✅ Initialized default periods in Supabase');
      }
    }
    
    // Mark as migrated
    localStorage.setItem(MIGRATION_KEY, 'true');
    
  } catch (error) {
    console.error('Failed to migrate periods to Supabase:', error);
  }
};

// Function to load periods from Supabase
const loadPeriodsFromSupabase = async () => {
  try {
    const { data, error } = await supabase.rpc('get_periods');
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      // Try migration first
      await migratePeriodsToSupabase();
      
      // Try loading again
      const { data: retryData, error: retryError } = await supabase.rpc('get_periods');
      if (retryError) throw retryError;
      
      if (!retryData || retryData.length === 0) {
        console.warn('No periods found in database');
        return [];
      }
      
      return retryData.map(period => ({
        id: period.id,
        start: new Date(period.start_date + 'T00:00:00.000Z'),
        end: new Date(period.end_date + 'T00:00:00.000Z'),
        label: period.label,
      }));
    }
    
    return data.map(period => ({
      id: period.id,
      start: new Date(period.start_date + 'T00:00:00.000Z'),
      end: new Date(period.end_date + 'T00:00:00.000Z'),
      label: period.label,
    }));
  } catch (error) {
    console.error('Failed to load periods from Supabase:', error);
    
    // Fallback to localStorage for offline support
    const stored = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (stored) {
      const serializedPeriods = JSON.parse(stored);
      return serializedPeriods.map((period) => ({
        start: new Date(period.start),
        end: new Date(period.end),
        label: period.label,
      }));
    }
    
    // Last fallback to default periods
    const hasEverHadPeriods = localStorage.getItem('periods_ever_initialized');
    return hasEverHadPeriods ? [] : [...defaultMonthPeriods];
  }
};

// Function to initialize periods cache
const initializePeriodsCache = async () => {
  if (cacheInitialized) return periodsCache;
  
  periodsCache = await loadPeriodsFromSupabase();
  cacheInitialized = true;
  return periodsCache;
};

// Function to refresh periods cache
export const refreshPeriodsCache = async () => {
  periodsCache = await loadPeriodsFromSupabase();
  cacheInitialized = true;
  return periodsCache;
};

// Function to get periods (for compatibility)
export const getMonthPeriods = () => {
  return cacheInitialized ? periodsCache : [];
};

// Export reactive periods array that updates from cache
export const monthPeriods = new Proxy([], {
  get(target, prop) {
    if (prop === 'length') {
      return cacheInitialized ? periodsCache.length : 0;
    }
    if (prop === 'map' || prop === 'forEach' || prop === 'filter' || prop === 'find' || prop === 'findIndex') {
      return cacheInitialized ? periodsCache[prop].bind(periodsCache) : [][prop].bind([]);
    }
    if (typeof prop === 'string' && !isNaN(prop)) {
      const index = parseInt(prop);
      return cacheInitialized ? periodsCache[index] : undefined;
    }
    if (!cacheInitialized) {
      return undefined;
    }
    return periodsCache[prop];
  },
  set(target, prop, value) {
    if (cacheInitialized) {
      periodsCache[prop] = value;
    }
    return true;
  },
  has(target, prop) {
    return cacheInitialized ? prop in periodsCache : false;
  },
  ownKeys(target) {
    return cacheInitialized ? Object.keys(periodsCache) : [];
  },
  getOwnPropertyDescriptor(target, prop) {
    return cacheInitialized ? Object.getOwnPropertyDescriptor(periodsCache, prop) : undefined;
  }
});

// Initialize cache on module load
initializePeriodsCache();

// Function to add next period
export const addNextPeriod = async () => {
  await initializePeriodsCache(); // Ensure cache is initialized
  
  const lastPeriod = periodsCache[periodsCache.length - 1];
  if (!lastPeriod || !lastPeriod.end) {
    console.error("Cannot add next period - no valid last period found");
    return 0;
  }

  const lastEndDate = new Date(lastPeriod.end);

  // Next period starts the day after the last period ends
  const nextStartDate = new Date(lastEndDate);
  nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);
  nextStartDate.setUTCHours(0, 0, 0, 0); // Ensure midnight UTC

  // Next period ends after one month
  const nextEndDate = new Date(nextStartDate);
  nextEndDate.setUTCMonth(nextEndDate.getUTCMonth() + 1);
  nextEndDate.setUTCDate(nextEndDate.getUTCDate() - 1);
  nextEndDate.setUTCHours(0, 0, 0, 0); // Ensure midnight UTC

  // Generate label based on months
  const startMonth = nextStartDate.getUTCMonth() + 1;
  const endMonth = nextEndDate.getUTCMonth() + 1;
  const startMonthName = [
    "",
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ][startMonth];
  const endMonthName = [
    "",
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ][endMonth];

  const label = `${startMonthName}・${endMonthName}`;

  try {
    // Add period to Supabase
    const { data, error } = await supabase.rpc('add_period', {
      p_start_date: nextStartDate.toISOString().split('T')[0],
      p_end_date: nextEndDate.toISOString().split('T')[0],
      p_label: label
    });

    if (error) throw error;

    // Refresh cache from database
    await refreshPeriodsCache();

    console.log(`✅ Added new period: ${label} (saved to database)`);
    return periodsCache.length - 1; // Return the new period index
    
  } catch (error) {
    console.error('Failed to add period to database:', error);
    
    // Fallback: add to cache only
    const newPeriod = {
      start: nextStartDate,
      end: nextEndDate,
      label: label,
    };
    
    periodsCache.push(newPeriod);
    console.log(`⚠️ Added new period to cache only: ${label} (database failed)`);
    return periodsCache.length - 1;
  }
};

// Generate date range based on current month index
export const generateDateRange = (monthIndex) => {
  // Handle case where no periods exist or cache not initialized
  if (!cacheInitialized || periodsCache.length === 0) {
    console.warn("No periods available - returning empty date range");
    return [];
  }

  // Bounds check for monthIndex
  if (
    monthIndex < 0 ||
    monthIndex >= periodsCache.length ||
    periodsCache[monthIndex] === undefined
  ) {
    monthIndex = 0;
    if (periodsCache.length === 0) {
      return []; // Still empty, return empty array
    }
  }

  const period = periodsCache[monthIndex];
  if (!period || !period.start || !period.end) {
    console.error(`Invalid period for monthIndex ${monthIndex}:`, period);
    // If we have no valid periods, return empty array
    if (periodsCache.length === 0) {
      return [];
    }
    // Try first period as fallback
    return generateDateRange(0);
  }

  const dates = [];
  let currentDate = new Date(period.start);

  const endDate = new Date(period.end);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }

  return dates;
};

// Helper function to get days in a month
export const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// Helper function to check if date is within staff work period
export const isDateWithinWorkPeriod = (date, staff) => {
  if (!staff.startPeriod) return true; // If no start period defined, assume always working

  const currentDate = new Date(date);

  // Check if before start date
  const startDate = new Date(
    staff.startPeriod.year,
    staff.startPeriod.month - 1,
    staff.startPeriod.day || 1,
  );

  if (currentDate < startDate) {
    return false; // Before start date
  }

  // Check if after end date (if end period is defined)
  if (staff.endPeriod) {
    const endDate = new Date(
      staff.endPeriod.year,
      staff.endPeriod.month - 1,
      staff.endPeriod.day ||
        getDaysInMonth(staff.endPeriod.year, staff.endPeriod.month),
    );

    if (currentDate > endDate) {
      return false; // After end date
    }
  }

  return true; // Within work period
};

// Function to get the current month index based on today's date
export const getCurrentMonthIndex = (periods = null) => {
  // Use provided periods or fall back to cache
  const periodsToUse = periods || periodsCache;
  
  // Handle case where no periods exist
  if (!periodsToUse || periodsToUse.length === 0) {
    return 0; // Default to 0 when no periods exist
  }

  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Find the period that contains today's date
  for (let i = 0; i < periodsToUse.length; i++) {
    const period = periodsToUse[i];
    if (todayUTC >= period.start && todayUTC <= period.end) {
      console.log(`📅 Today (${todayUTC.toISOString().split('T')[0]}) falls in period ${i}: ${period.label}`);
      return i;
    }
  }

  // If today's date doesn't fall in any existing period, check if it's before the first period
  if (periodsToUse.length > 0 && todayUTC < periodsToUse[0].start) {
    console.log(`📅 Today is before all periods, using first period (${periodsToUse[0].label})`);
    return 0;
  }

  // If today's date is after all periods, return the last period
  console.log(`📅 Today is after all periods, using last period (${periodsToUse[periodsToUse.length - 1].label})`);
  return periodsToUse.length - 1;
};

// Function to find period with data, prioritizing Supabase data over localStorage
export const findPeriodWithData = (supabaseData = null) => {
  // Handle case where no periods exist or cache not initialized
  if (!cacheInitialized || periodsCache.length === 0) {
    console.warn("No periods available for finding data");
    return 0; // Return 0 for empty state
  }

  // First, check if Supabase data contains schedule data for any period
  if (supabaseData && supabaseData.schedule_data) {
    const { _staff_members, ...actualScheduleData } =
      supabaseData.schedule_data;

    // Check each period to see if Supabase data has meaningful dates in that period's range
    for (let i = 0; i < periodsCache.length; i++) {
      const dateRange = generateDateRange(i);
      const hasDataInPeriod = dateRange.some((date) => {
        const dateKey = date.toISOString().split("T")[0];
        return Object.keys(actualScheduleData).some((staffId) => {
          const staffSchedule = actualScheduleData[staffId];
          if (!staffSchedule || typeof staffSchedule !== "object") return false;

          const shiftValue = staffSchedule[dateKey];
          const hasMeaningfulData =
            shiftValue !== undefined &&
            shiftValue !== null &&
            shiftValue !== "" &&
            shiftValue.toString().trim() !== "";

          return hasMeaningfulData;
        });
      });

      if (hasDataInPeriod) {
        console.log(`✅ Found schedule data in period ${i}: ${periodsCache[i].label}`);
        return i;
      }
    }
  }

  // Fallback to current date-based period
  const fallbackPeriod = getCurrentMonthIndex();
  return fallbackPeriod;
};

// Function to delete a specific period
export const deletePeriod = async (periodIndex) => {
  try {
    await initializePeriodsCache(); // Ensure cache is initialized
    
    // Validate period index
    if (periodIndex < 0 || periodIndex >= periodsCache.length) {
      console.error(`Invalid period index: ${periodIndex}. Available: 0-${periodsCache.length - 1}`);
      return { success: false, error: "Invalid period index" };
    }

    // Get period info for logging
    const periodToDelete = periodsCache[periodIndex];
    console.log(`🗑️ Deleting period ${periodIndex}: ${periodToDelete.label}`);

    try {
      // Delete period from Supabase if it has an ID
      if (periodToDelete.id) {
        const { error } = await supabase.rpc('delete_period', {
          period_id: periodToDelete.id
        });
        
        if (error) throw error;
        console.log(`✅ Period deleted from database: ${periodToDelete.label}`);
      }
      
      // Refresh cache from database
      await refreshPeriodsCache();
      
    } catch (error) {
      console.error('Failed to delete period from database:', error);
      
      // Fallback: remove from cache only
      periodsCache.splice(periodIndex, 1);
      console.log(`⚠️ Period deleted from cache only: ${periodToDelete.label} (database failed)`);
    }

    console.log(`✅ Period deleted successfully. Remaining periods: ${periodsCache.length}`);
    
    // Return success with navigation info
    let suggestedIndex = periodIndex;
    if (periodsCache.length === 0) {
      // No periods left - this is allowed now
      suggestedIndex = 0;
    } else if (suggestedIndex >= periodsCache.length) {
      suggestedIndex = periodsCache.length - 1; // Go to last period if deleted period was at end
    }

    return { 
      success: true, 
      deletedPeriod: periodToDelete,
      newPeriodCount: periodsCache.length,
      suggestedNavigationIndex: suggestedIndex,
      isEmpty: periodsCache.length === 0
    };
  } catch (error) {
    console.error("Failed to delete period:", error);
    return { success: false, error: error.message };
  }
};

// Function to reset periods to defaults (useful for testing or admin functions)
export const resetPeriodsToDefault = async () => {
  try {
    await initializePeriodsCache(); // Ensure cache is initialized
    
    // Clear existing periods from database
    for (const period of periodsCache) {
      if (period.id) {
        await supabase.rpc('delete_period', {
          period_id: period.id
        });
      }
    }
    
    // Add default periods to database
    for (const period of defaultMonthPeriods) {
      await supabase.rpc('add_period', {
        p_start_date: period.start.toISOString().split('T')[0],
        p_end_date: period.end.toISOString().split('T')[0],
        p_label: period.label
      });
    }
    
    // Refresh cache from database
    await refreshPeriodsCache();
    
    console.log("✅ Periods reset to default in database");
    return true;
  } catch (error) {
    console.error("Failed to reset periods:", error);
    
    // Fallback: reset cache only
    periodsCache.length = 0; // Clear existing array
    periodsCache.push(...defaultMonthPeriods.map(p => ({...p}))); // Add default periods
    console.log("⚠️ Periods reset to default in cache only (database failed)");
    return false;
  }
};

// Dynamic dropdown positioning logic
export const getDropdownPosition = (
  staffIndex,
  dateIndex,
  totalStaff,
  totalDates,
) => {
  // Improved positioning to align better with cell dimensions
  // Cell dimensions: width: 40px, height: 50px
  const isRightSide = staffIndex >= totalStaff - 3; // Last 3 columns
  const isBottomHalf = dateIndex >= totalDates - 5; // Last 5 rows

  if (isRightSide && isBottomHalf) {
    // Above and to the left - align dropdown right edge with cell right edge
    return { right: "0px", bottom: "100%", transform: "translateY(-4px)" };
  } else if (isRightSide) {
    // Below and to the left - align dropdown right edge with cell right edge
    return { right: "0px", top: "100%", transform: "translateY(4px)" };
  } else if (isBottomHalf) {
    // Above and to the right - align dropdown left edge with cell left edge
    return { left: "0px", bottom: "100%", transform: "translateY(-4px)" };
  } else {
    // Below and to the right - align dropdown left edge with cell left edge (default)
    return { left: "0px", top: "100%", transform: "translateY(4px)" };
  }
};

// Get date label for staff work period boundaries or just formatted date
export const getDateLabel = (date, staff = null) => {
  if (!date) return "";

  const currentDate = new Date(date);

  // If no staff provided, just return formatted date
  if (!staff || !staff.startPeriod) {
    return format(currentDate, "d");
  }

  // Check if it's the start date
  const startDate = new Date(
    staff.startPeriod.year,
    staff.startPeriod.month - 1,
    staff.startPeriod.day || 1,
  );

  if (currentDate.getTime() === startDate.getTime()) {
    return "START";
  }

  // Check if it's the end date (if end period is defined)
  if (staff.endPeriod) {
    const endDate = new Date(
      staff.endPeriod.year,
      staff.endPeriod.month - 1,
      staff.endPeriod.day ||
        getDaysInMonth(staff.endPeriod.year, staff.endPeriod.month),
    );

    if (currentDate.getTime() === endDate.getTime()) {
      return "END";
    }
  }

  // If no special boundary date, return formatted date
  return format(currentDate, "d");
};
