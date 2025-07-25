import { addDays, format } from 'date-fns';

// Month periods configuration (21st to 20th of next month)
export let monthPeriods = [
  { start: new Date(2025, 0, 21), end: new Date(2025, 1, 20), label: '1月・2月' }, // Jan-Feb
];

// Function to add next period
export const addNextPeriod = () => {
  const lastPeriod = monthPeriods[monthPeriods.length - 1];
  if (!lastPeriod || !lastPeriod.end) {
    console.error('Cannot add next period - no valid last period found');
    return 0;
  }
  
  const lastEndDate = new Date(lastPeriod.end);
  
  // Next period starts the day after the last period ends
  const nextStartDate = new Date(lastEndDate);
  nextStartDate.setDate(nextStartDate.getDate() + 1);
  
  // Next period ends after one month
  const nextEndDate = new Date(nextStartDate);
  nextEndDate.setMonth(nextEndDate.getMonth() + 1);
  nextEndDate.setDate(nextEndDate.getDate() - 1);
  
  // Generate label based on months
  const startMonth = nextStartDate.getMonth() + 1;
  const endMonth = nextEndDate.getMonth() + 1;
  const startMonthName = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][startMonth];
  const endMonthName = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][endMonth];
  
  const newPeriod = {
    start: nextStartDate,
    end: nextEndDate,
    label: `${startMonthName}・${endMonthName}`
  };
  
  monthPeriods.push(newPeriod);
  console.log('Added new period:', newPeriod, 'Total periods:', monthPeriods.length);
  return monthPeriods.length - 1; // Return the new period index
};

// Generate date range based on current month index
export const generateDateRange = (monthIndex) => {
  // Bounds check for monthIndex
  if (monthIndex < 0 || monthIndex >= monthPeriods.length || monthPeriods[monthIndex] === undefined) {
    console.warn(`Invalid monthIndex: ${monthIndex}. Using default month (0).`);
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
  while (currentDate <= period.end) {
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
    staff.startPeriod.day || 1
  );
  
  if (currentDate < startDate) {
    return false; // Before start date
  }
  
  // Check if after end date (if end period is defined)
  if (staff.endPeriod) {
    const endDate = new Date(
      staff.endPeriod.year, 
      staff.endPeriod.month - 1, 
      staff.endPeriod.day || getDaysInMonth(staff.endPeriod.year, staff.endPeriod.month)
    );
    
    if (currentDate > endDate) {
      return false; // After end date
    }
  }
  
  return true; // Within work period
};

// Dynamic dropdown positioning logic
export const getDropdownPosition = (staffIndex, dateIndex, totalStaff, totalDates) => {
  // Simple positioning to ensure dropdown is always visible
  // Position below the cell by default, to the left if near right edge
  const isRightSide = staffIndex >= totalStaff - 3; // Last 3 columns
  const isBottomHalf = dateIndex >= totalDates - 5; // Last 5 rows
  
  if (isRightSide && isBottomHalf) {
    return { left: '-120px', top: '-150px' }; // Above and to the left
  } else if (isRightSide) {
    return { left: '-120px', top: '100%' }; // Below and to the left
  } else if (isBottomHalf) {
    return { left: '0px', top: '-150px' }; // Above and to the right
  } else {
    return { left: '0px', top: '100%' }; // Below and to the right (default)
  }
};

// Get date label for staff work period boundaries or just formatted date
export const getDateLabel = (date, staff = null) => {
  if (!date) return '';
  
  const currentDate = new Date(date);
  
  // If no staff provided, just return formatted date
  if (!staff || !staff.startPeriod) {
    return format(currentDate, 'd');
  }
  
  // Check if it's the start date
  const startDate = new Date(
    staff.startPeriod.year, 
    staff.startPeriod.month - 1, 
    staff.startPeriod.day || 1
  );
  
  if (currentDate.getTime() === startDate.getTime()) {
    return 'START';
  }
  
  // Check if it's the end date (if end period is defined)
  if (staff.endPeriod) {
    const endDate = new Date(
      staff.endPeriod.year, 
      staff.endPeriod.month - 1, 
      staff.endPeriod.day || getDaysInMonth(staff.endPeriod.year, staff.endPeriod.month)
    );
    
    if (currentDate.getTime() === endDate.getTime()) {
      return 'END';
    }
  }
  
  // If no special boundary date, return formatted date
  return format(currentDate, 'd');
};