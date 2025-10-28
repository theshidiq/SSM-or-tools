/**
 * Staff Name Mapper
 *
 * Maps HTML staff names to database staff IDs using a 3-tier matching system:
 * 1. Exact Match - Direct string comparison
 * 2. Configurable Mapping - Predefined name mappings
 * 3. Interactive Resolution - Return unmatched for manual mapping
 */

import { getDatabaseName, staffNameMappings } from '../config/staffNameMappings';

/**
 * Match result for a single staff name
 * @typedef {Object} MatchResult
 * @property {string} htmlName - Original name from HTML
 * @property {string|null} staffId - Matched staff ID (null if unmatched)
 * @property {Object|null} staff - Full staff object (null if unmatched)
 * @property {string} matchType - Type of match: 'exact', 'mapped', 'unmatched'
 * @property {string|null} mappedName - Database name after mapping (null if exact match)
 */

/**
 * Match staff names from HTML to database staff members
 * Uses 3-tier matching system
 *
 * @param {Array<string>} htmlNames - Staff names from HTML table
 * @param {Array<Object>} staffMembers - Staff members from database
 * @returns {Object} Matching results
 */
export function matchStaffNames(htmlNames, staffMembers) {
  const matched = [];
  const unmatched = [];

  htmlNames.forEach((htmlName, index) => {
    const result = matchSingleStaffName(htmlName, staffMembers, index);

    if (result.staffId) {
      matched.push(result);
    } else {
      unmatched.push(result);
    }
  });

  return {
    matched,
    unmatched,
    summary: {
      total: htmlNames.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      matchRate: htmlNames.length > 0 ? (matched.length / htmlNames.length) * 100 : 0
    }
  };
}

/**
 * Match a single staff name to database staff member
 *
 * @param {string} htmlName - Staff name from HTML
 * @param {Array<Object>} staffMembers - Staff members from database
 * @param {number} columnIndex - Column index in HTML table
 * @returns {MatchResult} Match result
 */
function matchSingleStaffName(htmlName, staffMembers, columnIndex = 0) {
  // TIER 1: Exact Match
  const exactMatch = staffMembers.find(staff => staff.name === htmlName);
  if (exactMatch) {
    return {
      htmlName,
      staffId: exactMatch.id,
      staff: exactMatch,
      matchType: 'exact',
      mappedName: null,
      columnIndex
    };
  }

  // TIER 2: Configurable Mapping
  const mappedName = getDatabaseName(htmlName);
  if (mappedName !== htmlName) {
    // A mapping exists, try to find staff with mapped name
    const mappedMatch = staffMembers.find(staff => staff.name === mappedName);
    if (mappedMatch) {
      return {
        htmlName,
        staffId: mappedMatch.id,
        staff: mappedMatch,
        matchType: 'mapped',
        mappedName,
        columnIndex
      };
    }

    // Mapping exists but staff not found in database
    console.warn(
      `Mapping exists for "${htmlName}" → "${mappedName}", but staff not found in database`
    );
  }

  // TIER 3: Unmatched (for manual resolution)
  return {
    htmlName,
    staffId: null,
    staff: null,
    matchType: 'unmatched',
    mappedName: null,
    columnIndex,
    suggestions: findSimilarStaffNames(htmlName, staffMembers)
  };
}

/**
 * Find similar staff names for suggestions
 * Uses fuzzy matching based on character similarity
 *
 * @param {string} htmlName - Staff name from HTML
 * @param {Array<Object>} staffMembers - Staff members from database
 * @returns {Array<Object>} Suggested staff members with similarity scores
 */
function findSimilarStaffNames(htmlName, staffMembers) {
  const suggestions = staffMembers.map(staff => {
    const similarity = calculateSimilarity(htmlName, staff.name);
    return {
      staff,
      similarity
    };
  });

  // Sort by similarity (highest first) and return top 3
  return suggestions
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .filter(s => s.similarity > 0.3) // Only suggest if similarity > 30%
    .map(s => ({
      ...s.staff,
      similarity: s.similarity
    }));
}

/**
 * Calculate similarity between two strings
 * Uses Levenshtein distance normalized by string length
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1, where 1 is identical)
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Create ordered staff array from match results
 * Preserves the order from HTML table columns
 *
 * @param {Array<MatchResult>} matchResults - Match results (only matched items)
 * @returns {Array<Object>} Ordered staff members
 */
