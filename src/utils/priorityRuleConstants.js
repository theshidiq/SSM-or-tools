/**
 * Priority Rule Constants
 *
 * Shared constants for shift types, rule types, and their configurations
 */

/**
 * Shift Type Definitions
 */
export const SHIFT_TYPES = [
  {
    id: "early",
    label: "Early Shift",
    icon: "△",
    description: "Morning/early shift"
  },
  {
    id: "late",
    label: "Late Shift",
    icon: "◇",
    description: "Evening/late shift"
  },
  {
    id: "off",
    label: "Off Day",
    icon: "×",
    description: "Day off / no work"
  }
];

/**
 * Rule Type Definitions
 */
export const RULE_TYPES = [
  {
    id: "preferred_shift",
    label: "Preferred Shift",
    icon: "⭐",
    description: "Staff member prefers specific shifts on certain days",
    helpText: "Example: Prefer early shifts (△) on weekdays",
    supportsExceptions: false
  },
  {
    id: "avoid_shift",
    label: "Avoid Shift",
    icon: "❌",
    description: "Staff member wants to avoid specific shifts on certain days",
    helpText: "Example: Avoid off days (×) on weekends",
    supportsExceptions: false
  },
  {
    id: "required_off",
    label: "Required Off",
    icon: "🏠",
    description: "Staff member must be off on specific days",
    helpText: "Example: Must be off every Sunday",
    supportsExceptions: false
  },
  {
    id: "avoid_shift_with_exceptions",
    label: "Avoid Shift (with Exceptions)",
    icon: "🚫✅",
    description: "Avoid specific shift but allow certain exceptions",
    helpText: "Example: Avoid off days (×) but allow early shifts (△) on weekends",
    supportsExceptions: true
  }
];

/**
 * Get shift type configuration by ID
 * @param {string} shiftTypeId - The shift type ID
 * @returns {Object|null} Shift type configuration or null if not found
 */
export const getShiftType = (shiftTypeId) => {
  return SHIFT_TYPES.find(type => type.id === shiftTypeId) || null;
};

/**
 * Get rule type configuration by ID
 * @param {string} ruleTypeId - The rule type ID
 * @returns {Object|null} Rule type configuration or null if not found
 */
export const getRuleType = (ruleTypeId) => {
  return RULE_TYPES.find(type => type.id === ruleTypeId) || null;
};

/**
 * Check if a rule type supports exception shifts
 * @param {string} ruleTypeId - The rule type ID
 * @returns {boolean} True if rule type supports exceptions
 */
export const supportsExceptions = (ruleTypeId) => {
  const ruleType = getRuleType(ruleTypeId);
  return ruleType?.supportsExceptions || false;
};

/**
 * Get available exception shifts for a given avoided shift
 * (All shifts except the one being avoided)
 * @param {string} avoidedShift - The shift type being avoided
 * @returns {Array} Array of available exception shift types
 */
export const getAvailableExceptionShifts = (avoidedShift) => {
  return SHIFT_TYPES.filter(shift => shift.id !== avoidedShift);
};

/**
 * Map shift type ID to schedule symbol
 * @param {string} shiftTypeId - The shift type ID
 * @returns {string} Schedule symbol (△, ◇, ×)
 */
export const mapShiftTypeToSymbol = (shiftTypeId) => {
  const shiftType = getShiftType(shiftTypeId);
  return shiftType?.icon || "";
};

/**
 * Map schedule symbol to shift type ID
 * @param {string} symbol - The schedule symbol (△, ◇, ×)
 * @returns {string|null} Shift type ID or null if not found
 */
export const mapSymbolToShiftType = (symbol) => {
  const shiftType = SHIFT_TYPES.find(type => type.icon === symbol);
  return shiftType?.id || null;
};
