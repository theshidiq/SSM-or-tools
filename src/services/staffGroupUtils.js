/**
 * Staff Group Utilities
 * Provides functions for managing staff conflict groups
 */

/**
 * Get staff conflict groups from stored settings
 * @returns {Promise<Array>} Array of staff conflict groups
 */
export async function getStaffConflictGroups() {
  try {
    // Try to get from localStorage first
    const stored = localStorage.getItem('staffConflictGroups');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.warn('[staffGroupUtils] Error loading staff conflict groups:', error);
    return [];
  }
}

/**
 * Save staff conflict groups
 * @param {Array} groups - Array of staff conflict groups to save
 */
export function saveStaffConflictGroups(groups) {
  try {
    localStorage.setItem('staffConflictGroups', JSON.stringify(groups));
  } catch (error) {
    console.warn('[staffGroupUtils] Error saving staff conflict groups:', error);
  }
}
