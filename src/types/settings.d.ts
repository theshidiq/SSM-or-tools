// Settings System Type Definitions
// This file defines all types used in the settings system

export interface StaffGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  members: string[]; // Array of staff IDs
  coverageRules: {
    minimumCoverage: number;
    backupRequired: boolean;
    backupStaffIds: string[];
  };
}

export interface DailyLimit {
  id: string;
  name: string;
  description: string;
  shiftType: 'early' | 'late' | 'off' | 'any';
  maxCount: number;
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  scope: 'all' | 'position' | 'group' | 'individual';
  targetIds: string[]; // IDs based on scope type
  isHardConstraint: boolean;
  penaltyWeight: number;
}

export interface MonthlyLimit {
  id: string;
  name: string;
  description: string;
  limitType: 'max_off_days' | 'max_shifts' | 'shift_distribution';
  maxCount: number;
  scope: 'all' | 'position' | 'group' | 'individual';
  targetIds: string[];
  distributionRules: {
    minDaysBetween: number;
    maxConsecutive: number;
    preferWeekends: boolean;
  };
  isHardConstraint: boolean;
  penaltyWeight: number;
}

export interface ConflictRule {
  id: string;
  name: string;
  type: 'group_conflict' | 'individual_conflict' | 'position_conflict';
  involvedGroups?: string[];
  involvedStaff?: string[];
  involvedPositions?: string[];
  constraint: 'cannot_work_same_shift' | 'minimum_gap' | 'maximum_together';
  shiftTypes?: string[];
  minimumGapDays?: number;
  isHardConstraint: boolean;
  penaltyWeight: number;
}

export interface PriorityRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'preferred_shift' | 'avoid_shift' | 'required_off';
  staffId: string;
  shiftType?: 'early' | 'late' | 'off';
  daysOfWeek: number[];
  priorityLevel: 1 | 2 | 3 | 4 | 5; // 1 = low, 5 = critical
  preferenceStrength: number; // 0.1 to 1.0
  isHardConstraint: boolean;
  penaltyWeight: number;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  isActive: boolean;
}

export interface MLParameters {
  algorithm: 'genetic_algorithm' | 'simulated_annealing' | 'constraint_satisfaction' | 'neural_network';
  
  // Genetic Algorithm Parameters
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  elitismRate: number;
  
  // Simulated Annealing Parameters (optional)
  initialTemperature?: number;
  coolingRate?: number;
  
  // Common Parameters
  convergenceThreshold: number;
  confidenceThreshold: number;
  maxRuntime: number; // in seconds
  
  // Advanced Options
  enableAdaptiveMutation: boolean;
  enableElitismDiversity: boolean;
  parallelProcessing: boolean;
  randomSeed: number | null;
}

// Note: Constraint weights are now auto-detected from actual settings
// No need for manual constraint weight configuration

export interface SettingsConfiguration {
  staffGroups: StaffGroup[];
  dailyLimits: DailyLimit[];
  monthlyLimits: MonthlyLimit[];
  priorityRules: PriorityRule[];
  conflictRules: ConflictRule[];
  mlParameters: MLParameters;
  // Note: Constraint weights and penalties are now auto-detected
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ConfigVersion {
  id: string;
  restaurant_id: string;
  version_number: number;
  name: string;
  description: string;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
  is_locked: boolean;
}

export interface ConfigChange {
  id: string;
  version_id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
}

export interface ValidationErrors {
  [key: string]: string;
}

export interface UseSettingsDataReturn {
  // State
  settings: SettingsConfiguration;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  validationErrors: ValidationErrors;
  configHistory: ConfigVersion[];
  
  // Actions
  updateSettings: (newSettings: SettingsConfiguration) => void;
  saveSettings: (settingsToSave?: SettingsConfiguration) => Promise<{ success: boolean; version: string }>;
  loadSettings: () => Promise<void>;
  resetToDefaults: () => void;
  exportConfiguration: () => string;
  importConfiguration: (configJson: string) => { success: boolean; error?: string };
  loadConfigHistory: () => Promise<ConfigVersion[]>;
  
  // Utilities
  validateSettings: (settingsToValidate: SettingsConfiguration) => ValidationErrors;
}

// Component Props Types
export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: SettingsConfiguration) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  settings: SettingsConfiguration;
  onSettingsChange: (settings: SettingsConfiguration) => void;
  staffMembers?: Array<{ id: string; name: string; position?: string }>;
  onExportConfig: () => void;
  onImportConfig: () => void;
  onResetConfig: () => void;
  onShowHistory: () => void;
  validationErrors?: ValidationErrors;
  hasUnsavedChanges?: boolean;
}

export interface TabComponentProps {
  settings: SettingsConfiguration;
  onSettingsChange: (settings: SettingsConfiguration) => void;
  staffMembers?: Array<{ id: string; name: string; position?: string }>;
  validationErrors?: ValidationErrors;
}

// Shared UI Component Props
export interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  showValue?: boolean;
  unit?: string;
  description?: string;
  error?: string;
  className?: string;
  colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

export interface ToggleSwitchProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
  size?: 'small' | 'medium' | 'large';
  colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  showLabels?: boolean;
  onLabel?: string;
  offLabel?: string;
}

export interface NumberInputProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
  unit?: string;
  error?: string;
  description?: string;
  showControls?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export interface FormFieldProps {
  label?: string;
  children: React.ReactNode;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

export interface TabButtonProps {
  id: string;
  label: string;
  icon: string;
  isActive?: boolean;
  onClick: (id: string) => void;
  hasErrors?: boolean;
  keyboardShortcut?: string | null;
  disabled?: boolean;
}