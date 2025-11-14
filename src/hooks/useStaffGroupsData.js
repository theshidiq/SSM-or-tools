/**
 * Hook for loading staff groups from Supabase database
 * Syncs database staff groups to localStorage settings for AI validation
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useSettings } from '../contexts/SettingsContext';

export const useStaffGroupsData = () => {
  // ✅ FIX: Check if WebSocket settings mode is enabled
  // In WebSocket mode, staff groups are managed entirely by the Go server + WebSocket
  // This hook was causing a race condition where it would overwrite WebSocket data
  // with incomplete data from a parallel Supabase query
  const WEBSOCKET_SETTINGS_ENABLED = process.env.REACT_APP_WEBSOCKET_SETTINGS === 'true';

  // ⚠️ IMPORTANT: All hooks must be called at top level (React rules of hooks)
  // We can't do early return before hooks, so we call them all, then conditionally execute logic
  const [staffGroups, setStaffGroups] = useState([]);
  const [loading, setLoading] = useState(WEBSOCKET_SETTINGS_ENABLED ? false : true);
  const [error, setError] = useState(null);
  const { settings, updateSettings } = useSettings();

  /**
   * Load staff groups from Supabase database
   * ⚠️ DISABLED in WebSocket mode - WebSocket handles all staff groups operations
   */
  const loadStaffGroups = useCallback(async () => {
    // ✅ FIX: Don't run in WebSocket mode - prevents race condition
    if (WEBSOCKET_SETTINGS_ENABLED) {
      console.log('⏭️ useStaffGroupsData.loadStaffGroups: Skipped in WebSocket mode');
      return [];
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('staff_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Transform database format to localStorage format
      // ✅ FIX: Do NOT filter soft-deleted groups - keep ALL data in state
      // UI components will filter for display. Filtering here causes deletion cascade
      // on Supabase reconnection after inactivity (see INACTIVITY-DELETION-FIX.md)
      const transformedGroups = (data || [])
        .map(group => ({
          id: group.id,
          name: group.name,
          description: group.description || '',
          color: group.group_config?.color || '#3B82F6',
          members: group.group_config?.members || [], // Array of staff IDs
          isActive: group.is_active ?? true, // Default to true if not set
          createdAt: group.created_at,
          updatedAt: group.updated_at,
        }));

      setStaffGroups(transformedGroups);

      // ✅ KEY FIX: Sync to localStorage settings for AI validation
      // Only update if data has actually changed to prevent infinite loops
      const currentGroups = settings?.staffGroups || [];
      const hasChanged = JSON.stringify(currentGroups) !== JSON.stringify(transformedGroups);

      if (hasChanged) {
        await updateSettings({ staffGroups: transformedGroups });
        console.log(`✅ Loaded ${transformedGroups.length} staff groups from database and synced to settings`);
      } else {
        console.log(`📋 Staff groups already in sync (${transformedGroups.length} groups)`);
      }

      return transformedGroups;
    } catch (err) {
      console.error('❌ Error loading staff groups:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [updateSettings, settings]);

  /**
   * Create a new staff group in database
   * ⚠️ DISABLED in WebSocket mode - use wsCreateStaffGroup instead
   */
  const createStaffGroup = useCallback(async (groupData) => {
    // ✅ FIX: Don't run in WebSocket mode
    if (WEBSOCKET_SETTINGS_ENABLED) {
      const error = new Error('createStaffGroup not available in WebSocket mode - use wsCreateStaffGroup instead');
      console.error('❌', error.message);
      throw error;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('staff_groups')
        .insert([{
          name: groupData.name,
          description: groupData.description || '',
          group_config: {
            color: groupData.color || '#3B82F6',
            members: groupData.members || [],
          },
          is_active: true, // ✅ FIX: Explicitly set is_active to prevent soft-delete
        }])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Reload all groups to sync with settings
      await loadStaffGroups();

      return data;
    } catch (err) {
      console.error('❌ Error creating staff group:', err);
      throw err;
    }
  }, [loadStaffGroups]);

  /**
   * Update an existing staff group
   * ⚠️ DISABLED in WebSocket mode - use wsUpdateStaffGroups instead
   */
  const updateStaffGroup = useCallback(async (groupId, updates) => {
    // ✅ FIX: Don't run in WebSocket mode
    if (WEBSOCKET_SETTINGS_ENABLED) {
      const error = new Error('updateStaffGroup not available in WebSocket mode - use wsUpdateStaffGroups instead');
      console.error('❌', error.message);
      throw error;
    }

    try {
      const updateData = {
        name: updates.name,
        description: updates.description || '',
        group_config: {
          color: updates.color || '#3B82F6',
          members: updates.members || [],
        },
      };

      const { data, error: updateError } = await supabase
        .from('staff_groups')
        .update(updateData)
        .eq('id', groupId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Reload all groups to sync with settings
      await loadStaffGroups();

      return data;
    } catch (err) {
      console.error('❌ Error updating staff group:', err);
      throw err;
    }
  }, [loadStaffGroups]);

  /**
   * Delete a staff group
   * ⚠️ DISABLED in WebSocket mode - use wsDeleteStaffGroup instead
   */
  const deleteStaffGroup = useCallback(async (groupId) => {
    // ✅ FIX: Don't run in WebSocket mode
    if (WEBSOCKET_SETTINGS_ENABLED) {
      const error = new Error('deleteStaffGroup not available in WebSocket mode - use wsDeleteStaffGroup instead');
      console.error('❌', error.message);
      throw error;
    }

    try {
      const { error: deleteError } = await supabase
        .from('staff_groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) {
        throw deleteError;
      }

      // Reload all groups to sync with settings
      await loadStaffGroups();

      return true;
    } catch (err) {
      console.error('❌ Error deleting staff group:', err);
      throw err;
    }
  }, [loadStaffGroups]);

  // Load staff groups on mount and sync to settings
  // ⚠️ DISABLED in WebSocket mode - prevents race condition with WebSocket sync
  useEffect(() => {
    // ✅ FIX: Don't run in WebSocket mode - WebSocket handles all data loading
    if (WEBSOCKET_SETTINGS_ENABLED) {
      console.log('⏭️ useStaffGroupsData: Skipping mount effect in WebSocket mode');
      return;
    }

    loadStaffGroups();

    // ✅ REAL-TIME: Subscribe to staff_groups table changes
    const subscription = supabase
      .channel('staff_groups_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'staff_groups',
        },
        (payload) => {
          console.log('🔄 Staff groups changed in database, reloading...', payload);
          loadStaffGroups(); // Reload when data changes
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
    staffGroups,
    loading,
    error,
    loadStaffGroups,
    createStaffGroup,
    updateStaffGroup,
    deleteStaffGroup,
  };
};
