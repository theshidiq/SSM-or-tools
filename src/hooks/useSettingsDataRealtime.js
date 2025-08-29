/**
 * Supabase-first Real-time Settings Management Hook - Phase 3 Implementation
 * Extends the proven Supabase-first architecture to system settings management
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../utils/supabase";

// Query keys for React Query cache management
export const SETTINGS_QUERY_KEYS = {
  settings: ['settings'],
  settingsById: (settingsId) => ['settings', settingsId],
};

// Default settings structure (moved from ConfigurationService)
const getDefaultSettings = () => ({
  // Migration version
  migrationVersion: 3,
  
  // Staff Groups
  staffGroups: [
    {
      id: "group1",
      name: "Group 1",
      members: ["料理長", "井関"],
      color: "#3B82F6",
    },
    {
      id: "group2",
      name: "Group 2", 
      members: ["料理長", "古藤"],
      color: "#EF4444",
    },
    {
      id: "group3",
      name: "Group 3",
      members: ["井関", "小池"],
      color: "#10B981",
    },
    {
      id: "group4",
      name: "Group 4",
      members: ["田辺", "小池"],
      color: "#F59E0B",
    },
    {
      id: "group5",
      name: "Group 5",
      members: ["古藤", "岸"],
      color: "#8B5CF6",
    },
    {
      id: "group6",
      name: "Group 6",
      members: ["与儀", "カマル"],
      color: "#EC4899",
    },
    {
      id: "group7",
      name: "Group 7",
      members: ["カマル", "高野"],
      color: "#06B6D4",
    },
    {
      id: "group8",
      name: "Group 8",
      members: ["高野", "派遣スタッフ"],
      color: "#84CC16",
    },
  ],
  
  // Daily Limits
  dailyLimits: [
    {
      id: "daily-limit-off",
      name: "Maximum Off Days",
      shiftType: "off",
      maxCount: 4,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      scope: "all",
      targetIds: [],
      isHardConstraint: true,
      penaltyWeight: 50,
      description: "Maximum number of staff that can be off per day",
    },
    {
      id: "daily-limit-early",
      name: "Maximum Early Shifts",
      shiftType: "early",
      maxCount: 4,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      scope: "all",
      targetIds: [],
      isHardConstraint: false,
      penaltyWeight: 30,
      description: "Maximum number of staff on early shifts per day",
    },
    {
      id: "daily-limit-late",
      name: "Maximum Late Shifts",
      shiftType: "late",
      maxCount: 3,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      scope: "all",
      targetIds: [],
      isHardConstraint: false,
      penaltyWeight: 30,
      description: "Maximum number of staff on late shifts per day",
    },
    {
      id: "daily-limit-min-working",
      name: "Minimum Working Staff",
      shiftType: "any",
      maxCount: 3,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      scope: "all",
      targetIds: [],
      isHardConstraint: true,
      penaltyWeight: 100,
      description: "Minimum number of staff required to work per day",
    },
  ],
  
  // Priority Rules
  priorityRules: [],
  
  // ML Parameters
  mlParameters: {
    model_name: "genetic_algorithm",
    model_type: "genetic_algorithm",
    parameters: {
      populationSize: 100,
      generations: 300,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      elitismRate: 0.1,
      convergenceThreshold: 0.001,
      maxRuntime: 300,
      enableAdaptiveMutation: true,
      parallelProcessing: true,
      targetAccuracy: 0.85,
    },
    confidence_threshold: 0.75,
  },
  
  // Monthly Limits
  monthlyLimits: [
    {
      id: "monthly-limit-off-days",
      name: "Maximum Off Days Per Month",
      limitType: "max_off_days",
      maxCount: 8,
      scope: "individual",
      targetIds: [],
      distributionRules: {
        maxConsecutive: 2,
        preferWeekends: false,
      },
      isHardConstraint: false,
      penaltyWeight: 40,
      description: "Maximum number of days off allowed per staff member per month",
    },
  ],
  
  // Backup Assignments
  backupAssignments: [],
});

export const useSettingsDataRealtime = () => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(true);
  
  // Auto-save refs for debouncing
  const autoSaveTimeoutRef = useRef(null);

  // Connection check query
  const { data: connectionStatus } = useQuery({
    queryKey: ['supabase', 'settings-connection'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("count")
          .limit(1);
        
        if (error) throw error;
        
        setIsConnected(true);
        setError(null);
        return { connected: true };
      } catch (err) {
        setIsConnected(false);
        setError(err.message);
        return { connected: false, error: err.message };
      }
    },
    refetchInterval: 30000, // Check connection every 30 seconds
    refetchOnWindowFocus: true,
  });

  /**
   * Load settings from Supabase
   */
  const { 
    data: supabaseSettingsData, 
    isLoading: isSupabaseLoading, 
    error: queryError,
    refetch: refetchSettings
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.settings,
    queryFn: async () => {
      console.log("🔍 Loading settings from Supabase...");
      
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const settingsRecord = data?.[0] || null;
      console.log(`📊 Settings loaded:`, settingsRecord ? 'Found' : 'Not found');
      
      return settingsRecord;
    },
    enabled: isConnected, // Only run query when connected
    staleTime: 5000, // Consider data stale after 5 seconds for real-time feel
  });

  /**
   * Save settings mutation with optimistic updates
   */
  const saveSettingsMutation = useMutation({
    mutationFn: async ({ settings, operation }) => {
      console.log(`💾 Saving settings to Supabase (${operation})`);
      
      const settingsForSave = {
        settings_data: settings,
        updated_at: new Date().toISOString(),
      };

      if (supabaseSettingsData?.id) {
        // Update existing settings
        const { data, error } = await supabase
          .from("app_settings")
          .update(settingsForSave)
          .eq("id", supabaseSettingsData.id)
          .select();

        if (error) throw error;
        
        console.log("✅ Settings updated in Supabase");
        return data[0];
      } else {
        // Create new settings record
        const { data, error } = await supabase
          .from("app_settings")
          .insert([{
            ...settingsForSave,
            created_at: new Date().toISOString(),
          }])
          .select();

        if (error) throw error;
        
        console.log("✅ New settings created in Supabase");
        return data[0];
      }
    },
    onMutate: async ({ settings, operation }) => {
      // Cancel outgoing refetches to prevent overriding optimistic update
      const queryKey = SETTINGS_QUERY_KEYS.settings;
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previousSettings = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (old) => ({
        ...old,
        settings_data: settings,
        updated_at: new Date().toISOString(),
      }));

      console.log(`⚡ Optimistic settings update: ${operation}`);

      // Clear unsaved changes flag since we're saving
      setHasUnsavedChanges(false);
      setValidationErrors({});

      // Return context with snapshot for rollback
      return { previousSettings, queryKey };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(context.queryKey, context.previousSettings);
      }
      
      // Restore unsaved changes flag
      setHasUnsavedChanges(true);
      setError(`Settings save failed: ${err.message}`);
      console.error("❌ Settings save failed:", err);
    },
    onSuccess: (data, variables, context) => {
      // Update cache with server response
      queryClient.setQueryData(context.queryKey, data);
      
      setError(null); // Clear any previous errors
      setHasUnsavedChanges(false);
      console.log("✅ Settings saved successfully to Supabase");
    }
  });

  /**
   * Partial settings update mutation for individual sections
   */
  const updateSettingsSectionMutation = useMutation({
    mutationFn: async ({ sectionName, sectionData, operation }) => {
      console.log(`🔄 Updating settings section: ${sectionName} (${operation})`);
      
      const currentSettings = settings;
      const updatedSettings = {
        ...currentSettings,
        [sectionName]: sectionData,
      };

      return await saveSettingsMutation.mutateAsync({ 
        settings: updatedSettings, 
        operation 
      });
    },
  });

  // Computed settings with fallback to defaults
  const settings = useMemo(() => {
    if (supabaseSettingsData?.settings_data) {
      return supabaseSettingsData.settings_data;
    }
    
    // Fallback to defaults if no Supabase data
    if (!isSupabaseLoading && isConnected) {
      return getDefaultSettings();
    }
    
    return getDefaultSettings();
  }, [supabaseSettingsData, isSupabaseLoading, isConnected]);

  /**
   * Auto-save with debouncing
   */
  const scheduleAutoSave = useCallback((settingsData, operation = 'auto-save') => {
    if (!isAutosaveEnabled) return;
    
    clearTimeout(autoSaveTimeoutRef.current);
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (isConnected && settingsData) {
        saveSettingsMutation.mutate({ 
          settings: settingsData, 
          operation 
        });
      }
    }, 1000); // 1 second debounce
  }, [saveSettingsMutation, isConnected, isAutosaveEnabled]);

  /**
   * Validate settings structure
   */
  const validateSettings = useCallback((settingsToValidate) => {
    const errors = {};
    let isValid = true;

    // Validate staff groups
    if (!Array.isArray(settingsToValidate.staffGroups)) {
      errors.staffGroups = "Staff groups must be an array";
      isValid = false;
    }

    // Validate daily limits
    if (!Array.isArray(settingsToValidate.dailyLimits)) {
      errors.dailyLimits = "Daily limits must be an array";
      isValid = false;
    }

    // Validate ML parameters
    if (!settingsToValidate.mlParameters || typeof settingsToValidate.mlParameters !== 'object') {
      errors.mlParameters = "ML parameters must be an object";
      isValid = false;
    }

    return { isValid, errors };
  }, []);

  /**
   * Public API methods
   */
  const updateSettings = useCallback((newSettings) => {
    setHasUnsavedChanges(true);
    setValidationErrors({});
    
    // Update cache optimistically
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.settings, (old) => ({
      ...old,
      settings_data: newSettings,
      updated_at: new Date().toISOString(),
    }));
    
    // Schedule auto-save if enabled
    if (isAutosaveEnabled) {
      scheduleAutoSave(newSettings, 'update');
    }
  }, [queryClient, isAutosaveEnabled, scheduleAutoSave]);

  const saveSettings = useCallback(async (settingsToSave = settings, skipLoadingState = false) => {
    const validation = validateSettings(settingsToSave);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      throw new Error("Validation errors found");
    }

    return await saveSettingsMutation.mutateAsync({ 
      settings: settingsToSave, 
      operation: 'manual-save' 
    });
  }, [settings, validateSettings, saveSettingsMutation]);

  const resetToDefaults = useCallback(async () => {
    const defaultSettings = getDefaultSettings();
    await saveSettingsMutation.mutateAsync({ 
      settings: defaultSettings, 
      operation: 'reset-defaults' 
    });
  }, [saveSettingsMutation]);

  // Individual section update methods
  const updateStaffGroups = useCallback((staffGroups) => {
    updateSettingsSectionMutation.mutate({ 
      sectionName: 'staffGroups', 
      sectionData: staffGroups, 
      operation: 'staff-groups-update' 
    });
  }, [updateSettingsSectionMutation]);

  const updateDailyLimits = useCallback((dailyLimits) => {
    updateSettingsSectionMutation.mutate({ 
      sectionName: 'dailyLimits', 
      sectionData: dailyLimits, 
      operation: 'daily-limits-update' 
    });
  }, [updateSettingsSectionMutation]);

  const updateMLParameters = useCallback((mlParameters) => {
    updateSettingsSectionMutation.mutate({ 
      sectionName: 'mlParameters', 
      sectionData: mlParameters, 
      operation: 'ml-parameters-update' 
    });
  }, [updateSettingsSectionMutation]);

  const updateMonthlyLimits = useCallback((monthlyLimits) => {
    updateSettingsSectionMutation.mutate({ 
      sectionName: 'monthlyLimits', 
      sectionData: monthlyLimits, 
      operation: 'monthly-limits-update' 
    });
  }, [updateSettingsSectionMutation]);

  const updateBackupAssignments = useCallback((backupAssignments) => {
    updateSettingsSectionMutation.mutate({ 
      sectionName: 'backupAssignments', 
      sectionData: backupAssignments, 
      operation: 'backup-assignments-update' 
    });
  }, [updateSettingsSectionMutation]);

  // Set up real-time subscription
  useEffect(() => {
    if (!isConnected) return;

    console.log("🔔 Setting up real-time subscription for app settings");

    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings'
        },
        (payload) => {
          console.log('📡 Real-time settings update:', payload);
          
          // Invalidate and refetch settings data on any change
          queryClient.invalidateQueries({ 
            queryKey: SETTINGS_QUERY_KEYS.settings 
          });
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [isConnected, queryClient]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Data
    settings,
    
    // Loading states
    isLoading: isSupabaseLoading,
    isSaving: saveSettingsMutation.isPending || updateSettingsSectionMutation.isPending,
    
    // Connection status
    isConnected,
    error: error || queryError?.message,
    
    // Change tracking
    hasUnsavedChanges,
    validationErrors,
    
    // Autosave state
    isAutosaveEnabled,
    setIsAutosaveEnabled,
    isAutosaving: saveSettingsMutation.isPending && isAutosaveEnabled,
    lastSaveTime: supabaseSettingsData?.updated_at,
    
    // Actions
    updateSettings,
    saveSettings,
    resetToDefaults,
    
    // Section-specific updates
    updateStaffGroups,
    updateDailyLimits,
    updateMLParameters,
    updateMonthlyLimits,
    updateBackupAssignments,
    
    // Utilities
    validateSettings,
    scheduleAutoSave,
    refetchSettings,
    
    // Getters for individual sections
    getStaffGroups: () => settings.staffGroups || getDefaultSettings().staffGroups,
    getDailyLimits: () => settings.dailyLimits || getDefaultSettings().dailyLimits,
    getPriorityRules: () => settings.priorityRules || getDefaultSettings().priorityRules,
    getMLParameters: () => settings.mlParameters || getDefaultSettings().mlParameters,
    getMonthlyLimits: () => settings.monthlyLimits || getDefaultSettings().monthlyLimits,
    getBackupAssignments: () => settings.backupAssignments || getDefaultSettings().backupAssignments,
    
    // Phase identification
    isRealtime: true,
    phase: 'Phase 3: Supabase-first Settings Management',
  };
};

export default useSettingsDataRealtime;