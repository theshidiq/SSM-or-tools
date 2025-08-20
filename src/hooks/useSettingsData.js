import { useState, useEffect, useCallback } from "react";
import { configService } from "../services/ConfigurationService";
import { useAutosave } from "./useAutosave";

export const useSettingsData = (autosaveEnabled = true) => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(autosaveEnabled);

  // Load settings from localStorage via configService
  const loadSettings = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const loadedSettings = configService.getSettings();
      setSettings(loadedSettings);
      setHasUnsavedChanges(false);
      setValidationErrors({});
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings via configService
  const saveSettings = useCallback(
    async (settingsToSave = settings, skipLoadingState = false) => {
      try {
        if (!skipLoadingState) {
          setIsLoading(true);
        }
        setError(null);

        // Validate settings before saving
        const validation = configService.validateSettings(settingsToSave);
        if (!validation.isValid) {
          setValidationErrors(validation.errors);
          throw new Error("Validation errors found");
        }

        // Save settings
        const success = await configService.saveSettings(settingsToSave);
        if (!success) {
          throw new Error("Failed to save settings");
        }

        setSettings(settingsToSave);
        setHasUnsavedChanges(false);
        setValidationErrors({});

        return { success: true };
      } catch (err) {
        console.error("Failed to save settings:", err);
        setError(err.message);
        throw err;
      } finally {
        if (!skipLoadingState) {
          setIsLoading(false);
        }
      }
    },
    [settings],
  );

  // Update settings with change tracking
  const updateSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    setHasUnsavedChanges(true);

    // Clear validation errors when settings change
    setValidationErrors({});
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    try {
      setIsLoading(true);
      await configService.resetToDefaults();
      const defaultSettings = configService.getSettings();
      setSettings(defaultSettings);
      setHasUnsavedChanges(false); // Reset syncs automatically
      setValidationErrors({});
    } catch (err) {
      console.error("Failed to reset to defaults:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Export configuration
  const exportConfiguration = useCallback(() => {
    try {
      return configService.exportSettings();
    } catch (err) {
      console.error("Failed to export configuration:", err);
      throw err;
    }
  }, []);

  // Import configuration
  const importConfiguration = useCallback(
    (configJson) => {
      try {
        const result = configService.importSettings(configJson);
        if (!result.success) {
          throw new Error(result.error);
        }

        // Reload settings after import
        loadSettings();
        return { success: true };
      } catch (err) {
        setError("Failed to import configuration: " + err.message);
        return { success: false, error: err.message };
      }
    },
    [loadSettings],
  );

  // Autosave functionality
  const autosaveSettings = useCallback(
    async (settingsToSave) => {
      return await saveSettings(settingsToSave, true); // Skip loading state for autosave
    },
    [saveSettings],
  );

  const {
    isAutosaving,
    lastSaveTime,
    saveError: autosaveError,
    saveNow: saveNowAutosave,
    cancelAutosave,
  } = useAutosave(autosaveSettings, settings, {
    delay: 400, // 400ms debounce
    enabled: isAutosaveEnabled, // Remove hasUnsavedChanges condition to fix autosave logic
    onSaveSuccess: () => {
      console.log("Settings autosaved successfully");
    },
    onSaveError: (error) => {
      console.warn("Autosave failed:", error);
    },
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    // State
    settings,
    isLoading,
    error,
    hasUnsavedChanges,
    validationErrors,

    // Autosave state
    isAutosaving,
    lastSaveTime,
    autosaveError,
    isAutosaveEnabled,

    // Actions
    updateSettings,
    saveSettings,
    loadSettings,
    resetToDefaults,
    exportConfiguration,
    importConfiguration,

    // Autosave controls
    setIsAutosaveEnabled,
    saveNowAutosave,
    cancelAutosave,

    // Utilities
    validateSettings: (settingsToValidate) =>
      configService.validateSettings(settingsToValidate),
  };
};
