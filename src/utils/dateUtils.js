import { addDays, format } from "date-fns";

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

// Storage key for persisting periods
const PERIODS_STORAGE_KEY = "shift_manager_periods";

// Function to save periods to localStorage
const savePeriods = (periods) => {
  try {
    const serializedPeriods = periods.map((period) => ({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      label: period.label,
    }));
    localStorage.setItem(
      PERIODS_STORAGE_KEY,
      JSON.stringify(serializedPeriods),
    );
    
    // Mark that user has had periods initialized (for deletion tracking)
    localStorage.setItem('periods_ever_initialized', 'true');
  } catch (error) {
    console.warn("Failed to save periods to localStorage:", error);
  }
};

// Function to load periods from localStorage
const loadPeriods = () => {
  try {
    const stored = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (!stored) {
      // CRITICAL FIX: Only create default periods on first-time use
      // Check if this is truly first launch vs periods being deleted
      const hasEverHadPeriods = localStorage.getItem('periods_ever_initialized');
      if (!hasEverHadPeriods) {
        // First time user - create default periods and mark as initialized
        localStorage.setItem('periods_ever_initialized', 'true');
        return [...defaultMonthPeriods];
      } else {
        // User has deleted periods - respect their choice and return empty
        return [];
      }
    }

    const serializedPeriods = JSON.parse(stored);
    return serializedPeriods.map((period) => ({
      start: new Date(period.start),
      end: new Date(period.end),
      label: period.label,
    }));
  } catch (error) {
    console.warn("Failed to load periods from localStorage:", error);
    // On error, also respect if periods were intentionally deleted
    const hasEverHadPeriods = localStorage.getItem('periods_ever_initialized');
    return hasEverHadPeriods ? [] : [...defaultMonthPeriods];
  }
};

// Initialize periods from localStorage or defaults
export const monthPeriods = loadPeriods();

// Function to add next period
export const addNextPeriod = () => {
  const lastPeriod = monthPeriods[monthPeriods.length - 1];
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

  const newPeriod = {
    start: nextStartDate,
    end: nextEndDate,
    label: `${startMonthName}・${endMonthName}`,
  };

  monthPeriods.push(newPeriod);

  // Save updated periods to localStorage
  savePeriods(monthPeriods);

  console.log(
    `✅ Added new period: ${newPeriod.label} (saved to localStorage)`,
  );
  return monthPeriods.length - 1; // Return the new period index
};

// Generate date range based on current month index
export const generateDateRange = (monthIndex) => {
  // Handle case where no periods exist
  if (monthPeriods.length === 0) {
    console.warn("No periods available - returning empty date range");
    return [];
  }

  // Bounds check for monthIndex
  if (
    monthIndex < 0 ||
    monthIndex >= monthPeriods.length ||
    monthPeriods[monthIndex] === undefined
  ) {
    monthIndex = 0;
    if (monthPeriods.length === 0) {
      return []; // Still empty, return empty array
    }
  }

  const period = monthPeriods[monthIndex];
  if (!period || !period.start || !period.end) {
    console.error(`Invalid period for monthIndex ${monthIndex}:`, period);
    // If we have no valid periods, return empty array
    if (monthPeriods.length === 0) {
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
export const getCurrentMonthIndex = () => {
  // Handle case where no periods exist
  if (monthPeriods.length === 0) {
    return 0; // Default to 0 when no periods exist
  }

  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Find the period that contains today's date
  for (let i = 0; i < monthPeriods.length; i++) {
    const period = monthPeriods[i];
    if (todayUTC >= period.start && todayUTC <= period.end) {
      return i;
    }
  }

  // If today's date doesn't fall in any existing period, check if it's before the first period
  if (monthPeriods.length > 0 && todayUTC < monthPeriods[0].start) {
    return 0;
  }

  // If today's date is after all periods, return the last period
  return monthPeriods.length - 1;
};

// Function to find period with data, prioritizing Supabase data over localStorage
export const findPeriodWithData = (supabaseData = null) => {
  // Handle case where no periods exist
  if (monthPeriods.length === 0) {
    console.warn("No periods available for finding data");
    return 0; // Return 0 for empty state
  }

  // First, check if Supabase data contains schedule data for any period
  if (supabaseData && supabaseData.schedule_data) {
    const { _staff_members, ...actualScheduleData } =
      supabaseData.schedule_data;

    // Check each period to see if Supabase data has meaningful dates in that period's range
    for (let i = 0; i < monthPeriods.length; i++) {
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
        console.log(`✅ Found schedule data in period ${i}: ${monthPeriods[i].label}`);
        return i;
      }
    }
  }

  // Fallback to current date-based period
  const fallbackPeriod = getCurrentMonthIndex();
  return fallbackPeriod;
};

// Function to delete a specific period
export const deletePeriod = (periodIndex) => {
  try {
    // Validate period index
    if (periodIndex < 0 || periodIndex >= monthPeriods.length) {
      console.error(`Invalid period index: ${periodIndex}. Available: 0-${monthPeriods.length - 1}`);
      return { success: false, error: "Invalid period index" };
    }

    // Get period info for logging
    const periodToDelete = monthPeriods[periodIndex];
    console.log(`🗑️ Deleting period ${periodIndex}: ${periodToDelete.label}`);

    // Remove the period from array
    monthPeriods.splice(periodIndex, 1);

    // Save updated periods to localStorage (even if empty)
    savePeriods(monthPeriods);

    console.log(`✅ Period deleted successfully. Remaining periods: ${monthPeriods.length}`);
    
    // Return success with navigation info
    let suggestedIndex = periodIndex;
    if (monthPeriods.length === 0) {
      // No periods left - this is allowed now
      suggestedIndex = 0;
    } else if (suggestedIndex >= monthPeriods.length) {
      suggestedIndex = monthPeriods.length - 1; // Go to last period if deleted period was at end
    }

    return { 
      success: true, 
      deletedPeriod: periodToDelete,
      newPeriodCount: monthPeriods.length,
      suggestedNavigationIndex: suggestedIndex,
      isEmpty: monthPeriods.length === 0
    };
  } catch (error) {
    console.error("Failed to delete period:", error);
    return { success: false, error: error.message };
  }
};

// Function to reset periods to defaults (useful for testing or admin functions)
export const resetPeriodsToDefault = () => {
  try {
    localStorage.removeItem(PERIODS_STORAGE_KEY);
    monthPeriods.length = 0; // Clear existing array
    monthPeriods.push(...defaultMonthPeriods); // Add default periods
    console.log("✅ Periods reset to default");
    return true;
  } catch (error) {
    console.error("Failed to reset periods:", error);
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
