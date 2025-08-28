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
  } catch (error) {
    console.warn("Failed to save periods to localStorage:", error);
  }
};

// Function to load periods from localStorage
const loadPeriods = () => {
  try {
    const stored = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (!stored) {
      return [...defaultMonthPeriods];
    }

    const serializedPeriods = JSON.parse(stored);
    return serializedPeriods.map((period) => ({
      start: new Date(period.start),
      end: new Date(period.end),
      label: period.label,
    }));
  } catch (error) {
    console.warn("Failed to load periods from localStorage:", error);
    return [...defaultMonthPeriods];
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
  // Bounds check for monthIndex
  if (
    monthIndex < 0 ||
    monthIndex >= monthPeriods.length ||
    monthPeriods[monthIndex] === undefined
  ) {
    monthIndex = 0;
  }

  const period = monthPeriods[monthIndex];
  if (!period || !period.start || !period.end) {
    console.error(`Invalid period for monthIndex ${monthIndex}:`, period);
    // Fallback to first available period
    const _fallbackPeriod = monthPeriods[0];
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
  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Find the period that contains today's date
  for (let i = 0; i < monthPeriods.length; i++) {
    const period = monthPeriods[i];
    if (todayUTC >= period.start && todayUTC <= period.end) {
      console.log(
        `📅 Current date (${todayUTC.toISOString().split("T")[0]}) falls in period ${i}: ${period.label}`,
      );
      return i;
    }
  }

  // If today's date doesn't fall in any existing period, check if it's before the first period
  if (todayUTC < monthPeriods[0].start) {
    console.log(
      `📅 Current date is before all periods, defaulting to first period: ${monthPeriods[0].label}`,
    );
    return 0;
  }

  // If today's date is after all periods, return the last period
  console.log(
    `📅 Current date is after all periods, defaulting to last period: ${monthPeriods[monthPeriods.length - 1].label}`,
  );
  return monthPeriods.length - 1;
};

// Function to find period with data, prioritizing Supabase data over localStorage
export const findPeriodWithData = (supabaseData = null) => {
  console.log("🔍 findPeriodWithData called with data:", !!supabaseData);

  // First, check if Supabase data contains schedule data for any period
  if (supabaseData && supabaseData.schedule_data) {
    const { _staff_members, ...actualScheduleData } =
      supabaseData.schedule_data;

    console.log(
      "🔍 Staff IDs in Supabase data:",
      Object.keys(actualScheduleData),
    );
    console.log("🔍 Total periods to check:", monthPeriods.length);

    // DEBUG: Show actual data structure for first staff member
    const firstStaffId = Object.keys(actualScheduleData)[0];
    if (firstStaffId) {
      console.log("🔍 DETAILED DEBUG - First staff member data:");
      console.log(`🔍 Staff ID: ${firstStaffId}`);
      console.log("🔍 Staff schedule data:", actualScheduleData[firstStaffId]);
      console.log(
        "🔍 Type of staff schedule:",
        typeof actualScheduleData[firstStaffId],
      );
      console.log(
        "🔍 Staff schedule keys:",
        actualScheduleData[firstStaffId]
          ? Object.keys(actualScheduleData[firstStaffId])
          : "null/undefined",
      );

      // Check a few sample dates
      if (
        actualScheduleData[firstStaffId] &&
        typeof actualScheduleData[firstStaffId] === "object"
      ) {
        const sampleDates = [
          "2025-06-21",
          "2025-06-22",
          "2025-06-23",
          "2025-07-01",
          "2025-07-02",
        ];
        sampleDates.forEach((date) => {
          const value = actualScheduleData[firstStaffId][date];
          console.log(
            `🔍 Sample date ${date}:`,
            value,
            `(type: ${typeof value})`,
          );
        });
      }
    }

    // Check each period to see if Supabase data has meaningful dates in that period's range
    for (let i = 0; i < monthPeriods.length; i++) {
      const dateRange = generateDateRange(i);
      console.log(
        `🔍 Checking period ${i} (${monthPeriods[i].label}): ${dateRange[0].toISOString().split("T")[0]} to ${dateRange[dateRange.length - 1].toISOString().split("T")[0]}`,
      );

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

          if (hasMeaningfulData) {
            console.log(
              `🔍 Found meaningful data: ${dateKey} = "${shiftValue}" in period ${i}`,
            );
            return true;
          }
          return false;
        });
      });

      console.log(`🔍 Period ${i} has meaningful data: ${hasDataInPeriod}`);

      if (hasDataInPeriod) {
        console.log(
          `🔍 ✅ Found meaningful Supabase data in period ${i}: ${monthPeriods[i].label}`,
        );
        return i;
      }
    }

    // If no meaningful data found, log this for debugging
    console.log(
      "🔍 ❌ No meaningful schedule data found in any period, using date-based period",
    );
  } else {
    console.log("🔍 No Supabase data available");
  }

  // Fallback to current date-based period
  const fallbackPeriod = getCurrentMonthIndex();
  console.log(`🔍 Using fallback period: ${fallbackPeriod}`);
  return fallbackPeriod;
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
