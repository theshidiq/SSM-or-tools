/**
 * SettingsContext.jsx
 *
 * Provides settings state and actions to all components without prop drilling.
 * Solves infinite loop issue by providing stable references through context.
 *
 * Usage:
 * 1. Wrap app with <SettingsProvider>
 * 2. Use const { settings, updateSettings } = useSettings() in any component
 * 3. No prop drilling needed!
 */

import React, { createContext, useContext } from "react";
import { useSettingsData } from "../hooks/useSettingsData";

// Create context with undefined default (will error if used outside provider)
const SettingsContext = createContext(undefined);

/**
 * SettingsProvider - Wraps app to provide settings context
 *
 * @param {Object} props
 * @param {ReactNode} props.children - Child components
 * @param {boolean} props.autosaveEnabled - Enable autosave (default: true)
 */
export const SettingsProvider = ({ children, autosaveEnabled = true }) => {
  // Use existing useSettingsData hook - no logic duplication
  const settingsData = useSettingsData(autosaveEnabled);

  return (
    <SettingsContext.Provider value={settingsData}>
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * useSettings - Custom hook to consume settings context
 *
 * @throws {Error} If used outside SettingsProvider
 * @returns {Object} All settings data and actions from useSettingsData:
 *   - settings: Current settings object
 *   - updateSettings: Function to update settings
 *   - saveSettings: Function to save settings (localStorage mode)
 *   - resetToDefaults: Function to reset to defaults
 *   - isLoading: Loading state
 *   - error: Error state
 *   - validationErrors: Validation errors object
 *   - backendMode: 'websocket-multitable' or 'localStorage'
 *   - isConnectedToBackend: Boolean indicating connection status
 *   - And all other properties from useSettingsData
 */
export const useSettings = () => {
  const context = useContext(SettingsContext);

  if (context === undefined) {
    throw new Error(
      "useSettings must be used within a SettingsProvider. " +
        "Make sure your component is wrapped with <SettingsProvider>.",
    );
  }

  return context;
};

export default SettingsContext;
