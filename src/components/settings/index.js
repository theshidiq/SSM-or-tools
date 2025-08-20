// Settings System - Component Exports
// Centralized export for all settings-related components

// Main Settings Modal
export { default as SettingsModal } from "./SettingsModal";

// Tab Components
export { default as StaffGroupsTab } from "./tabs/StaffGroupsTab";
export { default as DailyLimitsTab } from "./tabs/DailyLimitsTab";
export { default as PriorityRulesTab } from "./tabs/PriorityRulesTab";
export { default as MLParametersTab } from "./tabs/MLParametersTab";

// Shared UI Components
export { default as TabButton } from "./shared/TabButton";
export { default as Slider } from "./shared/Slider";
export { default as ToggleSwitch } from "./shared/ToggleSwitch";
export { default as NumberInput } from "./shared/NumberInput";
export { default as FormField } from "./shared/FormField";

// Hooks
export { useSettingsData } from "../../hooks/useSettingsData";
