/**
 * Priority Rule Type Definitions
 *
 * Defines types for the Priority Rules system which allows configuring
 * staff shift preferences, avoidances, and requirements.
 */

export type ShiftType = "early" | "late" | "off";

export type RuleType =
  | "preferred_shift"
  | "avoid_shift"
  | "required_off"
  | "avoid_shift_with_exceptions";  // NEW: Avoid certain shifts but allow exceptions

export interface PriorityRule {
  id: string;
  name: string;
  description: string;
  ruleType: RuleType;

  // Primary shift target
  shiftType: ShiftType;

  /**
   * NEW: Exception shifts (only for avoid_shift_with_exceptions)
   * Example: Avoid "off" but allow ["early", "late"]
   */
  allowedShifts?: ShiftType[];

  // Staff and time constraints
  staffIds: string[];
  daysOfWeek: number[];  // 0=Sunday, 6=Saturday

  // Priority and penalty
  priorityLevel: number;
  preferenceStrength: number;
  isHardConstraint: boolean;
  penaltyWeight: number;

  // Temporal constraints
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  isActive: boolean;

  // Metadata
  _isLocalOnly?: boolean;  // UI-only flag for unsaved rules
}

/**
 * Shift Type Configuration
 * Maps shift types to their display properties
 */
export interface ShiftTypeConfig {
  id: ShiftType;
  label: string;
  icon: string;
  description: string;
}

/**
 * Rule Type Configuration
 * Maps rule types to their display properties and behavior
 */
export interface RuleTypeConfig {
  id: RuleType;
  label: string;
  icon: string;
  description: string;
  helpText?: string;
  supportsExceptions?: boolean;  // NEW: Whether this rule type supports exception shifts
}

/**
 * Validation result for priority rules
 */
export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
