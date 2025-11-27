import { useState, useEffect, useCallback, useRef } from "react";
import { configService } from "../services/ConfigurationService";
import { useAutosave } from "./useAutosave";
import { useWebSocketSettings } from "./useWebSocketSettings";
import startupLogger from "../utils/startupLogger";
import { invalidateConfigurationCache } from "../ai/constraints/ConstraintEngine";

// Feature flag for WebSocket settings (multi-table backend)
const WEBSOCKET_SETTINGS_ENABLED =
  process.env.REACT_APP_WEBSOCKET_SETTINGS === "true";

export const useSettingsData = (autosaveEnabled = true) => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(autosaveEnabled);

  // Ref to hold current settings to prevent infinite loops
  const settingsRef = useRef(settings);

  // 🔧 FIX #4: Prevent localStorage save from triggering infinite sync loop
  // Use counter instead of boolean to track concurrent syncs
  const isSyncingFromWebSocketRef = useRef(false);
  const syncCounterRef = useRef(0);
  const hasCompletedInitialLoadRef = useRef(false); // ✅ FIX #5 CORRECTION: Track if initial load completed

  // 🔧 FIX #6: Prevent duplicate priority rule CREATE operations
  // Track rule IDs currently being created to prevent broadcast loop duplicates
  const inFlightPriorityRulesRef = useRef(new Set());

  // WebSocket multi-table integration
  const {
    settings: wsSettings,
    version: wsVersion,
    updateStaffGroups: wsUpdateStaffGroups,
    createStaffGroup: wsCreateStaffGroup,
    deleteStaffGroup: wsDeleteStaffGroup,
    hardDeleteStaffGroup: wsHardDeleteStaffGroup,
    updateWeeklyLimits: wsUpdateWeeklyLimits,
    updateMonthlyLimits: wsUpdateMonthlyLimits,
    createPriorityRule: wsCreatePriorityRule,
    updatePriorityRules: wsUpdatePriorityRules,
    deletePriorityRule: wsDeletePriorityRule,
    updateMLConfig: wsUpdateMLConfig,
    createBackupAssignment: wsCreateBackupAssignment,
    updateBackupAssignment: wsUpdateBackupAssignment,
    deleteBackupAssignment: wsDeleteBackupAssignment,
    resetSettings: wsResetSettings,
    migrateSettings: wsMigrateSettings,
    isConnected: wsConnected,
    connectionStatus,
    isLoading: wsLoading,
    lastError: wsError,
  } = useWebSocketSettings({
    enabled: WEBSOCKET_SETTINGS_ENABLED,
  });

  // Store WebSocket callbacks in refs to keep updateSettings stable
  const wsCallbacksRef = useRef({
    wsUpdateStaffGroups,
    wsCreateStaffGroup,
    wsDeleteStaffGroup,
    wsHardDeleteStaffGroup,
    wsUpdateWeeklyLimits,
    wsUpdateMonthlyLimits,
    wsCreatePriorityRule,
    wsUpdatePriorityRules,
    wsDeletePriorityRule,
    wsUpdateMLConfig,
    wsCreateBackupAssignment,
    wsUpdateBackupAssignment,
    wsDeleteBackupAssignment,
  });

  // Update refs when callbacks change
  useEffect(() => {
    wsCallbacksRef.current = {
      wsUpdateStaffGroups,
      wsCreateStaffGroup,
      wsDeleteStaffGroup,
      wsHardDeleteStaffGroup,
      wsUpdateWeeklyLimits,
      wsUpdateMonthlyLimits,
      wsCreatePriorityRule,
      wsUpdatePriorityRules,
      wsDeletePriorityRule,
      wsUpdateMLConfig,
      wsCreateBackupAssignment,
      wsUpdateBackupAssignment,
      wsDeleteBackupAssignment,
    };
  }, [
    wsUpdateStaffGroups,
    wsCreateStaffGroup,
    wsDeleteStaffGroup,
    wsHardDeleteStaffGroup,
    wsUpdateWeeklyLimits,
    wsUpdateMonthlyLimits,
    wsCreatePriorityRule,
    wsUpdatePriorityRules,
    wsDeletePriorityRule,
    wsUpdateMLConfig,
    wsCreateBackupAssignment,
    wsUpdateBackupAssignment,
    wsDeleteBackupAssignment,
  ]);

  // Determine active backend mode
  const useWebSocket = WEBSOCKET_SETTINGS_ENABLED && wsConnected;

  // Log backend mode on mount and changes
  useEffect(() => {
    if (WEBSOCKET_SETTINGS_ENABLED) {
      if (wsConnected) {
        console.log("📡 useSettingsData: WebSocket multi-table backend ACTIVE");
        console.log(
          `  - Version: ${wsVersion?.versionNumber} (${wsVersion?.name})`,
        );
        console.log(
          `  - Tables: staff_groups, daily_limits, monthly_limits, priority_rules, ml_model_configs`,
        );
      } else {
        console.log(
          "📦 useSettingsData: localStorage fallback (WebSocket disconnected)",
        );
      }
    } else {
      console.log("📦 useSettingsData: localStorage mode (WebSocket disabled)");
    }
  }, [wsConnected, wsVersion]);

  // Sync WebSocket settings to local state (aggregate multi-table data)
  useEffect(() => {
    if (useWebSocket && wsSettings) {
      // ✅ FIX #4: Use sync counter for proper tracking
      const syncId = ++syncCounterRef.current;
      isSyncingFromWebSocketRef.current = true;

      console.log(`🔄 Syncing WebSocket multi-table settings to local state (sync #${syncId})`);

      // ✅ CRITICAL FIX: Keep soft-deleted groups in local state (DON'T filter them out here)
      // The UI layer (StaffGroupsTab.jsx) will filter them for display
      // This maintains state consistency between client and server
      // Otherwise, client state != server state, causing deleted groups to reappear

      // ✅ FIX #2: Use nullish coalescing (??) instead of logical OR (||) to prevent falsy value coercion
      // || converts null/undefined/false/0/'' to [], triggering false-positive deletions
      // ?? only converts null/undefined to [], preserving intentional empty arrays
      const staffGroups = wsSettings?.staffGroups ??
        (wsSettings !== null ? [] : settingsRef.current?.staffGroups ?? []);

      // Validate data integrity before processing
      if (!Array.isArray(staffGroups)) {
        console.error('❌ [SYNC] Invalid staffGroups from WebSocket:', typeof staffGroups, staffGroups);
        return; // Don't process invalid data
      }

      // ✅ FIX #3: Normalize field names (is_active vs isActive) to prevent filter bypass
      // Database uses snake_case (is_active), React uses camelCase (isActive)
      // ✅ FIX #1: Use destructuring to completely remove is_active field (not set to undefined)
      const normalizeFieldNames = (group) => {
        const { is_active, ...rest } = group;  // Remove is_active via destructuring
        return {
          ...rest,
          isActive: is_active ?? rest.isActive ?? true,
        };
      };

      const normalizedStaffGroups = staffGroups.map(normalizeFieldNames);

      console.log(`🗑️ [SYNC] Received ${normalizedStaffGroups.length} total groups from server (including soft-deleted)`);
      const softDeletedCount = normalizedStaffGroups.filter(g => g.isActive === false).length;
      if (softDeletedCount > 0) {
        console.log(`🗑️ [SYNC] ${softDeletedCount} soft-deleted groups kept in local state (hidden in UI)`);
      }

      // 🔍 DEBUG: Log priority rules from WebSocket
      console.log('🔍 [DEBUG] wsSettings.priorityRules from WebSocket:', wsSettings.priorityRules);
      console.log('🔍 [DEBUG] priorityRules length:', wsSettings.priorityRules?.length || 0);
      if (wsSettings.priorityRules && wsSettings.priorityRules.length > 0) {
        console.log('🔍 [DEBUG] First priority rule:', JSON.stringify(wsSettings.priorityRules[0], null, 2));
      }

      // Transform multi-table response to localStorage-compatible format
      // ✅ FIX #2: Use ?? for all arrays to prevent connection drop mass deletions
      const aggregatedSettings = {
        staffGroups: normalizedStaffGroups, // ✅ FIX #3: Use normalized groups with consistent field names
        weeklyLimits: wsSettings?.weeklyLimits ?? [],
        monthlyLimits: wsSettings?.monthlyLimits ?? [],
        dailyLimits: wsSettings?.dailyLimits ?? { maxOffPerDay: 3, maxEarlyPerDay: 2, maxLatePerDay: 3 }, // Daily limits (per-date constraints)
        priorityRules: wsSettings?.priorityRules ?? [],
        backupAssignments: wsSettings?.backupAssignments ?? [], // Backup staff assignments
        mlParameters: wsSettings?.mlModelConfigs?.[0] ?? {},
        version: wsVersion,
      };

      setSettings(aggregatedSettings);

      // ✅ PHASE 1 FIX: Invalidate AI cache when WebSocket updates settings
      // This ensures ConstraintEngine refreshes and uses latest database rules
      console.log("🔄 [CACHE BRIDGE] Invalidating AI cache due to WebSocket settings update");
      invalidateConfigurationCache();
      console.log("✅ [CACHE BRIDGE] AI cache invalidated - next AI generation will use fresh rules");

      startupLogger.logSettingsChange(
        'useSettingsData.WebSocketSync',
        'Settings aggregated from WebSocket',
        aggregatedSettings
      );
      setIsLoading(false);
      setHasUnsavedChanges(false);
      setError(null);

      // ✅ FIX #4: Clear flag with immediate logging and delayed actual clear
      // First, log that state updates are complete
      console.log(`📥 Sync #${syncId} state updates applied, scheduling flag clear`);

      // Use requestAnimationFrame to clear after next paint (ensures all React updates complete)
      requestAnimationFrame(() => {
        if (syncId === syncCounterRef.current) {
          console.log(`✅ Sync #${syncId} complete - clearing isSyncingFromWebSocketRef (flag was: ${isSyncingFromWebSocketRef.current})`);
          isSyncingFromWebSocketRef.current = false;
          console.log(`🔓 isSyncingFromWebSocketRef now cleared - user operations allowed`);
        } else {
          console.log(`⚠️ Sync #${syncId} skipped clearing - newer sync #${syncCounterRef.current} exists`);
        }
      });
    }
  }, [useWebSocket, wsSettings, wsVersion]);

  // Sync settings to ref to prevent infinite loops in updateSettings
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 🔧 BRIDGE: Sync settings to ConfigurationService for AI system
  // This ensures AI generation uses the latest priority rules from WebSocket/database
  useEffect(() => {
    if (settings && useWebSocket) {
      // Only sync when using WebSocket mode (database-backed settings)
      configService.syncExternalSettings(settings);
    }
  }, [settings, useWebSocket]);

  // 🚨 MONITORING: Detect settings wipe (when populated arrays become empty)
  // This provides early warning if settings are mysteriously reset
  const previousSettingsRef = useRef(null);
  useEffect(() => {
    if (!settings || !useWebSocket) return;

    const prev = previousSettingsRef.current;
    if (!prev) {
      // First load - store initial state
      previousSettingsRef.current = {
        staffGroupsCount: settings.staffGroups?.length || 0,
        priorityRulesCount: settings.priorityRules?.length || 0,
        weeklyLimitsCount: settings.weeklyLimits?.length || 0,
        monthlyLimitsCount: settings.monthlyLimits?.length || 0,
        hasDailyLimits: !!settings.dailyLimits,
      };
      return;
    }

    const current = {
      staffGroupsCount: settings.staffGroups?.length || 0,
      priorityRulesCount: settings.priorityRules?.length || 0,
      weeklyLimitsCount: settings.weeklyLimits?.length || 0,
      monthlyLimitsCount: settings.monthlyLimits?.length || 0,
      hasDailyLimits: !!settings.dailyLimits,
    };

    // Detect wipe: populated → empty (N > 0 → 0)
    const wipeDetected = [];

    if (prev.staffGroupsCount > 0 && current.staffGroupsCount === 0) {
      wipeDetected.push(`staffGroups (${prev.staffGroupsCount} → 0)`);
    }
    if (prev.priorityRulesCount > 0 && current.priorityRulesCount === 0) {
      wipeDetected.push(`priorityRules (${prev.priorityRulesCount} → 0)`);
    }
    if (prev.weeklyLimitsCount > 0 && current.weeklyLimitsCount === 0) {
      wipeDetected.push(`weeklyLimits (${prev.weeklyLimitsCount} → 0)`);
    }
    if (prev.monthlyLimitsCount > 0 && current.monthlyLimitsCount === 0) {
      wipeDetected.push(`monthlyLimits (${prev.monthlyLimitsCount} → 0)`);
    }

    if (wipeDetected.length > 0) {
      console.error("🚨 SETTINGS WIPE DETECTED:", wipeDetected.join(", "));
      console.error("  - This may indicate a settings reset or configuration issue");
      console.error("  - Check for SETTINGS_RESET messages or default data insertion failures");
      console.error("  - Previous counts:", prev);
      console.error("  - Current counts:", current);
    }

    // Update previous state for next comparison
    previousSettingsRef.current = current;
  }, [settings, useWebSocket]);

  // Load settings from localStorage via configService (localStorage mode only)
  const loadSettings = useCallback(() => {
    if (useWebSocket) {
      console.log(
        "⏭️ Skipping loadSettings - using WebSocket multi-table backend",
      );
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const loadedSettings = configService.getSettings();
      setSettings(loadedSettings);
      startupLogger.logSettingsChange(
        'useSettingsData.loadSettings',
        'Settings loaded from localStorage',
        loadedSettings
      );
      setHasUnsavedChanges(false);
      setValidationErrors({});
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket]);

  // Save settings via configService (localStorage mode only)
  const saveSettings = useCallback(
    async (settingsToSave = settings, skipLoadingState = false) => {
      if (useWebSocket) {
        console.log(
          "⏭️ Skipping saveSettings - using WebSocket multi-table backend (auto-sync)",
        );
        return { success: true };
      }

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
    [settings, useWebSocket],
  );

  /**
   * Update settings with multi-table awareness
   * Detects which table was modified and sends specific WebSocket updates
   */
  const updateSettings = useCallback(
    (newSettingsOrUpdater) => {
      // ✅ FIX: Support functional updates like React's setState
      // This allows: updateSettings(prev => ({...prev, priorityRules: newRules}))
      const newSettings = typeof newSettingsOrUpdater === 'function'
        ? newSettingsOrUpdater(settingsRef.current || {})
        : newSettingsOrUpdater;

      console.log("🔍 [UPDATE SETTINGS] updateSettings called with:", {
        oldGroupsCount: settingsRef.current?.staffGroups?.length,
        newGroupsCount: newSettings?.staffGroups?.length,
        useWebSocket
      });

      if (useWebSocket) {
        // 🔧 FIX: CRITICAL - Prevent circular updates when syncing FROM WebSocket
        // But ALLOW user-initiated updates even during sync
        console.log(`🔍 [UPDATE CHECK] isSyncingFromWebSocketRef.current = ${isSyncingFromWebSocketRef.current}`);
        if (isSyncingFromWebSocketRef.current) {
          // ✅ IMPROVED: Check if this is a circular update (wsSettings → setSettings → updateSettings)
          // or a legitimate user operation (user creates/updates → updateSettings)
          const isCircularUpdate = wsSettings && JSON.stringify(newSettings) === JSON.stringify(wsSettings);

          if (isCircularUpdate) {
            console.log(
              "⏭️ Skipping WebSocket update - circular update detected (wsSettings → setSettings → updateSettings)",
            );
            console.log("   This prevents infinite loop from WebSocket broadcast");
            // Still update local state for UI consistency
            setSettings(newSettings);
            startupLogger.logSettingsChange(
              'useSettingsData.updateSettings',
              'SKIPPED WebSocket update (circular from server)',
              newSettings
            );
            setValidationErrors({});
            return;
          } else {
            console.log(
              "✅ User-initiated update detected during WebSocket sync - ALLOWING database save",
            );
            console.log("   This is NOT a circular update - data differs from wsSettings");
          }
        } else {
          console.log("✅ isSyncingFromWebSocketRef is false - proceeding with database save");
        }

        console.log("🔄 Updating settings via WebSocket multi-table backend");

        // ✅ CRITICAL FIX: Use settingsRef for old value to get most recent state
        // The settings state might be stale due to React batching, but ref is always current
        const oldSettings = settingsRef.current || {};
        const callbacks = wsCallbacksRef.current;

        // Detect and send changes to server FIRST (while we still have old settings for comparison)
        let changedGroupsCount = 0;
        let createdGroupsCount = 0;
        let deletedGroupsCount = 0;

        // Detect and update staff groups (CREATE, UPDATE, DELETE operations)
        // ✅ FIX: Normalize groups before comparison to exclude auto-generated fields
        // This prevents infinite loops from server-side timestamp updates
        // ⚠️ IMPORTANT: Include isActive to detect soft-delete changes!
        const normalizeGroup = (group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          color: group.color,
          members: group.members ?? [], // ✅ FIX #2: Use ?? instead of ||
          isActive: group.isActive ?? group.is_active ?? true, // ✅ FIX #3: Use normalized field name
        });

        // ✅ FIX #2: Use ?? instead of || to prevent false-positive mass deletions
        const oldGroups = oldSettings?.staffGroups ?? [];
        const newGroups = newSettings?.staffGroups ?? [];

        // ✅ FIX #5 CORRECTION: Guard against initial WebSocket sync ONLY
        // Only skip if this is during initial WebSocket sync (not user-initiated changes)
        const isInitialLoad = !hasCompletedInitialLoadRef.current && oldGroups.length === 0;

        if (isInitialLoad && newGroups.length > 0) {
          console.log(`🔒 [FIX #5] Skipping change detection - initial WebSocket sync (0 → ${newGroups.length} groups)`);
          hasCompletedInitialLoadRef.current = true; // Mark initial load as complete
          // Don't process change detection during initial WebSocket sync
        } else {
          // Normal operation - process all changes (CREATE, UPDATE, DELETE)
          const oldGroupsNormalized = oldGroups.map(normalizeGroup);
          const newGroupsNormalized = newGroups.map(normalizeGroup);

        if (
          JSON.stringify(oldGroupsNormalized) !==
          JSON.stringify(newGroupsNormalized)
        ) {
          console.log("  - Detecting staff_groups table changes...");
          console.log("🔍 [DELETE DEBUG] oldGroups count:", oldGroups.length);
          console.log("🔍 [DELETE DEBUG] newGroups count:", newGroups.length);
          console.log("🔍 [DELETE DEBUG] oldGroups:", oldGroups.map(g => ({ id: g.id, name: g.name, is_active: g.is_active })));
          console.log("🔍 [DELETE DEBUG] newGroups:", newGroups.map(g => ({ id: g.id, name: g.name, is_active: g.is_active })));
          const oldGroupIds = new Set(oldGroups.map((g) => g.id));
          const newGroupIds = new Set(newGroups.map((g) => g.id));

          // Detect CREATED groups (exist in new but not in old)
          const createdGroups = newGroups.filter((g) => !oldGroupIds.has(g.id));
          createdGroupsCount = createdGroups.length;
          if (createdGroups.length > 0) {
            console.log(`    - ${createdGroups.length} new group(s) created`);
            createdGroups.forEach((group) => {
              console.log(
                `      - Creating group "${group.name}" (${group.id})`,
              );
              callbacks.wsCreateStaffGroup(group);
            });
          }

          // Detect DELETED groups (exist in old but not in new, OR soft-deleted via is_active=false)
          // ✅ RACE CONDITION FIX: Only send DELETE for ACTIVE groups
          // Already-inactive groups (is_active=false) don't need DELETE messages
          // 🔧 FIX #2: Additional safeguard - skip items that exist in new state but are soft-deleted
          // This prevents false-positive hard deletes when server state includes soft-deleted items
          const deletedGroupIds = [
            // Hard-deleted: removed from array (but only if was active)
            ...[...oldGroupIds].filter((id) => {
              if (!newGroupIds.has(id)) {
                const oldGroup = oldGroups.find((g) => g.id === id);
                const newGroup = newGroups.find((g) => g.id === id);

                // ✅ FIX #2: Skip if item exists in new state but is soft-deleted
                // This catches cases where server now includes soft-deleted items
                if (newGroup && newGroup.is_active === false) {
                  console.log(`🔧 [FIX #2] Skipping hard delete for soft-deleted group: ${id} (${newGroup.name})`);
                  return false;
                }

                // Only delete if group was active (skip already soft-deleted groups)
                return oldGroup && oldGroup.is_active !== false;
              }
              return false;
            }),
            // Soft-deleted: is_active changed from true to false
            ...newGroups
              .filter((newGroup) => {
                const oldGroup = oldGroups.find((g) => g.id === newGroup.id);
                // Detect soft-delete: was active (or undefined), now inactive
                const isSoftDeleted = (
                  oldGroup &&
                  oldGroup.is_active !== false &&
                  newGroup.is_active === false
                );
                console.log("🔍 [SOFT DELETE CHECK]", {
                  groupId: newGroup.id,
                  groupName: newGroup.name,
                  oldIsActive: oldGroup?.is_active,
                  newIsActive: newGroup.is_active,
                  isSoftDeleted
                });
                return isSoftDeleted;
              })
              .map((g) => g.id),
          ];
          deletedGroupsCount = deletedGroupIds.length;
          console.log("🔍 [DELETE DEBUG] deletedGroupIds:", deletedGroupIds);
          if (deletedGroupIds.length > 0) {
            console.log(`    - ${deletedGroupIds.length} group(s) deleted (hard or soft-delete)`);
            deletedGroupIds.forEach((groupId) => {
              const deletedGroup = oldGroups.find((g) => g.id === groupId) ||
                newGroups.find((g) => g.id === groupId);
              const deleteType = newGroupIds.has(groupId) ? 'soft-delete' : 'hard-delete';
              console.log(
                `      - Deleting group "${deletedGroup?.name}" (${groupId}) - ${deleteType}`,
              );
              console.log("🔍 [DELETE DEBUG] About to call callbacks.wsDeleteStaffGroup for:", groupId);
              callbacks.wsDeleteStaffGroup(groupId);
              console.log("🔍 [DELETE DEBUG] Called callbacks.wsDeleteStaffGroup for:", groupId);
            });
          }

          // Detect UPDATED groups (exist in both, but content changed)
          const updatedGroups = newGroups.filter((newGroup) => {
            if (!oldGroupIds.has(newGroup.id)) return false; // Skip newly created
            if (newGroup.is_active === false) return false; // Skip soft-deleted groups

            const oldGroup = oldGroups.find((g) => g.id === newGroup.id);
            // ✅ FIX: ONLY compare user-editable fields
            // EXCLUDE auto-generated fields: updatedAt, createdAt, isActive, versionId, restaurantId
            // This prevents infinite loops from server-side timestamp updates
            const oldData = {
              name: oldGroup?.name,
              description: oldGroup?.description,
              color: oldGroup?.color,
              members: oldGroup?.members || [],
            };
            const newData = {
              name: newGroup.name,
              description: newGroup.description,
              color: newGroup.color,
              members: newGroup.members || [],
            };
            return JSON.stringify(oldData) !== JSON.stringify(newData);
          });

          changedGroupsCount = updatedGroups.length;
          if (updatedGroups.length > 0) {
            console.log(`    - ${updatedGroups.length} group(s) updated`);
            updatedGroups.forEach((group) => {
              const oldGroup = oldGroups.find((g) => g.id === group.id);
              console.log(
                `      - Updating group "${group.name}": ${oldGroup?.members?.length || 0} → ${group.members?.length || 0} members`,
              );
              callbacks.wsUpdateStaffGroups(group);
            });
          }

          console.log(
            `  - Summary: ${createdGroupsCount} created, ${changedGroupsCount} updated, ${deletedGroupsCount} deleted`,
          );
        }
        } // ✅ FIX #5: Close the else block for initial load guard

        // Detect and update weekly limits
        if (
          JSON.stringify(oldSettings.weeklyLimits) !==
          JSON.stringify(newSettings.weeklyLimits)
        ) {
          console.log("  - Updating weekly_limits table");
          newSettings.weeklyLimits?.forEach((limit) => {
            callbacks.wsUpdateWeeklyLimits(limit);
          });
        }

        // Detect and update monthly limits
        if (
          JSON.stringify(oldSettings.monthlyLimits) !==
          JSON.stringify(newSettings.monthlyLimits)
        ) {
          console.log("  - Updating monthly_limits table");
          newSettings.monthlyLimits?.forEach((limit) => {
            callbacks.wsUpdateMonthlyLimits(limit);
          });
        }

        // Detect and update priority rules (differential update like staff groups)
        const oldRules = oldSettings.priorityRules || [];
        const newRules = newSettings.priorityRules || [];

        if (JSON.stringify(oldRules) !== JSON.stringify(newRules)) {
          console.log("  - Detecting priority_rules table changes...");
          console.log("🔍 [DIFF DEBUG] oldRules:", oldRules.map(r => ({ id: r.id, name: r.name })));
          console.log("🔍 [DIFF DEBUG] newRules:", newRules.map(r => ({ id: r.id, name: r.name })));

          const oldRuleIds = new Set(oldRules.map((r) => r.id));
          const newRuleIds = new Set(newRules.map((r) => r.id));

          console.log("🔍 [DIFF DEBUG] oldRuleIds:", Array.from(oldRuleIds));
          console.log("🔍 [DIFF DEBUG] newRuleIds:", Array.from(newRuleIds));

          // Detect CREATED rules (exist in new but not in old)
          const createdRules = newRules.filter((r) => {
            const isNew = !oldRuleIds.has(r.id);
            if (isNew) {
              console.log(`🔍 [DIFF DEBUG] Rule "${r.name}" (${r.id}) is NEW (not in oldRuleIds)`);
            }
            return isNew;
          });
          if (createdRules.length > 0) {
            console.log(`    - ${createdRules.length} new rule(s) created`);
            createdRules.forEach((rule) => {
              // 🔧 FIX #6: Skip if already creating this rule (prevent broadcast loop duplicates)
              if (inFlightPriorityRulesRef.current.has(rule.id)) {
                console.log(`⏭️ [FIX #6] Skipping duplicate CREATE for rule "${rule.name}" (${rule.id}) - already in flight`);
                return;
              }

              console.log(`      - Creating rule "${rule.name}" (${rule.id})`);
              inFlightPriorityRulesRef.current.add(rule.id); // Mark as in-flight
              callbacks.wsCreatePriorityRule(rule);

              // Clear after 5 seconds (safety timeout to prevent memory leak)
              setTimeout(() => {
                inFlightPriorityRulesRef.current.delete(rule.id);
              }, 5000);
            });
          }

          // Detect DELETED rules (exist in old but not in new)
          // 🔧 FIX #2: Skip items that exist in new state but are soft-deleted
          const deletedRuleIds = [...oldRuleIds].filter((id) => {
            if (!newRuleIds.has(id)) {
              const oldRule = oldRules.find((r) => r.id === id);
              const newRule = newRules.find((r) => r.id === id);

              // ✅ FIX #2: Skip if item exists in new state but is soft-deleted
              if (newRule && newRule.is_active === false) {
                console.log(`🔧 [FIX #2] Skipping hard delete for soft-deleted rule: ${id} (${newRule.name})`);
                return false;
              }

              // Only delete if rule was active
              return oldRule && oldRule.is_active !== false;
            }
            return false;
          });
          if (deletedRuleIds.length > 0) {
            console.log(`    - ${deletedRuleIds.length} rule(s) deleted`);
            deletedRuleIds.forEach((ruleId) => {
              const deletedRule = oldRules.find((r) => r.id === ruleId);
              console.log(`      - Deleting rule "${deletedRule?.name}" (${ruleId})`);
              callbacks.wsDeletePriorityRule(ruleId);
            });
          }

          // Detect UPDATED rules (exist in both, but content changed)
          const updatedRules = newRules.filter((newRule) => {
            if (!oldRuleIds.has(newRule.id)) return false; // Skip newly created

            const oldRule = oldRules.find((r) => r.id === newRule.id);
            if (!oldRule) return false;

            // Compare rule content (normalize before comparison)
            const normalizeRule = (r) => ({
              id: r.id,
              name: r.name,
              description: r.description,
              staffId: r.staffId, // Legacy single staff
              staffIds: r.staffIds || [], // ✅ FIX: Include staffIds array for comparison!
              shiftType: r.shiftType,
              daysOfWeek: r.daysOfWeek || [],
              ruleType: r.ruleType,
              priorityLevel: r.priorityLevel,
              isActive: r.isActive,
            });

            return JSON.stringify(normalizeRule(oldRule)) !== JSON.stringify(normalizeRule(newRule));
          });

          if (updatedRules.length > 0) {
            console.log(`    - ${updatedRules.length} rule(s) updated`);
            updatedRules.forEach((rule) => {
              console.log(`      - Updating rule "${rule.name}" (${rule.id})`);
              callbacks.wsUpdatePriorityRules(rule);
            });
          }

          console.log(
            `  - Summary: ${createdRules.length} created, ${updatedRules.length} updated, ${deletedRuleIds.length} deleted`,
          );
        }

        // Detect and update ML parameters
        if (
          JSON.stringify(oldSettings.mlParameters) !==
          JSON.stringify(newSettings.mlParameters)
        ) {
          console.log("  - Updating ml_model_configs table");
          callbacks.wsUpdateMLConfig(newSettings.mlParameters);
        }

        // Detect and update daily limits (localStorage-only for now)
        // Note: dailyLimits are not stored in a separate WebSocket table
        // They're part of the settings blob in localStorage
        if (
          JSON.stringify(oldSettings.dailyLimits) !==
          JSON.stringify(newSettings.dailyLimits)
        ) {
          console.log("  - Daily limits changed (localStorage-only):", newSettings.dailyLimits);
        }

        // Detect and update backup assignments (differential update like staff groups & priority rules)
        const oldBackupAssignments = oldSettings.backupAssignments || [];
        const newBackupAssignments = newSettings.backupAssignments || [];

        if (JSON.stringify(oldBackupAssignments) !== JSON.stringify(newBackupAssignments)) {
          console.log("  - Detecting staff_backup_assignments table changes...");
          console.log("🔍 [BACKUP DIFF] oldBackupAssignments:", oldBackupAssignments.map(a => ({ id: a.id, groupId: a.groupId, staffId: a.staffId })));
          console.log("🔍 [BACKUP DIFF] newBackupAssignments:", newBackupAssignments.map(a => ({ id: a.id, groupId: a.groupId, staffId: a.staffId })));

          const oldAssignmentIds = new Set(oldBackupAssignments.map((a) => a.id));
          const newAssignmentIds = new Set(newBackupAssignments.map((a) => a.id));

          // Detect CREATED assignments (exist in new but not in old)
          const createdAssignments = newBackupAssignments.filter((a) => !oldAssignmentIds.has(a.id));
          if (createdAssignments.length > 0) {
            console.log(`    - ${createdAssignments.length} new backup assignment(s) created`);
            createdAssignments.forEach((assignment) => {
              console.log(`      - Creating backup assignment: ${assignment.groupId} → ${assignment.staffId}`);
              callbacks.wsCreateBackupAssignment(assignment);
            });
          }

          // Detect DELETED assignments (exist in old but not in new)
          const deletedAssignmentIds = [...oldAssignmentIds].filter((id) => !newAssignmentIds.has(id));
          if (deletedAssignmentIds.length > 0) {
            console.log(`    - ${deletedAssignmentIds.length} backup assignment(s) deleted`);
            deletedAssignmentIds.forEach((assignmentId) => {
              const deletedAssignment = oldBackupAssignments.find((a) => a.id === assignmentId);
              console.log(`      - Deleting backup assignment: ${deletedAssignment?.groupId} → ${deletedAssignment?.staffId} (${assignmentId})`);
              callbacks.wsDeleteBackupAssignment(assignmentId);
            });
          }

          // Detect UPDATED assignments (exist in both, but content changed)
          const updatedAssignments = newBackupAssignments.filter((newAssignment) => {
            if (!oldAssignmentIds.has(newAssignment.id)) return false; // Skip newly created

            const oldAssignment = oldBackupAssignments.find((a) => a.id === newAssignment.id);
            if (!oldAssignment) return false;

            // Compare assignment content (normalize before comparison)
            const normalizeAssignment = (a) => ({
              id: a.id,
              groupId: a.groupId,
              staffId: a.staffId,
              priority: a.priority || 0,
              isActive: a.isActive ?? true,
            });

            return JSON.stringify(normalizeAssignment(oldAssignment)) !== JSON.stringify(normalizeAssignment(newAssignment));
          });

          if (updatedAssignments.length > 0) {
            console.log(`    - ${updatedAssignments.length} backup assignment(s) updated`);
            updatedAssignments.forEach((assignment) => {
              console.log(`      - Updating backup assignment: ${assignment.groupId} → ${assignment.staffId} (${assignment.id})`);
              callbacks.wsUpdateBackupAssignment(assignment);
            });
          }

          console.log(
            `  - Summary: ${createdAssignments.length} created, ${updatedAssignments.length} updated, ${deletedAssignmentIds.length} deleted`,
          );
        }

        // ✅ OPTIMISTIC UPDATE: Update local state AFTER all change detection completes
        // This prevents race conditions where ref updates before all comparisons finish
        settingsRef.current = newSettings;
        setSettings(newSettings);

        // WebSocket updates are authoritative - no unsaved changes
        setValidationErrors({});
      } else {
        // localStorage mode - traditional behavior
        setSettings(newSettings);
        setHasUnsavedChanges(true);
        setValidationErrors({});
      }
    },
    [useWebSocket, settings],
  ); // FIX: Added settings dependency for change detection

  /**
   * Reset settings to defaults (multi-table aware)
   */
  const resetToDefaults = useCallback(async () => {
    // 🔍 DEBUG: Log reset trigger with stack trace for debugging
    console.log("🔄 RESET TRIGGERED - Settings reset initiated");
    console.log("  - Mode:", useWebSocket ? "WebSocket multi-table" : "localStorage");
    console.log("  - Current settings counts:", {
      staffGroups: settings?.staffGroups?.length || 0,
      priorityRules: settings?.priorityRules?.length || 0,
      weeklyLimits: settings?.weeklyLimits?.length || 0,
      monthlyLimits: settings?.monthlyLimits?.length || 0,
    });
    console.log("  - Stack trace:", new Error().stack);

    try {
      setIsLoading(true);

      if (useWebSocket) {
        console.log("🔄 Resetting settings via WebSocket multi-table backend");
        console.log("  - Sending SETTINGS_RESET message to Go server");
        // WebSocket mode: send multi-table reset to Go server
        await wsResetSettings();
        console.log("✅ Multi-table reset complete");
        console.log("  - Go server should insert default settings (8 staff groups, 4 daily limits, 1 monthly limit)");
      } else {
        console.log("🔄 Resetting settings via localStorage mode");
        // localStorage mode: use configService
        await configService.resetToDefaults();
        const defaultSettings = configService.getSettings();
        console.log("  - Default settings loaded:", {
          staffGroups: defaultSettings?.staffGroups?.length || 0,
          priorityRules: defaultSettings?.priorityRules?.length || 0,
          weeklyLimits: defaultSettings?.weeklyLimits?.length || 0,
          monthlyLimits: defaultSettings?.monthlyLimits?.length || 0,
        });
        setSettings(defaultSettings);
      }

      setHasUnsavedChanges(false);
      setValidationErrors({});
    } catch (err) {
      console.error("❌ Failed to reset to defaults:", err);
      console.error("  - Error message:", err.message);
      console.error("  - Error stack:", err.stack);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket, wsResetSettings, settings]);

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

        if (useWebSocket) {
          console.log(
            "📥 Imported configuration - migrating to WebSocket multi-table backend",
          );
          // In WebSocket mode, trigger migration after import
          wsMigrateSettings(JSON.parse(configJson)).catch((err) => {
            console.error("Migration failed after import:", err);
          });
        } else {
          // Reload settings after import (localStorage mode)
          loadSettings();
        }

        return { success: true };
      } catch (err) {
        setError("Failed to import configuration: " + err.message);
        return { success: false, error: err.message };
      }
    },
    [loadSettings, useWebSocket, wsMigrateSettings],
  );

  /**
   * Migrate localStorage settings to WebSocket multi-table backend
   * @returns {Promise<void>}
   */
  const migrateToBackend = useCallback(async () => {
    if (!useWebSocket) {
      throw new Error(
        "WebSocket not connected - cannot migrate to multi-table backend",
      );
    }

    try {
      setIsLoading(true);
      console.log("🚀 Starting localStorage → multi-table backend migration");

      // Get localStorage settings
      const localSettings = localStorage.getItem("shift-schedule-settings");
      if (!localSettings) {
        throw new Error("No localStorage settings to migrate");
      }

      const parsedSettings = JSON.parse(localSettings);

      // Send migration request (will map to multi-table structure on server)
      await wsMigrateSettings(parsedSettings);

      console.log("✅ Migration complete (localStorage → multi-table backend)");
      console.log(
        `  - Staff Groups: ${parsedSettings.staffGroups?.length || 0} items`,
      );
      console.log(
        `  - Daily Limits: ${parsedSettings.weeklyLimits?.length || 0} items`,
      );
      console.log(
        `  - Monthly Limits: ${parsedSettings.monthlyLimits?.length || 0} items`,
      );
      console.log(
        `  - Priority Rules: ${parsedSettings.priorityRules?.length || 0} items`,
      );
      console.log(
        `  - ML Parameters: ${parsedSettings.mlParameters ? "1 config" : "0 configs"}`,
      );
    } catch (err) {
      console.error("Failed to migrate settings:", err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [useWebSocket, wsMigrateSettings]);

  // Autosave functionality (localStorage mode only - WebSocket is authoritative)
  const autosaveSettings = useCallback(
    async (settingsToSave) => {
      if (useWebSocket) {
        // WebSocket mode: no autosave needed (real-time sync)
        return { success: true };
      }
      return await saveSettings(settingsToSave, true); // Skip loading state for autosave
    },
    [saveSettings, useWebSocket],
  );

  const {
    isAutosaving,
    lastSaveTime,
    saveError: autosaveError,
    saveNow: saveNowAutosave,
    cancelAutosave,
  } = useAutosave(autosaveSettings, settings, {
    delay: 400, // 400ms debounce
    enabled: isAutosaveEnabled && !useWebSocket, // Disable autosave in WebSocket mode
    onSaveSuccess: () => {
      // Settings autosaved successfully (localStorage mode only)
    },
    onSaveError: (error) => {
      console.warn("Autosave failed:", error);
    },
  });

  // Load settings on mount (localStorage mode only)
  useEffect(() => {
    if (!useWebSocket) {
      loadSettings();
    }
  }, [loadSettings, useWebSocket]);

  return {
    // State
    settings,
    version: wsVersion,
    isLoading: useWebSocket ? wsLoading : isLoading,
    error: useWebSocket ? wsError : error,
    hasUnsavedChanges,
    validationErrors,

    // Actions (multi-table aware)
    updateSettings,
    saveSettings, // localStorage only
    loadSettings, // localStorage only
    resetToDefaults,
    migrateToBackend, // NEW: localStorage → multi-table backend migration
    exportConfiguration,
    importConfiguration,

    // Backend mode indicators (NEW)
    backendMode: useWebSocket ? "websocket-multitable" : "localStorage",
    isConnectedToBackend: useWebSocket,
    connectionStatus: useWebSocket ? connectionStatus : "localStorage",

    // Version info (NEW - multi-table backend only)
    currentVersion: wsVersion?.versionNumber,
    versionName: wsVersion?.name,
    isVersionLocked: wsVersion?.isLocked,

    // Autosave (localStorage only - disabled in WebSocket mode)
    isAutosaving,
    lastSaveTime,
    autosaveError,
    isAutosaveEnabled,
    setIsAutosaveEnabled,
    saveNowAutosave,
    cancelAutosave,

    // Utilities
    validateSettings: (settingsToValidate) =>
      configService.validateSettings(settingsToValidate),
  };
};
