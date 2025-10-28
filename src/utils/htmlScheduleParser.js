/**
 * HTML Schedule Parser
 *
 * Parses HTML table schedules and extracts staff names, dates, and shift data.
 * Handles various HTML formats including multi-line cells and special characters.
 */

/**
 * Parse HTML string and extract schedule table
 * @param {string} htmlContent - HTML content as string
 * @returns {Object} Parsed schedule data
 */
export function parseHTMLSchedule(htmlContent) {
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Find the schedule table (first table in document)
  const table = doc.querySelector('table');
  if (!table) {
    throw new Error('No table found in HTML content');
  }

  // Extract staff names from header
  const staffNames = extractStaffNames(table);
  if (staffNames.length === 0) {
    throw new Error('No staff names found in table header');
  }

  // Extract date rows and shift data
  const rows = extractScheduleRows(table, staffNames.length);
  if (rows.length === 0) {
    throw new Error('No schedule data found in table');
  }

  // Detect period (month range) from data
  const period = detectPeriod(rows);

  return {
    staffNames,
    rows,
    period,
    summary: {
      totalStaff: staffNames.length,
      totalDays: rows.length,
      dateRange: {
        start: rows[0]?.date,
        end: rows[rows.length - 1]?.date
      }
    }
  };
}

/**
 * Extract staff names from table header
 * @param {HTMLTableElement} table - HTML table element
 * @returns {Array<string>} Array of staff names
 */
function extractStaffNames(table) {
  const thead = table.querySelector('thead');
  if (!thead) {
    throw new Error('Table header (thead) not found');
  }

  const headerRow = thead.querySelector('tr');
  if (!headerRow) {
    throw new Error('Header row not found');
  }

  const headers = Array.from(headerRow.querySelectorAll('th'));

  // First column is usually the date column, skip it
  const staffHeaders = headers.slice(1);

  return staffHeaders.map(th => {
    const text = th.textContent.trim();
    return text;
  });
}

/**
 * Extract schedule rows with dates and shifts
 * @param {HTMLTableElement} table - HTML table element
 * @param {number} expectedStaffCount - Expected number of staff columns
 * @returns {Array<Object>} Array of row data
 */
function extractScheduleRows(table, expectedStaffCount) {
  const tbody = table.querySelector('tbody');
  if (!tbody) {
    throw new Error('Table body (tbody) not found');
  }

  const rows = Array.from(tbody.querySelectorAll('tr'));
  const scheduleRows = [];

  rows.forEach((tr, rowIndex) => {
    const cells = Array.from(tr.querySelectorAll('td'));

    if (cells.length === 0) {
      return; // Skip empty rows
    }

    // First cell is the date
    const dateCell = cells[0];
    const dateInfo = parseDateCell(dateCell);

    // Remaining cells are shift data
    const shiftCells = cells.slice(1);

    // Validate cell count matches staff count
    if (shiftCells.length !== expectedStaffCount) {
      console.warn(
        `Row ${rowIndex + 1}: Expected ${expectedStaffCount} shift cells, got ${shiftCells.length}`
      );
    }

    // Extract shift data
    const shifts = shiftCells.map(cell => extractShiftValue(cell));

    scheduleRows.push({
      rowIndex,
      date: dateInfo.date,
      dayOfWeek: dateInfo.dayOfWeek,
      dayNumber: dateInfo.dayNumber,
      shifts
    });
  });

  return scheduleRows;
}

/**
 * Parse date cell content
 * Format examples: "木 21日", "金 22日", "月 1日"
 * @param {HTMLTableCellElement} cell - Date cell element
 * @returns {Object} Parsed date information
 */
function parseDateCell(cell) {
  const text = cell.textContent.trim();

  // Extract day of week and day number
  // Pattern: "曜日 数字日" (e.g., "木 21日" or "月 1日")
  const match = text.match(/([月火水木金土日])\s*(\d+)日/);

  if (!match) {
    console.warn(`Failed to parse date cell: "${text}"`);
    return {
      date: text,
      dayOfWeek: null,
      dayNumber: null
    };
  }

  const dayOfWeek = match[1];
  const dayNumber = parseInt(match[2], 10);

  return {
    date: text, // Keep original format
    dayOfWeek,
    dayNumber
  };
}

/**
 * Extract shift value from cell
 * Handles multi-line content and special characters
 * @param {HTMLTableCellElement} cell - Shift cell element
 * @returns {string} Shift value
 */
function extractShiftValue(cell) {
  // Get text content, preserving line breaks
  let text = '';

  // Check if cell has HTML content (like <br> tags)
  if (cell.innerHTML.includes('<br>')) {
    // Replace <br> with newline and extract text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    text = tempDiv.textContent;
  } else {
    text = cell.textContent;
  }

  // Trim and normalize
  text = text.trim();

  // Normalize similar symbols
  text = normalizeShiftSymbol(text);

  return text;
}

