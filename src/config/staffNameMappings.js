/**
 * Staff Name Mapping Configuration
 *
 * Maps HTML column names to actual staff names in the database.
 * Used by the HTML schedule importer to handle name mismatches.
 *
 * Format: { "HTML Name": "Database Name" }
 */

export const staffNameMappings = {
  // Exact matches (no mapping needed, but listed for reference)
  "料理長": "料理長",
  "井関": "井関",
  "古藤": "古藤",
  "小池": "小池",
  "岸": "岸",
  "高野": "高野",
  "中田": "中田",

  // Mismatched names (require mapping)
  "織": "与儀",
  "由辺": "田辺",
  "カマレ": "カマル",
  "安井": "やすい"
};

/**
 * Reverse mapping: Database Name → HTML Name
 * Automatically generated from staffNameMappings
 */
export const reverseStaffNameMappings = Object.entries(staffNameMappings).reduce(
  (acc, [htmlName, dbName]) => {
    acc[dbName] = htmlName;
    return acc;
  },
  {}
);

/**
 * Get database name from HTML name
 * @param {string} htmlName - Name from HTML table
 * @returns {string} - Database name (mapped or original)
 */
export function getDatabaseName(htmlName) {
  return staffNameMappings[htmlName] || htmlName;
}

/**
 * Get HTML name from database name
 * @param {string} dbName - Name from database
 * @returns {string} - HTML name (mapped or original)
 */
export function getHTMLName(dbName) {
  return reverseStaffNameMappings[dbName] || dbName;
}

/**
 * Check if a name requires mapping
 * @param {string} htmlName - Name from HTML table
 * @returns {boolean} - True if mapping exists and differs from original
 */
export function requiresMapping(htmlName) {
  const mapped = staffNameMappings[htmlName];
  return mapped && mapped !== htmlName;
}

/**
 * Add a new name mapping (for runtime additions)
 * @param {string} htmlName - HTML column name
 * @param {string} dbName - Database staff name
 */
export function addNameMapping(htmlName, dbName) {
  staffNameMappings[htmlName] = dbName;
  reverseStaffNameMappings[dbName] = htmlName;
}

/**
 * Save custom mappings to localStorage for persistence
 */
export function saveCustomMappings() {
  const customMappings = {};

  // Extract only non-default mappings
  Object.entries(staffNameMappings).forEach(([htmlName, dbName]) => {
    if (htmlName !== dbName) {
      customMappings[htmlName] = dbName;
    }
  });

  localStorage.setItem('customStaffNameMappings', JSON.stringify(customMappings));
}

/**
 * Load custom mappings from localStorage
 */
export function loadCustomMappings() {
  try {
    const stored = localStorage.getItem('customStaffNameMappings');
    if (stored) {
      const customMappings = JSON.parse(stored);
      Object.entries(customMappings).forEach(([htmlName, dbName]) => {
        addNameMapping(htmlName, dbName);
      });
    }
  } catch (error) {
    console.error('Failed to load custom staff name mappings:', error);
  }
}

// Auto-load custom mappings on module import
loadCustomMappings();

export default staffNameMappings;
