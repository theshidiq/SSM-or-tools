import { useState, useEffect, useCallback } from "react";
import {
  migrateStaffMembers,
  isStaffActiveInCurrentPeriod,
  cleanupStaffData,
  cleanupAllPeriodsStaffData,
  fixStaffDataInconsistencies,
} from "../utils/staffUtils";
import { optimizedStorage, performanceMonitor } from "../utils/storageUtils";
import { defaultStaffMembersArray } from "../constants/staffConstants";
import { generateDateRange } from "../utils/dateUtils";

// Keep legacy function for backward compatibility during transition
const loadFromLocalStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn("Failed to load from localStorage:", error);
    return null;
  }
};

export const useStaffManagement = (currentMonthIndex, supabaseScheduleData) => {
  const [staffMembers, setStaffMembers] = useState([]);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);

  // Get persistent lastUpdateTime from localStorage, falls back to 0 if not found
  const getLastUpdateTime = () => {
    try {
      const stored = localStorage.getItem(
        `staff-last-update-${currentMonthIndex}`,
      );
      return stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      return 0;
    }
  };

  const [lastUpdateTime, setLastUpdateTime] = useState(getLastUpdateTime);

  // Helper function to set lastUpdateTime and persist it
  const setLastUpdateTimePersistent = (time) => {
    setLastUpdateTime(time);
    try {
      localStorage.setItem(
        `staff-last-update-${currentMonthIndex}`,
        time.toString(),
      );
    } catch (error) {
      console.warn("Failed to persist lastUpdateTime:", error);
    }
  };

  // Modal states for staff editing
  const [isAddingNewStaff, setIsAddingNewStaff] = useState(false);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState(null);
  const [showStaffEditModal, setShowStaffEditModal] = useState(false);
  const [editingStaffData, setEditingStaffData] = useState({
    name: "",
    position: "",
    status: "社員",
    startPeriod: null,
    endPeriod: null,
  });

  useEffect(() => {
    // Check for recent updates using persistent timestamp
    const persistentLastUpdate = getLastUpdateTime();
    const timeSinceLastUpdate = Date.now() - persistentLastUpdate;
    const skipInheritance = timeSinceLastUpdate < 30000; // 30 second cooldown for safety after refresh

    if (skipInheritance && persistentLastUpdate > 0) {
      console.log(
        "⏭️ Skipping inheritance logic - recent update detected from localStorage",
        {
          timeSinceLastUpdate: Math.round(timeSinceLastUpdate / 1000) + "s",
          lastUpdateTime: new Date(persistentLastUpdate).toISOString(),
          currentMonthIndex,
        },
      );

      // Load the current staff data without inheritance to prevent overwrites
      const currentStaff = optimizedStorage.getStaffData(currentMonthIndex);
      if (
        currentStaff &&
        Array.isArray(currentStaff) &&
        currentStaff.length > 0
      ) {
        setStaffMembers(currentStaff);
        setHasLoadedFromDb(true);
      }
      return; // Exit early to prevent any data loading that might overwrite updates
    }

    // Priority 1: Check optimized storage first (memory cache + localStorage)
    const localStaff = optimizedStorage.getStaffData(currentMonthIndex);

    try {
      if (localStaff && Array.isArray(localStaff) && localStaff.length > 0) {
        // Additional safety check: if any staff member has been modified recently, skip inheritance
        const hasRecentlyModifiedStaff = localStaff.some(
          (staff) =>
            staff.lastModified && Date.now() - staff.lastModified < 30000, // 30 seconds
        );

        if (hasRecentlyModifiedStaff) {
          console.log(
            "⏭️ Skipping inheritance - found recently modified staff in localStorage",
          );
          setStaffMembers(localStaff);
          setHasLoadedFromDb(true);
          return;
        }

        // Check if we need to inherit any missing staff from previous periods
        const inheritedStaff = [...localStaff];
        let hasInheritedNewStaff = false;

        // Only run inheritance if no recent updates detected
        if (!skipInheritance) {
          try {
            // Look through previous periods to find staff who should still be active but are missing
            for (
              let i = Math.max(0, currentMonthIndex - 6);
              i < currentMonthIndex;
              i++
            ) {
              const periodStaff = optimizedStorage.getStaffData(i);
              if (
                periodStaff &&
                Array.isArray(periodStaff) &&
                periodStaff.length > 0
              ) {
                // Check each staff member to see if they should be active in current period
                const currentDateRange = generateDateRange(currentMonthIndex);
                const activeInheritedStaff = periodStaff.filter((staff) => {
                  if (!staff) return false;

                  const isActive = isStaffActiveInCurrentPeriod(
                    staff,
                    currentDateRange,
                  );

                  // Debug logging for 高野
                  if (
                    staff.name === "高野" &&
                    process.env.NODE_ENV === "development"
                  ) {
                    console.log(
                      `🔍 Checking 高野 for period ${currentMonthIndex}:`,
                      {
                        isActive,
                        startPeriod: staff.startPeriod,
                        endPeriod: staff.endPeriod,
                        currentDateRange: {
                          start: currentDateRange[0]
                            ?.toISOString?.()
                            ?.split("T")[0],
                          end: currentDateRange[currentDateRange.length - 1]
                            ?.toISOString?.()
                            ?.split("T")[0],
                        },
                      },
                    );
                  }

                  return isActive;
                });

                // Add missing staff who should be active but aren't in local storage
                activeInheritedStaff.forEach((staff) => {
                  const existingStaff = inheritedStaff.find(
                    (existing) => existing.id === staff.id,
                  );
                  if (!existingStaff) {
                    inheritedStaff.push(staff);
                    hasInheritedNewStaff = true;

                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        `➕ Inherited missing staff ${staff.name} to period ${currentMonthIndex}`,
                      );
                    }
                  } else {
                    // Staff exists - check if we need to update with newer data
                    // Priority: current period > later periods > earlier periods
                    // Only update if the inherited staff has newer lastModified timestamp
                    const currentStaff = existingStaff;
                    const inheritedStaffData = staff;

                    // If the inherited staff has a more recent lastModified timestamp, update
                    if (
                      inheritedStaffData.lastModified &&
                      currentStaff.lastModified &&
                      inheritedStaffData.lastModified >
                        currentStaff.lastModified
                    ) {
                      // Replace the existing staff with newer data
                      const staffIndex = inheritedStaff.findIndex(
                        (s) => s.id === inheritedStaffData.id,
                      );
                      if (staffIndex !== -1) {
                        inheritedStaff[staffIndex] = inheritedStaffData;
                        hasInheritedNewStaff = true;
                        if (process.env.NODE_ENV === "development") {
                          console.log(
                            `🔄 Updated existing staff ${inheritedStaffData.name} with newer data from period ${i}`,
                          );
                        }
                      }
                    }
                  }
                });
              }
            }
          } catch (error) {
            console.warn("Error checking for missing inherited staff:", error);
          }
        }

        // Clean up the inherited staff to remove any duplicates
        const cleanedStaff = cleanupStaffData(inheritedStaff);
        setStaffMembers(cleanedStaff);

        // If we inherited new staff or cleaned up duplicates, save the updated list
        if (
          hasInheritedNewStaff ||
          cleanedStaff.length !== inheritedStaff.length
        ) {
          optimizedStorage.saveStaffData(currentMonthIndex, cleanedStaff);
        }

        setHasLoadedFromDb(true);
        // Development mode only: log load success
        // Also check if any staff from later periods should be backfilled to this period
        if (!skipInheritance) {
          try {
            let hasBackfilledStaff = false;

            // Check all later periods for staff that should be active in current period
            for (let i = currentMonthIndex + 1; i < 6; i++) {
              const laterPeriodStaff = optimizedStorage.getStaffData(i);
              if (
                laterPeriodStaff &&
                Array.isArray(laterPeriodStaff) &&
                laterPeriodStaff.length > 0
              ) {
                const currentDateRange = generateDateRange(currentMonthIndex);

                laterPeriodStaff.forEach((staff) => {
                  if (!staff) return;

                  const shouldBeActiveInCurrentPeriod =
                    isStaffActiveInCurrentPeriod(staff, currentDateRange);
                  const alreadyExists = inheritedStaff.find(
                    (existing) => existing.id === staff.id,
                  );

                  if (shouldBeActiveInCurrentPeriod && !alreadyExists) {
                    inheritedStaff.push(staff);
                    hasBackfilledStaff = true;

                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        `⬅️ Backfilled ${staff.name} from later period ${i} to current period ${currentMonthIndex}`,
                      );
                    }
                  }
                });
              }
            }

            // If we backfilled staff, update the storage and state
            if (hasBackfilledStaff) {
              optimizedStorage.saveStaffData(currentMonthIndex, inheritedStaff);
              setStaffMembers(inheritedStaff);
              hasInheritedNewStaff = true;
            }
          } catch (error) {
            console.warn(
              "Error checking for backfill from later periods:",
              error,
            );
          }
        }

        if (process.env.NODE_ENV === "development") {
          console.log(
            "✅ Loaded staff from optimized storage:",
            inheritedStaff.length,
            "members",
            hasInheritedNewStaff ? "(with inherited staff)" : "",
          );
          console.log(
            "Staff members:",
            inheritedStaff.map((s) => s.name),
          );
        }
        return;
      }
    } catch (error) {
      console.warn("Error loading staff from optimized storage:", error);
      // Continue to database fallback
    }

    // Priority 1.5: Check for staff from previous periods who should still be active
    // This handles staff continuity across periods based on their work dates
    const inheritedStaff = [];
    try {
      // Look through previous periods to find staff who should still be active
      for (
        let i = Math.max(0, currentMonthIndex - 6);
        i < currentMonthIndex;
        i++
      ) {
        const periodStaff = optimizedStorage.getStaffData(i);
        if (
          periodStaff &&
          Array.isArray(periodStaff) &&
          periodStaff.length > 0
        ) {
          // Check each staff member to see if they should be active in current period
          const currentDateRange = generateDateRange(currentMonthIndex);
          const activeInheritedStaff = periodStaff.filter((staff) => {
            if (!staff) return false;

            const isActive = isStaffActiveInCurrentPeriod(
              staff,
              currentDateRange,
            );

            return isActive;
          });

          // Merge with existing inherited staff, avoiding duplicates by ID
          // Prioritize staff from later periods (more recent data)
          activeInheritedStaff.forEach((staff) => {
            const existingIndex = inheritedStaff.findIndex(
              (existing) => existing.id === staff.id,
            );
            if (existingIndex === -1) {
              // Staff doesn't exist, add it
              inheritedStaff.push(staff);
            } else {
              // Staff exists - keep existing staff data (don't overwrite with older data)
              // Priority: current period > later periods > earlier periods
            }
          });
        }
      }

      if (inheritedStaff.length > 0) {
        // Clean up inherited staff to remove duplicates
        const cleanedInheritedStaff = cleanupStaffData(inheritedStaff);
        setStaffMembers(cleanedInheritedStaff);
        // Save cleaned inherited staff to current period storage for future loads
        optimizedStorage.saveStaffData(
          currentMonthIndex,
          cleanedInheritedStaff,
        );
        setHasLoadedFromDb(true);

        if (process.env.NODE_ENV === "development") {
          console.log(
            `📋 Inherited ${inheritedStaff.length} active staff members for period ${currentMonthIndex}:`,
            inheritedStaff.map((s) => s.name),
          );
        }
        return;
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `📋 No staff inherited for period ${currentMonthIndex} - continuing to database fallback`,
          );
        }
      }
    } catch (error) {
      console.warn("Error checking inherited staff:", error);
      // Continue to database fallback
    }

    // Priority 2: Fallback to database data if no localStorage data
    if (supabaseScheduleData && supabaseScheduleData.schedule_data) {
      if (
        supabaseScheduleData.schedule_data._staff_members &&
        supabaseScheduleData.schedule_data._staff_members.length > 0
      ) {
        const migratedStaffFromDb = migrateStaffMembers(
          supabaseScheduleData.schedule_data._staff_members,
        );
        setStaffMembers(migratedStaffFromDb);
      } else {
        const { _staff_members, ...scheduleData } =
          supabaseScheduleData.schedule_data;
        const staffIds = Object.keys(scheduleData);
        if (staffIds.length > 0) {
          // Create staff objects from schedule data keys
          const extractedStaff = staffIds.map((staffId) => ({
            id: staffId,
            name: `Staff-${staffId.slice(-4)}`, // Use last 4 chars of ID as name
            position: "Unknown",
            status: "社員",
            department: "",
            order: 0,
          }));

          setStaffMembers(extractedStaff);

          // Save to optimized storage for future use
          optimizedStorage.saveStaffData(currentMonthIndex, extractedStaff);
        } else {
          // No staff data found anywhere, use defaults
          console.log(
            "🔄 Loading default staff from constants:",
            defaultStaffMembersArray.length,
            "members",
          );
          console.log(
            "Default staff names:",
            defaultStaffMembersArray.map((s) => s.name),
          );
          setStaffMembers(defaultStaffMembersArray);
          optimizedStorage.saveStaffData(
            currentMonthIndex,
            defaultStaffMembersArray,
          );
        }
      }
      setHasLoadedFromDb(true);
    } else if (supabaseScheduleData === null) {
      // Database is explicitly null (no connection or empty)
      // Force use default staff data to override any cached data
      console.log(
        "🔄 Database is null, forcing default staff data:",
        defaultStaffMembersArray.length,
        "members",
      );
      console.log(
        "Default staff names:",
        defaultStaffMembersArray.map((s) => s.name),
      );
      setStaffMembers(defaultStaffMembersArray);
      optimizedStorage.saveStaffData(
        currentMonthIndex,
        defaultStaffMembersArray,
      );
      setHasLoadedFromDb(true);
    } else if (supabaseScheduleData && !supabaseScheduleData.schedule_data) {
      // Database exists but has no schedule data
      // Use optimized storage data if available, otherwise use default staff
      const fallbackStaff =
        optimizedStorage.getStaffData(currentMonthIndex) ||
        defaultStaffMembersArray;
      setStaffMembers(fallbackStaff);

      // If we're using default staff data, save it to optimized storage
      if (!optimizedStorage.getStaffData(currentMonthIndex)) {
        optimizedStorage.saveStaffData(
          currentMonthIndex,
          defaultStaffMembersArray,
        );
      }

      setHasLoadedFromDb(true);
    }
  }, [currentMonthIndex, supabaseScheduleData]); // Removed lastUpdateTime to prevent unnecessary re-runs

  const addStaff = useCallback(
    (newStaff, onSuccess) => {
      const updatedStaff = [...staffMembers, newStaff];
      setStaffMembers(updatedStaff);

      // Save to optimized storage
      optimizedStorage.saveStaffData(currentMonthIndex, updatedStaff);

      // Also check if this staff should be added to earlier periods based on their start date
      if (newStaff.startPeriod) {
        try {
          for (let i = 0; i < currentMonthIndex; i++) {
            const periodDateRange = generateDateRange(i);
            const shouldBeActiveInPeriod = isStaffActiveInCurrentPeriod(
              newStaff,
              periodDateRange,
            );

            if (shouldBeActiveInPeriod) {
              const periodStaff = optimizedStorage.getStaffData(i) || [];
              // Check if staff is not already in this period
              if (!periodStaff.find((staff) => staff.id === newStaff.id)) {
                const updatedPeriodStaff = [...periodStaff, newStaff];
                optimizedStorage.saveStaffData(i, updatedPeriodStaff);

                if (process.env.NODE_ENV === "development") {
                  console.log(
                    `🔄 Backfilled staff ${newStaff.name} to earlier period ${i}`,
                  );
                }
              }
            }
          }
        } catch (error) {
          console.warn("Error backfilling staff to earlier periods:", error);
        }
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          `➕ Added staff member: ${newStaff.name} to period ${currentMonthIndex}`,
        );
      }
      if (onSuccess) onSuccess(updatedStaff);
    },
    [staffMembers, currentMonthIndex],
  );

  const updateStaff = useCallback(
    (staffId, updatedData, onSuccess) => {
      console.log("🔄 useStaffManagement: updateStaff called", {
        staffId,
        updatedData,
        currentStaffMembers: staffMembers.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
        })),
        currentMonthIndex,
      });

      console.log("🔍 useStaffManagement: Detailed update data:", {
        staffId,
        updatedData,
        originalStaff: staffMembers.find((s) => s.id === staffId),
      });

      const updatedStaff = staffMembers.map((staff) =>
        staff.id === staffId
          ? { ...staff, ...updatedData, lastModified: Date.now() }
          : staff,
      );

      console.log(
        "🔄 useStaffManagement: Setting new staff members",
        updatedStaff.map((s) => ({ id: s.id, name: s.name, status: s.status })),
      );

      setStaffMembers(updatedStaff);

      // Save to optimized storage for current period
      optimizedStorage.saveStaffData(currentMonthIndex, updatedStaff);
      console.log(
        "💾 useStaffManagement: Saved to optimized storage for period",
        currentMonthIndex,
      );

      // Verify the save was successful by directly checking localStorage
      // This bypasses memory cache to ensure data is actually persisted
      const verifyData = (() => {
        try {
          const staffKey = `staff-${currentMonthIndex}`;
          const rawData = localStorage.getItem(staffKey);
          return rawData ? JSON.parse(rawData) : null;
        } catch (error) {
          console.warn("Failed to verify staff data from localStorage:", error);
          return optimizedStorage.getStaffData(currentMonthIndex);
        }
      })();

      const verifiedStaff = verifyData?.find((s) => s.id === staffId);
      console.log("🔍 useStaffManagement: Verification - saved staff data:", {
        staffId,
        savedStatus: verifiedStaff?.status,
        savedName: verifiedStaff?.name,
        verificationSource:
          verifyData === optimizedStorage.getStaffData(currentMonthIndex)
            ? "memory-cache"
            : "localStorage-direct",
      });

      // Also update this staff in all periods where they should be active
      // This prevents inheritance from overwriting the updated data
      const updatedStaffMember = updatedStaff.find((s) => s.id === staffId);
      if (updatedStaffMember) {
        console.log(
          "🔄 useStaffManagement: Syncing staff across all periods",
          updatedStaffMember,
        );
        try {
          for (let i = 0; i < 6; i++) {
            if (i === currentMonthIndex) continue; // Already saved above

            const periodStaff = optimizedStorage.getStaffData(i);
            if (periodStaff && Array.isArray(periodStaff)) {
              const staffIndex = periodStaff.findIndex((s) => s.id === staffId);
              if (staffIndex !== -1) {
                // Update the staff data in this period too
                const updatedPeriodStaff = [...periodStaff];
                updatedPeriodStaff[staffIndex] = {
                  ...updatedPeriodStaff[staffIndex],
                  ...updatedData,
                  lastModified: Date.now(),
                };
                optimizedStorage.saveStaffData(i, updatedPeriodStaff);
                console.log(
                  `💾 useStaffManagement: Updated staff in period ${i}`,
                );
              }
            }
          }
        } catch (error) {
          console.warn("Error updating staff across periods:", error);
        }
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          `🔄 Updated staff member: ${staffId} in period ${currentMonthIndex} and synced to all periods`,
        );
      }

      console.log("✅ useStaffManagement: Calling onSuccess callback");

      // Set the last update time to prevent inheritance from overriding
      setLastUpdateTimePersistent(Date.now());

      if (onSuccess) onSuccess(updatedStaff);
    },
    [staffMembers, currentMonthIndex],
  );

  const deleteStaff = useCallback(
    (staffIdToDelete, scheduleData, updateSchedule, onSuccess) => {
      // Remove staff from staff list
      const newStaffMembers = staffMembers.filter(
        (staff) => staff.id !== staffIdToDelete,
      );
      setStaffMembers(newStaffMembers);

      // Remove staff from schedule data
      const newSchedule = { ...scheduleData };
      delete newSchedule[staffIdToDelete];

      // Update schedule
      updateSchedule(newSchedule);

      // Save to optimized storage
      optimizedStorage.saveStaffData(currentMonthIndex, newStaffMembers);

      if (process.env.NODE_ENV === "development") {
        console.log(
          `🗑️ Deleted staff member: ${staffIdToDelete} from period ${currentMonthIndex}`,
        );
      }

      if (onSuccess) onSuccess(newStaffMembers);

      return { newStaffMembers, newSchedule };
    },
    [staffMembers, currentMonthIndex],
  );

  const editStaffName = useCallback(
    (staffId, newName, onSuccess) => {
      const updatedStaff = staffMembers.map((staff) =>
        staff.id === staffId ? { ...staff, name: newName } : staff,
      );
      setStaffMembers(updatedStaff);

      // Save to optimized storage
      optimizedStorage.saveStaffData(currentMonthIndex, updatedStaff);

      if (process.env.NODE_ENV === "development") {
        console.log(
          `✏️ Edited staff name: ${staffId} -> ${newName} in period ${currentMonthIndex}`,
        );
      }

      if (onSuccess) onSuccess(updatedStaff);
    },
    [staffMembers, currentMonthIndex],
  );

  const reorderStaff = useCallback(
    (reorderedStaff, onSuccess) => {
      setStaffMembers(reorderedStaff);

      // Save to optimized storage
      optimizedStorage.saveStaffData(currentMonthIndex, reorderedStaff);

      // Set update timestamp to prevent inheritance from overwriting
      setLastUpdateTimePersistent(Date.now());

      if (onSuccess) onSuccess(reorderedStaff);
    },
    [currentMonthIndex],
  );

  // Create new staff member with schedule initialization
  const createNewStaff = useCallback(
    (staffData, schedule, dateRange, onScheduleUpdate, onStaffUpdate) => {
      const newStaffId = `01934d2c-8a7b-7${Date.now().toString(16).slice(-3)}-8${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;

      const newStaff = {
        id: newStaffId,
        name: staffData.name || "新しいスタッフ",
        position: staffData.position || "Staff",
        color: "position-server",
        status: staffData.status,
        startPeriod: staffData.startPeriod,
        endPeriod: staffData.endPeriod,
      };

      const newStaffMembers = [...staffMembers, newStaff];

      // Add empty schedule data for new staff member
      const newSchedule = {
        ...schedule,
        [newStaffId]: {},
      };

      // Initialize all dates for the new staff member
      if (dateRange) {
        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];
          newSchedule[newStaffId][dateKey] = ""; // Start with blank
        });
      }

      // Update states
      setStaffMembers(newStaffMembers);
      if (onStaffUpdate) onStaffUpdate(newStaffMembers);
      if (onScheduleUpdate) onScheduleUpdate(newSchedule);

      // Save to optimized storage
      optimizedStorage.saveStaffData(currentMonthIndex, newStaffMembers);

      // Also check if this staff should be added to earlier periods based on their start date
      if (newStaff.startPeriod) {
        try {
          for (let i = 0; i < currentMonthIndex; i++) {
            const periodDateRange = generateDateRange(i);
            const shouldBeActiveInPeriod = isStaffActiveInCurrentPeriod(
              newStaff,
              periodDateRange,
            );

            if (shouldBeActiveInPeriod) {
              const periodStaff = optimizedStorage.getStaffData(i) || [];
              // Check if staff is not already in this period
              if (!periodStaff.find((staff) => staff.id === newStaff.id)) {
                const updatedPeriodStaff = [...periodStaff, newStaff];
                optimizedStorage.saveStaffData(i, updatedPeriodStaff);

                if (process.env.NODE_ENV === "development") {
                  console.log(
                    `🔄 Backfilled new staff ${newStaff.name} to earlier period ${i}`,
                  );
                }
              }
            }
          }
        } catch (error) {
          console.warn(
            "Error backfilling new staff to earlier periods:",
            error,
          );
        }
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          `🆕 Created new staff member: ${newStaff.name} in period ${currentMonthIndex}`,
        );
      }

      // Close modal
      setShowStaffEditModal(false);
      setIsAddingNewStaff(false);
      setEditingStaffData({
        name: "",
        position: "",
        status: "社員",
        startPeriod: null,
        endPeriod: null,
      });

      return { newStaffMembers, newSchedule };
    },
    [staffMembers, currentMonthIndex],
  );

  // Handle staff creation from modal
  const handleCreateStaff = useCallback(
    (staffData) => {
      const newStaffId = `01934d2c-8a7b-7${Date.now().toString(16).slice(-3)}-8${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`;

      const newStaff = {
        id: newStaffId,
        name: staffData.name || "新しいスタッフ",
        position: staffData.position || "Staff",
        color: "position-server",
        status: staffData.status,
        startPeriod: staffData.startPeriod,
        endPeriod: staffData.endPeriod,
        order: staffMembers.length,
      };

      addStaff(newStaff, () => {
        setShowStaffEditModal(false);
        setIsAddingNewStaff(false);
        setEditingStaffData({
          name: "",
          position: "",
          status: "社員",
          startPeriod: null,
          endPeriod: null,
        });

        // Set update timestamp to prevent inheritance from overwriting
        setLastUpdateTimePersistent(Date.now());

        // Log performance metrics after staff operations (development mode only)
        performanceMonitor.logSummary();
      });
    },
    [addStaff, staffMembers.length],
  );

  // Start adding new staff
  const startAddingNewStaff = useCallback(() => {
    setIsAddingNewStaff(true);
    setSelectedStaffForEdit(null);
    setEditingStaffData({
      name: "",
      position: "",
      status: "社員",
      startPeriod: null,
      endPeriod: null,
    });
    setShowStaffEditModal(true);
  }, []);

  // Clean up all periods staff data
  const cleanupAllPeriods = useCallback(() => {
    const totalCleaned = cleanupAllPeriodsStaffData(optimizedStorage);
    // Refresh current period after cleanup
    const currentStaff = optimizedStorage.getStaffData(currentMonthIndex);
    if (currentStaff) {
      setStaffMembers(currentStaff);
    }
    return totalCleaned;
  }, [currentMonthIndex]);

  // Fix staff data inconsistencies across periods
  const fixStaffInconsistencies = useCallback(() => {
    const fixedCount = fixStaffDataInconsistencies(optimizedStorage);
    // Refresh current period after fixing
    const currentStaff = optimizedStorage.getStaffData(currentMonthIndex);
    if (currentStaff) {
      setStaffMembers(currentStaff);
    }
    return fixedCount;
  }, [currentMonthIndex]);

  return {
    staffMembers,
    setStaffMembers,
    hasLoadedFromDb,
    isAddingNewStaff,
    setIsAddingNewStaff,
    selectedStaffForEdit,
    setSelectedStaffForEdit,
    showStaffEditModal,
    setShowStaffEditModal,
    editingStaffData,
    setEditingStaffData,
    addStaff,
    updateStaff,
    deleteStaff,
    editStaffName,
    reorderStaff,
    createNewStaff,
    handleCreateStaff,
    startAddingNewStaff,
    cleanupAllPeriods,
    fixStaffInconsistencies,
  };
};
