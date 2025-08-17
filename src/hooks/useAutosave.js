import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Custom hook for debounced autosave functionality
 * @param {Function} saveFunction - Function to call for saving
 * @param {any} data - Data to save (when it changes, autosave triggers)
 * @param {Object} options - Configuration options
 * @param {number} options.delay - Delay in milliseconds before saving (default: 500)
 * @param {boolean} options.enabled - Whether autosave is enabled (default: true)
 * @param {Function} options.onSaveStart - Callback when save starts
 * @param {Function} options.onSaveSuccess - Callback when save succeeds
 * @param {Function} options.onSaveError - Callback when save fails
 */
export const useAutosave = (saveFunction, data, options = {}) => {
  const {
    delay = 500,
    enabled = true,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  } = options;

  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const timeoutRef = useRef(null);
  const lastDataRef = useRef(data);
  const saveInProgressRef = useRef(false);

  const performSave = useCallback(async () => {
    if (!enabled || saveInProgressRef.current || !saveFunction) {
      return;
    }

    try {
      saveInProgressRef.current = true;
      setIsAutosaving(true);
      setSaveError(null);

      if (onSaveStart) {
        onSaveStart();
      }

      await saveFunction(data);

      setLastSaveTime(new Date());
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (error) {
      console.error("Autosave failed:", error);
      setSaveError(error.message || "Save failed");
      if (onSaveError) {
        onSaveError(error);
      }
    } finally {
      setIsAutosaving(false);
      saveInProgressRef.current = false;
    }
  }, [data, enabled, saveFunction, onSaveStart, onSaveSuccess, onSaveError]);

  const debouncedSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      performSave();
    }, delay);
  }, [performSave, delay]);

  // Trigger autosave when data changes
  useEffect(() => {
    if (!enabled || !data) {
      return;
    }

    // Check if data actually changed (deep comparison for objects)
    const dataChanged =
      JSON.stringify(data) !== JSON.stringify(lastDataRef.current);

    if (dataChanged && lastDataRef.current !== null) {
      debouncedSave();
    }

    lastDataRef.current = data;
  }, [data, enabled, debouncedSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Manual save function (bypasses debounce)
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  // Cancel pending autosave
  const cancelAutosave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    isAutosaving,
    lastSaveTime,
    saveError,
    saveNow,
    cancelAutosave,
  };
};

export default useAutosave;
