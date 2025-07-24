import { addDays, format } from 'date-fns';

// Month periods configuration (21st to 20th of next month)
export const monthPeriods = [
  { start: new Date(2025, 0, 21), end: new Date(2025, 1, 20), label: '1月・2月' }, // Jan-Feb
  { start: new Date(2025, 1, 21), end: new Date(2025, 2, 20), label: '2月・3月' }, // Feb-Mar
  { start: new Date(2025, 2, 21), end: new Date(2025, 3, 20), label: '3月・4月' }, // Mar-Apr
  { start: new Date(2025, 3, 21), end: new Date(2025, 4, 20), label: '4月・5月' }, // Apr-May
  { start: new Date(2025, 4, 21), end: new Date(2025, 5, 20), label: '5月・6月' }, // May-Jun
  { start: new Date(2025, 5, 21), end: new Date(2025, 6, 20), label: '6月・7月' }, // Jun-Jul
  { start: new Date(2025, 6, 21), end: new Date(2025, 7, 20), label: '7月・8月' }, // Jul-Aug (current)
];

// Generate date range based on current month index
export const generateDateRange = (monthIndex) => {
  const period = monthPeriods[monthIndex];
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
export const getDropdownPosition = (date, columnIndex, rowIndex) => {
  const day = date.getDate();
  const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
  
  // Check if date is between 18-20 (inclusive)
  if (day >= 18 && day <= 20) {
    // Display on right for columns 1-9, on left for columns 10-12
    if (columnIndex <= 9) {
      return 'right';
    } else {
      // For last columns, check specific rows
      if (rowIndex === 0 || rowIndex === 1) { // 1st and 2nd rows - use 0% positioning
        return 'left-elevated-top';
      }
      return 'left';
    }
  } else if (day >= 21 && day <= 31) {
    // Display below for first part of month
    return 'below';
  } else if (day >= 1 && day <= 17) {
    // Normal dropdown positioning for middle dates
    return 'center';
  }
  
  // Default fallback
  return 'center';
};

// Get date label for staff work period boundaries
export const getDateLabel = (date, staff) => {
  if (!staff.startPeriod) return null;
  
  const currentDate = new Date(date);
  
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
  
  return null;
};