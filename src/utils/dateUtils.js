import { addDays, format } from "date-fns";

// Month periods configuration (21st to 20th of next month)
// Using UTC dates to ensure consistent ISO string representation
export const monthPeriods = [
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
    const fallbackPeriod = monthPeriods[0];
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