export function createOrderedStaffArray(matchResults) {
  return matchResults
    .sort((a, b) => a.columnIndex - b.columnIndex)
    .map(result => result.staff);
}

/**
 * Apply manual mapping and update match results
 *
 * @param {Array<MatchResult>} unmatchedResults - Unmatched results to resolve
 * @param {Object} manualMappings - Manual mappings { htmlName: staffId }
 * @param {Array<Object>} staffMembers - Staff members from database
 * @returns {Array<MatchResult>} Resolved match results
 */
export function applyManualMappings(unmatchedResults, manualMappings, staffMembers) {
  return unmatchedResults.map(result => {
    const mappedStaffId = manualMappings[result.htmlName];
    if (!mappedStaffId) {
      return result; // Still unmatched
    }

    const staff = staffMembers.find(s => s.id === mappedStaffId);
    if (!staff) {
      console.warn(`Manual mapping: Staff ID ${mappedStaffId} not found`);
      return result;
    }

    return {
      ...result,
      staffId: staff.id,
      staff,
      matchType: 'manual',
      mappedName: staff.name
    };
  });
}

/**
 * Get match statistics for reporting
 *
 * @param {Object} matchResults - Results from matchStaffNames
 * @returns {Object} Statistics
 */
export function getMatchStatistics(matchResults) {
  const { matched, unmatched } = matchResults;

  const exactMatches = matched.filter(m => m.matchType === 'exact').length;
  const mappedMatches = matched.filter(m => m.matchType === 'mapped').length;
  const manualMatches = matched.filter(m => m.matchType === 'manual').length;

  return {
    total: matched.length + unmatched.length,
    matched: matched.length,
    unmatched: unmatched.length,
    breakdown: {
      exact: exactMatches,
      mapped: mappedMatches,
      manual: manualMatches
    },
    matchRate: matchResults.summary.matchRate
  };
}

/**
 * Validate that all staff names can be matched
 *
 * @param {Array<string>} htmlNames - Staff names from HTML
 * @param {Array<Object>} staffMembers - Staff members from database
 * @returns {Object} Validation result
 */
export function validateStaffMatching(htmlNames, staffMembers) {
  const matchResults = matchStaffNames(htmlNames, staffMembers);
  const { matched, unmatched } = matchResults;

  const errors = [];
  const warnings = [];

  if (unmatched.length > 0) {
    errors.push({
      type: 'UNMATCHED_STAFF',
      message: `${unmatched.length} staff name(s) could not be matched`,
      details: unmatched.map(u => ({
        htmlName: u.htmlName,
        suggestions: u.suggestions.map(s => s.name)
      }))
    });
  }

  // Check for duplicate mappings
  const staffIdCounts = {};
  matched.forEach(m => {
    staffIdCounts[m.staffId] = (staffIdCounts[m.staffId] || 0) + 1;
  });

  Object.entries(staffIdCounts).forEach(([staffId, count]) => {
    if (count > 1) {
      const staff = matched.find(m => m.staffId === staffId).staff;
      warnings.push({
        type: 'DUPLICATE_MAPPING',
        message: `Staff "${staff.name}" (${staffId}) is mapped ${count} times`,
        staffName: staff.name,
        count
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    matchResults
  };
}

/**
 * Export current mappings for backup/sharing
 *
 * @returns {Object} Exportable mappings
 */
export function exportMappings() {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    mappings: { ...staffNameMappings }
  };
}

/**
 * Import mappings from exported data
 *
 * @param {Object} importedData - Exported mapping data
 * @returns {boolean} Success status
 */
export function importMappings(importedData) {
  try {
    if (!importedData.mappings) {
      throw new Error('Invalid import data: missing mappings');
    }

    Object.entries(importedData.mappings).forEach(([htmlName, dbName]) => {
      staffNameMappings[htmlName] = dbName;
    });

    return true;
  } catch (error) {
    console.error('Failed to import mappings:', error);
    return false;
  }
}

export default {
  matchStaffNames,
  matchSingleStaffName,
  createOrderedStaffArray,
  applyManualMappings,
  getMatchStatistics,
  validateStaffMatching,
  exportMappings,
  importMappings
};
