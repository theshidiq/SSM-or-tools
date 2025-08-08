import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "./useSupabase";

const DEFAULT_SETTINGS = {
  staffGroups: [],
  dailyLimits: [],
  monthlyLimits: [],
  priorityRules: [],
  conflictRules: [],
  mlParameters: {
    algorithm: "genetic_algorithm",
    populationSize: 100,
    generations: 300,
    mutationRate: 0.1,
    crossoverRate: 0.8,
    elitismRate: 0.1,
    convergenceThreshold: 0.001,
    confidenceThreshold: 0.75,
    maxRuntime: 300,
    enableAdaptiveMutation: true,
    enableElitismDiversity: false,
    parallelProcessing: true,
    randomSeed: null,
  },
  constraintWeights: {
    // Fairness weights
    shift_distribution: 25,
    off_day_distribution: 20,
    weekend_fairness: 15,
    // Preference weights
    shift_preferences: 20,
    day_off_preferences: 15,
    seniority_bonus: 10,
    // Constraint weights
    minimum_coverage: 40,
    skill_requirements: 30,
    conflict_avoidance: 35,
    // Optimization weights
    schedule_stability: 15,
    cost_efficiency: 20,
    pattern_consistency: 10,
  },
  penaltyMultipliers: {
    hard_constraint_violation: 1000,
    soft_constraint_violation: 50,
    preference_violation: 10,
  },
  autoNormalizeWeights: false,
  dynamicWeightAdjustment: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
};

