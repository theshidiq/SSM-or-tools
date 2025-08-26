/**
 * Date utilities for server-side processing
 * Adapted from client-side date utilities
 */

/**
 * Generate date range for a given month index (0-5 for 6 periods)
 * @param {number} monthIndex - Month index (0-5)
 * @returns {Date[]} Array of dates
 */
function generateDateRange(monthIndex) {
  const year = new Date().getFullYear();
  
  // Define the 6 periods: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
  const periodStartMonths = [0, 2, 4, 6, 8, 10]; // JavaScript months are 0-indexed
  const periodEndMonths = [1, 3, 5, 7, 9, 11];
  
  if (monthIndex < 0 || monthIndex > 5) {
    throw new Error(`Invalid month index: ${monthIndex}. Must be 0-5.`);
  }
  
  const startMonth = periodStartMonths[monthIndex];
  const endMonth = periodEndMonths[monthIndex];
  
  const dates = [];
  
  // Generate dates for the first month
  const startDate = new Date(year, startMonth, 1);
  const endOfFirstMonth = new Date(year, startMonth + 1, 0).getDate();
  
  for (let day = 1; day <= endOfFirstMonth; day++) {
    dates.push(new Date(year, startMonth, day));
  }
  
  // Generate dates for the second month
  const endOfSecondMonth = new Date(year, endMonth + 1, 0).getDate();
  
  for (let day = 1; day <= endOfSecondMonth; day++) {
    dates.push(new Date(year, endMonth, day));
  }
  
  return dates;
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get period name for month index
 * @param {number} monthIndex - Month index (0-5)
 * @returns {string} Period name
 */
function getPeriodName(monthIndex) {
  const periodNames = ['1-2月', '3-4月', '5-6月', '7-8月', '9-10月', '11-12月'];
  return periodNames[monthIndex] || 'Unknown';
}

/**
 * Get day of week in Japanese
 * @param {Date} date - Date object
 * @returns {string} Day of week in Japanese
 */
function getDayOfWeekJP(date) {
  const daysJP = ['日', '月', '火', '水', '木', '金', '土'];
  return daysJP[date.getDay()];
}

/**
 * Check if date is weekend
 * @param {Date} date - Date to check
 * @returns {boolean} True if weekend
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Get month boundaries for a period
 * @param {number} monthIndex - Month index (0-5)
 * @returns {Object} Start and end dates
 */
function getMonthBoundaries(monthIndex) {
  const year = new Date().getFullYear();
  const periodStartMonths = [0, 2, 4, 6, 8, 10];
  const periodEndMonths = [1, 3, 5, 7, 9, 11];
  
  if (monthIndex < 0 || monthIndex > 5) {
    throw new Error(`Invalid month index: ${monthIndex}`);
  }
  
  const startMonth = periodStartMonths[monthIndex];
  const endMonth = periodEndMonths[monthIndex];
  
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, endMonth + 1, 0), // Last day of end month
  };
}

/**
 * Calculate days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Number of days
 */
function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate - startDate) / oneDay);
}

module.exports = {
  generateDateRange,
  formatDate,
  getPeriodName,
  getDayOfWeekJP,
  isWeekend,
  getMonthBoundaries,
  daysBetween,
};