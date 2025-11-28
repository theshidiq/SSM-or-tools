/**
 * Hook for loading priority rules from Supabase database
 * Syncs database priority rules to localStorage settings for AI validation
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useSettings } from '../contexts/SettingsContext';

export const usePriorityRulesData = () => {
  // ✅ FIX: Check if WebSocket settings mode is enabled
  // In WebSocket mode, priority rules are managed entirely by the Go server + WebSocket
  // This hook was causing a race condition where it would overwrite WebSocket data
  // with incomplete/empty staffIds arrays from a parallel Supabase query
  const WEBSOCKET_SETTINGS_ENABLED = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';

  // ⚠️ IMPORTANT: All hooks must be called at top level (React rules of hooks)
  // We can't do early return before hooks, so we call them all, then conditionally execute logic
  const [priorityRules, setPriorityRules] = useState([]);
  const [loading, setLoading] = useState(WEBSOCKET_SETTINGS_ENABLED ? false : true);
  const [error, setError] = useState(null);
  const { settings, updateSettings } = useSettings();

  /**
   * Load priority rules from Supabase database
   * ⚠️ DISABLED in WebSocket mode - WebSocket handles all priority rules operations
   */
  const loadPriorityRules = useCallback(async () => {
    // ✅ FIX: Don't run in WebSocket mode - prevents race condition
    if (WEBSOCKET_SETTINGS_ENABLED) {
      console.log('⏭️ usePriorityRulesData.loadPriorityRules: Skipped in WebSocket mode');
      return [];
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('priority_rules')
        .select('*')
        // ✅ FIX: Removed .eq('is_active', true) - fetch ALL rules (including soft-deleted)
        // Will filter client-side to prevent deletion loop (same fix as staff groups)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Transform database format to localStorage format
      // ✅ FIX: Do NOT filter soft-deleted rules - keep ALL data in state
      // UI components will filter for display. Filtering here causes deletion cascade
      // on Supabase reconnection after inactivity (see INACTIVITY-DELETION-FIX.md)
      const transformedRules = (data || [])
        .map(rule => ({
          id: rule.id,
          name: rule.name,
          description: rule.description || '',
          // ✅ BACKWARD COMPATIBLE: Support both old and new formats
          // New format: rule_definition.staff_ids = ["uuid1", "uuid2"]
          // Old format: rule_definition.conditions.staff_id = "uuid"
          staffIds: rule.rule_definition?.staff_ids ||
                   (rule.rule_definition?.conditions?.staff_id ? [rule.rule_definition.conditions.staff_id] : []) ||
                   [],
          // Legacy staffId for UI compatibility (first item from array)
          staffId: (rule.rule_definition?.staff_ids?.[0]) ||
                  (rule.rule_definition?.conditions?.staff_id) ||
                  undefined,
          ruleType: rule.rule_definition?.type || rule.rule_definition?.rule_type || 'preferred_shift',
          shiftType: rule.rule_definition?.conditions?.shift_type || rule.rule_definition?.shift_type || 'early',
          allowedShifts: rule.rule_definition?.allowed_shifts || rule.rule_definition?.allowedShifts || [], // ✅ NEW: Exception shifts
          daysOfWeek: rule.rule_definition?.conditions?.day_of_week || rule.rule_definition?.days_of_week || [],
          priorityLevel: rule.priority_level ?? 4, // ✅ FIX: Read from top-level column, not JSONB
          preferenceStrength: rule.rule_definition?.preference_strength ?? 1.0,
          isHardConstraint: rule.is_hard_constraint ?? true, // ✅ FIX: Read from top-level column
          penaltyWeight: rule.penalty_weight ?? 100, // ✅ FIX: Read from top-level column
          effectiveFrom: rule.rule_definition?.effective_from || null,
          effectiveUntil: rule.rule_definition?.effective_until || null,
          isActive: rule.is_active ?? true,
          createdAt: rule.created_at,
          updatedAt: rule.updated_at,
        }));

      setPriorityRules(transformedRules);

      // ✅ KEY FIX: Sync to localStorage settings for AI validation
      // Only update if data has actually changed to prevent infinite loops
      const currentRules = settings?.priorityRules || [];
      const hasChanged = JSON.stringify(currentRules) !== JSON.stringify(transformedRules);

      if (hasChanged) {
        await updateSettings({ priorityRules: transformedRules });
        console.log(`✅ Loaded ${transformedRules.length} priority rules from database and synced to settings`);
      } else {
        console.log(`📋 Priority rules already in sync (${transformedRules.length} rules)`);
      }

      return transformedRules;
    } catch (err) {
      console.error('❌ Error loading priority rules:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [updateSettings, settings]);

  /**
   * Create a new priority rule in database
   * ⚠️ DISABLED in WebSocket mode - use wsCreatePriorityRule instead
   */
  const createPriorityRule = useCallback(async (ruleData) => {
    // ✅ FIX: Don't run in WebSocket mode
    if (WEBSOCKET_SETTINGS_ENABLED) {
      const error = new Error('createPriorityRule not available in WebSocket mode - use wsCreatePriorityRule instead');
      console.error('❌', error.message);
      throw error;
    }

    try {
      // ✅ FIX: Validate that at least one staff member is selected
      const staffIds = ruleData.staffIds || (ruleData.staffId ? [ruleData.staffId] : []);

      if (!staffIds || staffIds.length === 0) {
        const error = new Error('Priority rule must have at least one staff member selected');
        console.error('❌ Cannot create priority rule without staff members:', ruleData);
        throw error;
      }

      const { data, error: insertError} = await supabase
        .from('priority_rules')
        .insert([{
          name: ruleData.name,
          description: ruleData.description || '',
          // ✅ CLEANUP: Removed staff_id - column doesn't exist in database schema
          // Staff IDs are ONLY stored in rule_definition.staff_ids JSONB array
          priority_level: ruleData.priorityLevel ?? 4,
          penalty_weight: ruleData.penaltyWeight ?? 100,
          is_hard_constraint: ruleData.isHardConstraint ?? true,
          rule_definition: {
            rule_type: ruleData.ruleType,
            shift_type: ruleData.shiftType,
            allowed_shifts: ruleData.allowedShifts || [], // ✅ NEW: Exception shifts for avoid_shift_with_exceptions
            days_of_week: ruleData.daysOfWeek || [],
            // ✅ SINGLE SOURCE OF TRUTH: Staff IDs stored here in JSONB
            staff_ids: staffIds,
            preference_strength: ruleData.preferenceStrength ?? 1.0,
            effective_from: ruleData.effectiveFrom || null,
            effective_until: ruleData.effectiveUntil || null,
          },
          is_active: ruleData.isActive ?? true,
        }])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Reload all rules to sync with settings
      await loadPriorityRules();

      console.log(`✅ Created priority rule "${ruleData.name}" with ${staffIds.length} staff member(s)`);
      return data;
    } catch (err) {
      console.error('❌ Error creating priority rule:', err);
      throw err;
    }
  }, [loadPriorityRules]);

  /**
   * Update an existing priority rule
   * ⚠️ DISABLED in WebSocket mode - use wsUpdatePriorityRules instead
   */
  const updatePriorityRule = useCallback(async (ruleId, updates) => {
    // ✅ FIX: Don't run in WebSocket mode
    if (WEBSOCKET_SETTINGS_ENABLED) {
      const error = new Error('updatePriorityRule not available in WebSocket mode - use wsUpdatePriorityRules instead');
      console.error('❌', error.message);
      throw error;
    }

    try {
      // ✅ FIX: Build update data conditionally - only include fields explicitly provided
      // Prevents destructive defaults from overwriting existing data
      const updateData = {};

      // Top-level columns - only update if explicitly provided
      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      if (updates.priorityLevel !== undefined) {
        updateData.priority_level = updates.priorityLevel; // ✅ FIX: Top-level column, not JSONB
      }
      if (updates.penaltyWeight !== undefined) {
        updateData.penalty_weight = updates.penaltyWeight; // ✅ FIX: Top-level column, not JSONB
      }
      if (updates.isHardConstraint !== undefined) {
        updateData.is_hard_constraint = updates.isHardConstraint; // ✅ FIX: Top-level column, not JSONB
      }
      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      // ✅ CLEANUP: Removed staff_id column updates - column doesn't exist
      // Staff IDs are ONLY stored in rule_definition.staff_ids JSONB array

      // JSONB rule_definition - only update if any JSONB field is provided
      if (updates.ruleType !== undefined ||
          updates.shiftType !== undefined ||
          updates.allowedShifts !== undefined ||
          updates.daysOfWeek !== undefined ||
          updates.staffIds !== undefined ||
          updates.staffId !== undefined ||
          updates.preferenceStrength !== undefined ||
          updates.effectiveFrom !== undefined ||
          updates.effectiveUntil !== undefined) {

        // Build rule_definition object with only provided fields
        const ruleDefinition = {};

        if (updates.ruleType !== undefined) ruleDefinition.rule_type = updates.ruleType;
        if (updates.shiftType !== undefined) ruleDefinition.shift_type = updates.shiftType;
        if (updates.allowedShifts !== undefined) ruleDefinition.allowed_shifts = updates.allowedShifts; // ✅ NEW: Exception shifts
        if (updates.daysOfWeek !== undefined) ruleDefinition.days_of_week = updates.daysOfWeek;
        // ✅ NEW: Store staffIds array in JSONB
        if (updates.staffIds !== undefined) {
          ruleDefinition.staff_ids = updates.staffIds;
          console.log(`🔍 [updatePriorityRule] Setting staff_ids in JSONB:`, updates.staffIds);
        } else if (updates.staffId !== undefined) {
          // Legacy single staffId → convert to array
          ruleDefinition.staff_ids = [updates.staffId];
          console.log(`🔍 [updatePriorityRule] Converting legacy staffId to array:`, [updates.staffId]);
        }
        if (updates.preferenceStrength !== undefined) ruleDefinition.preference_strength = updates.preferenceStrength;
        if (updates.effectiveFrom !== undefined) ruleDefinition.effective_from = updates.effectiveFrom;
        if (updates.effectiveUntil !== undefined) ruleDefinition.effective_until = updates.effectiveUntil;

        updateData.rule_definition = ruleDefinition;
      }

      console.log(`🔍 [updatePriorityRule] Final updateData being sent to database:`, updateData);
      console.log(`🔍 [updatePriorityRule] rule_definition.staff_ids:`, updateData.rule_definition?.staff_ids);

      const { data, error: updateError } = await supabase
        .from('priority_rules')
        .update(updateData)
        .eq('id', ruleId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Reload all rules to sync with settings
      await loadPriorityRules();

      return data;
    } catch (err) {
      console.error('❌ Error updating priority rule:', err);
      throw err;
    }
  }, [loadPriorityRules]);

  /**
   * Delete a priority rule
   * ⚠️ DISABLED in WebSocket mode - use wsDeletePriorityRule instead
   */
  const deletePriorityRule = useCallback(async (ruleId) => {
    // ✅ FIX: Don't run in WebSocket mode
    if (WEBSOCKET_SETTINGS_ENABLED) {
      const error = new Error('deletePriorityRule not available in WebSocket mode - use wsDeletePriorityRule instead');
      console.error('❌', error.message);
      throw error;
    }

    try {
      const { error: deleteError } = await supabase
        .from('priority_rules')
        .delete()
        .eq('id', ruleId);

      if (deleteError) {
        throw deleteError;
      }

      // Reload all rules to sync with settings
      await loadPriorityRules();

      return true;
    } catch (err) {
      console.error('❌ Error deleting priority rule:', err);
      throw err;
    }
  }, [loadPriorityRules]);

  // Load priority rules on mount and sync to settings
  // ⚠️ DISABLED in WebSocket mode - prevents race condition with WebSocket sync
  useEffect(() => {
    // ✅ FIX: Don't run in WebSocket mode - WebSocket handles all data loading
    if (WEBSOCKET_SETTINGS_ENABLED) {
      console.log('⏭️ usePriorityRulesData: Skipping mount effect in WebSocket mode');
      return;
    }

    loadPriorityRules();

    // ✅ REAL-TIME: Subscribe to priority_rules table changes
    const subscription = supabase
      .channel('priority_rules_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'priority_rules',
        },
        (payload) => {
          console.log('🔄 Priority rules changed in database, reloading...', payload);
          loadPriorityRules(); // Reload when data changes
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  return {
    priorityRules,
    loading,
    error,
    loadPriorityRules,
    createPriorityRule,
    updatePriorityRule,
    deletePriorityRule,
  };
};