export const useSettingsData = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [configHistory, setConfigHistory] = useState([]);
  
  const { supabase, isConnected } = useSupabase();

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!isConnected || !supabase) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load the active configuration version
      const { data: activeVersion, error: versionError } = await supabase
        .from('config_versions')
        .select('id')
        .eq('is_active', true)
        .single();

      if (versionError && versionError.code !== 'PGRST116') {
        throw versionError;
      }

      if (!activeVersion) {
        // No active configuration, use defaults
        setSettings(DEFAULT_SETTINGS);
        setIsLoading(false);
        return;
      }

      // Load all configuration data for the active version
      const [
        { data: staffGroups },
        { data: dailyLimits },
        { data: monthlyLimits },
        { data: priorityRules },
        { data: conflictRules },
        { data: mlConfigs },
      ] = await Promise.all([
        supabase
          .from('staff_groups')
          .select('*')
          .eq('version_id', activeVersion.id),
        supabase
          .from('daily_limits')
          .select('*')
          .eq('version_id', activeVersion.id)
          .eq('is_active', true),
        supabase
          .from('monthly_limits')
          .select('*')
          .eq('version_id', activeVersion.id)
          .eq('is_active', true),
        supabase
          .from('priority_rules')
          .select('*')
          .eq('version_id', activeVersion.id)
          .eq('is_active', true),
        supabase
          .from('conflict_rules')
          .select('*')
          .eq('version_id', activeVersion.id)
          .eq('is_active', true),
        supabase
          .from('ml_model_configs')
          .select('*')
          .eq('version_id', activeVersion.id)
          .eq('is_default', true),
      ]);

      // Process ML configuration
      const mlConfig = mlConfigs?.[0] || {};
      const mlParameters = {
        ...DEFAULT_SETTINGS.mlParameters,
        ...mlConfig.parameters,
        confidenceThreshold: mlConfig.confidence_threshold || DEFAULT_SETTINGS.mlParameters.confidenceThreshold,
      };

      // Build settings object
      const loadedSettings = {
        ...DEFAULT_SETTINGS,
        staffGroups: staffGroups || [],
        dailyLimits: (dailyLimits || []).map(limit => ({
          id: limit.id,
          name: limit.name,
          ...limit.limit_config,
          penaltyWeight: limit.penalty_weight,
          isHardConstraint: limit.is_hard_constraint,
          description: limit.description || '',
        })),
        monthlyLimits: (monthlyLimits || []).map(limit => ({
          id: limit.id,
          name: limit.name,
          ...limit.limit_config,
          penaltyWeight: limit.penalty_weight,
          isHardConstraint: limit.is_hard_constraint,
          description: limit.description || '',
        })),
        priorityRules: (priorityRules || []).map(rule => ({
          id: rule.id,
          name: rule.name,
          ...rule.rule_definition,
          priorityLevel: rule.priority_level,
          penaltyWeight: rule.penalty_weight,
          isHardConstraint: rule.is_hard_constraint,
          effectiveFrom: rule.effective_from,
          effectiveUntil: rule.effective_until,
          isActive: rule.is_active,
          description: rule.description || '',
        })),
        conflictRules: (conflictRules || []).map(rule => ({
          id: rule.id,
          name: rule.name,
          ...rule.conflict_definition,
          penaltyWeight: rule.penalty_weight,
          isHardConstraint: rule.is_hard_constraint,
        })),
        mlParameters,
        updatedAt: new Date().toISOString(),
      };

      setSettings(loadedSettings);
      setHasUnsavedChanges(false);

    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, isConnected]);

  // Save settings to database
  const saveSettings = useCallback(async (settingsToSave = settings) => {
    if (!isConnected || !supabase) {
      throw new Error('Database not connected');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Validate settings before saving
      const errors = validateSettings(settingsToSave);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        throw new Error('Validation errors found');
      }

      // Create a new configuration version
      const { data: newVersion, error: versionError } = await supabase
        .rpc('create_config_version', {
          p_restaurant_id: 'your-restaurant-id', // This should come from user context
          p_name: `Configuration ${new Date().toLocaleString()}`,
          p_description: 'Updated via settings UI',
        });

      if (versionError) throw versionError;

      const versionId = newVersion;

      // Save staff groups
      if (settingsToSave.staffGroups.length > 0) {
        const { error: groupsError } = await supabase
          .from('staff_groups')
          .insert(
            settingsToSave.staffGroups.map(group => ({
              id: group.id,
              version_id: versionId,
              restaurant_id: 'your-restaurant-id',
              name: group.name,
              description: group.description,
              color: group.color,
            }))
          );

        if (groupsError) throw groupsError;

        // Save group members
        const memberInserts = [];
        settingsToSave.staffGroups.forEach(group => {
          group.members.forEach(memberId => {
            memberInserts.push({
              group_id: group.id,
              staff_id: memberId,
            });
          });
        });

        if (memberInserts.length > 0) {
          const { error: membersError } = await supabase
            .from('staff_group_members')
            .insert(memberInserts);

          if (membersError) throw membersError;
        }
      }

      // Save daily limits
      if (settingsToSave.dailyLimits.length > 0) {
        const { error: dailyError } = await supabase
          .from('daily_limits')
          .insert(
            settingsToSave.dailyLimits.map(limit => ({
              id: limit.id,
              version_id: versionId,
              restaurant_id: 'your-restaurant-id',
              name: limit.name,
              limit_config: {
                shiftType: limit.shiftType,
                maxCount: limit.maxCount,
                daysOfWeek: limit.daysOfWeek,
                scope: limit.scope,
                targetIds: limit.targetIds,
              },
              penalty_weight: limit.penaltyWeight,
              is_hard_constraint: limit.isHardConstraint,
            }))
          );

        if (dailyError) throw dailyError;
      }

      // Save ML configuration
      const { error: mlError } = await supabase
        .from('ml_model_configs')
        .insert({
          version_id: versionId,
          restaurant_id: 'your-restaurant-id',
          model_name: 'default_scheduler',
          model_type: 'optimization',
          parameters: settingsToSave.mlParameters,
          confidence_threshold: settingsToSave.mlParameters.confidenceThreshold,
          is_default: true,
        });

      if (mlError) throw mlError;

      // Activate the new version
      const { error: activateError } = await supabase
        .rpc('activate_config_version', { p_version_id: versionId });

      if (activateError) throw activateError;

      // Update local state
      setSettings({
        ...settingsToSave,
        updatedAt: new Date().toISOString(),
        version: (settingsToSave.version || 0) + 1,
      });
      setHasUnsavedChanges(false);
      setValidationErrors({});

      return { success: true, version: versionId };

    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [settings, supabase, isConnected]);

  // Load configuration history
  const loadConfigHistory = useCallback(async () => {
    if (!isConnected || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('config_versions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setConfigHistory(data || []);
      return data;

    } catch (err) {
      console.error('Failed to load config history:', err);
      return [];
    }
  }, [supabase, isConnected]);

  // Validate settings
  const validateSettings = (settingsToValidate) => {
    const errors = {};

    // Validate staff groups
    if (settingsToValidate.staffGroups) {
      const groupNames = settingsToValidate.staffGroups.map(g => g.name);
      const duplicateNames = groupNames.filter((name, index) => groupNames.indexOf(name) !== index);
      if (duplicateNames.length > 0) {
        errors['staff-groups'] = `Duplicate group names: ${duplicateNames.join(', ')}`;
      }
    }

    // Validate daily limits
    if (settingsToValidate.dailyLimits) {
      settingsToValidate.dailyLimits.forEach((limit, index) => {
        if (!limit.name) {
          errors[`daily-limits-${index}`] = 'Limit name is required';
        }
        if (limit.maxCount <= 0) {
          errors[`daily-limits-${index}`] = 'Max count must be greater than 0';
        }
        if (limit.daysOfWeek.length === 0) {
          errors[`daily-limits-${index}`] = 'At least one day must be selected';
        }
      });
    }

    // Validate ML parameters
    if (settingsToValidate.mlParameters) {
      const ml = settingsToValidate.mlParameters;
      if (ml.populationSize < 10 || ml.populationSize > 1000) {
        errors.mlParameters = 'Population size must be between 10 and 1000';
      }
      if (ml.generations < 10 || ml.generations > 2000) {
        errors.mlParameters = 'Generations must be between 10 and 2000';
      }
      if (ml.mutationRate < 0.01 || ml.mutationRate > 1) {
        errors.mlParameters = 'Mutation rate must be between 0.01 and 1';
      }
    }

    // Validate constraint weights
    if (settingsToValidate.constraintWeights) {
      const weights = Object.values(settingsToValidate.constraintWeights);
      if (weights.some(w => w < 0 || w > 100)) {
        errors.constraintWeights = 'All weights must be between 0 and 100';
      }
    }

    return errors;
  };

  // Update settings with change tracking
  const updateSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    
    // Clear validation errors when settings change
    setValidationErrors({});
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setHasUnsavedChanges(true);
    setValidationErrors({});
  }, []);

  // Export configuration
  const exportConfiguration = useCallback(() => {
    const config = {
      ...settings,
      exportedAt: new Date().toISOString(),
      version: settings.version || 1,
    };
    return JSON.stringify(config, null, 2);
  }, [settings]);

  // Import configuration
  const importConfiguration = useCallback((configJson) => {
    try {
      const config = JSON.parse(configJson);
      
      // Validate imported config
      const errors = validateSettings(config);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        throw new Error('Invalid configuration file');
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...config,
        updatedAt: new Date().toISOString(),
      });
      setHasUnsavedChanges(true);
      setValidationErrors({});

      return { success: true };

    } catch (err) {
      setError('Failed to import configuration: ' + err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load config history on mount
  useEffect(() => {
    loadConfigHistory();
  }, [loadConfigHistory]);

  return {
    // State
    settings,
    isLoading,
    error,
    hasUnsavedChanges,
    validationErrors,
    configHistory,

    // Actions
    updateSettings,
    saveSettings,
    loadSettings,
    resetToDefaults,
    exportConfiguration,
    importConfiguration,
    loadConfigHistory,

    // Utilities
    validateSettings,
  };
};