/**
 * Normalize shift symbols to standard format
 * @param {string} symbol - Raw shift symbol
 * @returns {string} Normalized symbol
 */
function normalizeShiftSymbol(symbol) {
  if (!symbol) return '';

  // Normalize different variations of the same symbol
  const symbolMap = {
    '○': '○', // Full-width circle
    '◯': '○', // Circle outline → normalize to filled circle
    'o': '○', // Half-width o → full-width circle
    'O': '○', // Half-width O → full-width circle
    '×': '×', // Batsu (day off)
    'x': '×', // Half-width x → full-width batsu
    'X': '×', // Half-width X → full-width batsu
    '△': '△', // Sankaku (early shift)
    '◇': '◇', // Diamond (late shift)
    '●': '●', // Filled circle (holiday)
    '◎': '◎', // Double circle (special)
    '▣': '▣', // Filled square (backup)
    '★': '★', // Star (priority)
    '⊘': '⊘'  // Slashed circle (unavailable)
  };

  // First, check if it's a standard symbol
  if (symbolMap[symbol]) {
    return symbolMap[symbol];
  }

  // If it contains parentheses like "(4)", keep it as-is
  if (symbol.match(/^\([^)]+\)$/)) {
    return symbol;
  }

  // For multi-line content (e.g., "14:00\n16:30\nゆかり"), keep first line or whole text
  if (symbol.includes('\n')) {
    // If it looks like a time entry, keep the whole text
    if (symbol.match(/\d{1,2}:\d{2}/)) {
      return symbol;
    }
    // Otherwise, return the whole text
    return symbol;
  }

  // Return as-is for custom text
  return symbol;
}

/**
 * Detect period (month range) from schedule rows
 * @param {Array<Object>} rows - Schedule rows
 * @returns {Object|null} Period information
 */
function detectPeriod(rows) {
  if (rows.length === 0) return null;

  const firstDay = rows[0].dayNumber;
  const lastDay = rows[rows.length - 1].dayNumber;

  // Typical pattern: 21st to 20th of next month
  // If first day > last day, it spans two months
  const spansMonths = firstDay > lastDay;

  return {
    startDay: firstDay,
    endDay: lastDay,
    spansMonths,
    totalDays: rows.length
  };
}

/**
 * Build schedule data structure from parsed data
 * @param {Object} parsedData - Parsed schedule data
 * @param {Array<Object>} staffMembers - Staff members with IDs
 * @param {Array<Date>} dateRange - Date range for the period
 * @returns {Object} Schedule data in format { [staffId]: { [dateString]: shiftSymbol } }
 */
export function buildScheduleData(parsedData, staffMembers, dateRange) {
  const scheduleData = {};

  // Initialize schedule data for each staff member
  staffMembers.forEach(staff => {
    scheduleData[staff.id] = {};
  });

  // Map each row to dates in dateRange
  parsedData.rows.forEach((row, rowIndex) => {
    if (!dateRange[rowIndex]) {
      console.warn(`Row ${rowIndex}: No corresponding date in dateRange`);
      return;
    }

    const date = dateRange[rowIndex];
    const dateString = formatDateKey(date);

    // Map each shift to staff member
    row.shifts.forEach((shift, staffIndex) => {
      if (!staffMembers[staffIndex]) {
        console.warn(`Row ${rowIndex}, Staff ${staffIndex}: No corresponding staff member`);
        return;
      }

      const staffId = staffMembers[staffIndex].id;
      scheduleData[staffId][dateString] = shift;
    });
  });

  return scheduleData;
}

/**
 * Format date as YYYY-MM-DD string
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate parsed HTML schedule
 * @param {Object} parsedData - Parsed schedule data
 * @returns {Object} Validation result with errors/warnings
 */
export function validateParsedSchedule(parsedData) {
  const errors = [];
  const warnings = [];

  // Check for empty staff names
  if (parsedData.staffNames.length === 0) {
    errors.push('No staff names found');
  }

  // Check for empty schedule data
  if (parsedData.rows.length === 0) {
    errors.push('No schedule data found');
  }

  // Check consistency of shift count across rows
  const expectedShiftCount = parsedData.staffNames.length;
  parsedData.rows.forEach((row, index) => {
    if (row.shifts.length !== expectedShiftCount) {
      warnings.push(
        `Row ${index + 1} (${row.date}): Expected ${expectedShiftCount} shifts, got ${row.shifts.length}`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Parse HTML file from File object
 * @param {File} file - HTML file object
 * @returns {Promise<Object>} Parsed schedule data
 */
export async function parseHTMLFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const htmlContent = event.target.result;
        const parsedData = parseHTMLSchedule(htmlContent);
        resolve(parsedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

export default {
  parseHTMLSchedule,
  parseHTMLFile,
  buildScheduleData,
  validateParsedSchedule,
  normalizeShiftSymbol
};
