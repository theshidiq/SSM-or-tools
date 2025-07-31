// Staff migration and utility functions

// Migrate legacy staff data to new UUIDv7 format
export const migrateStaffMembers = (staffMembersData) => {
  if (!staffMembersData || !Array.isArray(staffMembersData)) {
    return [];
  }

  const uuidMap = {
    chef: "01934d2c-8a7b-7000-8000-1a2b3c4d5e6f",
    iseki: "01934d2c-8a7b-7001-8001-2b3c4d5e6f7a",
    yogi: "01934d2c-8a7b-7002-8002-3c4d5e6f7a8b",
    tanabe: "01934d2c-8a7b-7003-8003-4d5e6f7a8b9c",
    koto: "01934d2c-8a7b-7004-8004-5e6f7a8b9c0d",
    koike: "01934d2c-8a7b-7005-8005-6f7a8b9c0d1e",
    kishi: "01934d2c-8a7b-7006-8006-7a8b9c0d1e2f",
    kamal: "01934d2c-8a7b-7007-8007-8b9c0d1e2f3a",
    takano: "01934d2c-8a7b-7008-8008-9c0d1e2f3a4b",
    yasui: "01934d2c-8a7b-7009-8009-0d1e2f3a4b5c",
    nakata: "01934d2c-8a7b-700a-800a-1e2f3a4b5c6d",
  };

  return staffMembersData.map((staff) => {
    if (typeof staff === "string") {
      // Legacy string format - convert to object with UUID
      const staffId = staff.toLowerCase();
      return {
        id:
          uuidMap[staffId] ||
          `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: staff,
        position: "Staff",
        color: "position-staff",
        status: "派遣",
        startPeriod: { year: 2018, month: 4, day: 1 },
        endPeriod: null,
      };
    } else if (staff && typeof staff === "object") {
      // Already object format - ensure it has proper UUID
      const staffKey = staff.name?.toLowerCase().replace(/\s+/g, "");
      return {
        ...staff,
        id:
          staff.id ||
          uuidMap[staffKey] ||
          `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: staff.status || "派遣",
        startPeriod: staff.startPeriod || { year: 2018, month: 4, day: 1 },
        endPeriod: staff.endPeriod || null,
      };
    }
    return staff;
  });
};

// Check if staff is active in current period
export const isStaffActiveInCurrentPeriod = (staff, dateRange = []) => {
  // If no staff data or no date range, include the staff member
  if (!staff || !dateRange.length) return true;

  // If staff has no start period defined, include them (legacy data)
  if (!staff.startPeriod) return true;

  try {
    const periodStart = dateRange[0];
    const periodEnd = dateRange[dateRange.length - 1];

    // Create start date from staff startPeriod - use UTC to match dateRange
    const staffStartDate = new Date(
      Date.UTC(
        staff.startPeriod.year,
        staff.startPeriod.month - 1, // month is 0-indexed
        staff.startPeriod.day || 1,
      ),
    );

    // Check if staff starts after period ends
    if (staffStartDate > periodEnd) {
      return false;
    }

    // Check if staff has ended before period starts
    if (staff.endPeriod) {
      const staffEndDate = new Date(
        Date.UTC(
          staff.endPeriod.year,
          staff.endPeriod.month - 1, // month is 0-indexed
          staff.endPeriod.day || 31,
        ),
      );

      // If staff ended before period starts
      if (staffEndDate < periodStart) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn("Error checking staff activity:", error, staff);
    return true; // Default to showing staff if there's an error
  }
};

// Helper function to sort staff by start date (earliest first, no start date goes to end)
const sortByStartDate = (staffArray) => {
  return staffArray.sort((a, b) => {
    // If neither has start period, maintain original order
    if (!a.startPeriod && !b.startPeriod) return 0;

    // Staff without start period goes to end
    if (!a.startPeriod) return 1;
    if (!b.startPeriod) return -1;

    // Compare by year, then month, then day
    const aYear = a.startPeriod.year || 2018;
    const bYear = b.startPeriod.year || 2018;

    if (aYear !== bYear) {
      return aYear - bYear;
    }

    const aMonth = a.startPeriod.month || 1;
    const bMonth = b.startPeriod.month || 1;

    if (aMonth !== bMonth) {
      return aMonth - bMonth;
    }

    const aDay = a.startPeriod.day || 1;
    const bDay = b.startPeriod.day || 1;

    return aDay - bDay;
  });
};

// Get ordered staff members with special ordering (社員 > 派遣 > パート, sorted by start date within each group, then 中田 at very end)
export const getOrderedStaffMembers = (staffMembers, dateRange = []) => {
  try {
    // Defensive check
    if (
      !staffMembers ||
      !Array.isArray(staffMembers) ||
      staffMembers.length === 0
    ) {
      return []; // Return empty array if no staff members
    }

    // First filter out staff who are not active in the current period
    const activeStaff = staffMembers.filter((staff) => {
      try {
        return staff && isStaffActiveInCurrentPeriod(staff, dateRange);
      } catch (error) {
        // If there's an error checking activity, include the staff member
        console.warn("Error checking staff activity:", error, staff);
        return true;
      }
    });

    // If no active staff found but we have staff members, return all staff (fallback)
    if (activeStaff.length === 0 && staffMembers.length > 0) {
      const nakataStaff = staffMembers.find(
        (staff) => staff && staff.name === "中田",
      );
      const shainnStaff = sortByStartDate(
        staffMembers.filter(
          (staff) => staff && staff.status === "社員" && staff.name !== "中田",
        ),
      );
      const hakennStaff = sortByStartDate(
        staffMembers.filter(
          (staff) => staff && staff.status === "派遣" && staff.name !== "中田",
        ),
      );
      const partTimeStaff = sortByStartDate(
        staffMembers.filter(
          (staff) =>
            staff && staff.status === "パート" && staff.name !== "中田",
        ),
      );
      return [
        ...shainnStaff,
        ...hakennStaff,
        ...partTimeStaff,
        ...(nakataStaff ? [nakataStaff] : []),
      ];
    }

    // Separate staff by status: 社員, 派遣, パート, and 中田
    const nakataStaff = activeStaff.find(
      (staff) => staff && staff.name === "中田",
    );
    const shainnStaff = sortByStartDate(
      activeStaff.filter(
        (staff) => staff && staff.status === "社員" && staff.name !== "中田",
      ),
    );
    const hakennStaff = sortByStartDate(
      activeStaff.filter(
        (staff) => staff && staff.status === "派遣" && staff.name !== "中田",
      ),
    );
    const partTimeStaff = sortByStartDate(
      activeStaff.filter(
        (staff) => staff && staff.status === "パート" && staff.name !== "中田",
      ),
    );

    // Order: 社員 first, then 派遣, then パート (each sorted by start date), then 中田 at the very end
    const finalOrder = [
      ...shainnStaff,
      ...hakennStaff,
      ...partTimeStaff,
      ...(nakataStaff ? [nakataStaff] : []),
    ];

    return finalOrder;
  } catch (error) {
    console.error("Error in getOrderedStaffMembers:", error);
    return staffMembers || []; // Return original staff members or empty array
  }
};

// Migrate legacy schedule data from string IDs to UUIDs
export const migrateScheduleData = (scheduleData, staffMembers) => {
  if (!scheduleData || typeof scheduleData !== "object") {
    return {};
  }

  const uuidMap = {
    chef: "01934d2c-8a7b-7000-8000-1a2b3c4d5e6f",
    iseki: "01934d2c-8a7b-7001-8001-2b3c4d5e6f7a",
    yogi: "01934d2c-8a7b-7002-8002-3c4d5e6f7a8b",
    tanabe: "01934d2c-8a7b-7003-8003-4d5e6f7a8b9c",
    koto: "01934d2c-8a7b-7004-8004-5e6f7a8b9c0d",
    koike: "01934d2c-8a7b-7005-8005-6f7a8b9c0d1e",
    kishi: "01934d2c-8a7b-7006-8006-7a8b9c0d1e2f",
    kamal: "01934d2c-8a7b-7007-8007-8b9c0d1e2f3a",
    takano: "01934d2c-8a7b-7008-8008-9c0d1e2f3a4b",
    yasui: "01934d2c-8a7b-7009-8009-0d1e2f3a4b5c",
    nakata: "01934d2c-8a7b-700a-800a-1e2f3a4b5c6d",
  };

  const migratedSchedule = {};

  // First, copy all UUID-based entries as-is
  Object.keys(scheduleData).forEach((key) => {
    if (key.startsWith("01934d2c-") || key === "_staff_members") {
      migratedSchedule[key] = scheduleData[key];
    } else if (uuidMap[key]) {
      // Migrate legacy string IDs to UUIDs
      migratedSchedule[uuidMap[key]] = scheduleData[key];
    }
  });

  // Ensure all current staff members have schedule entries
  staffMembers.forEach((staff) => {
    if (staff && staff.id && !migratedSchedule[staff.id]) {
      migratedSchedule[staff.id] = {};
    }
  });

  return migratedSchedule;
};

// Clean up staff data by removing duplicates based on ID and name
export const cleanupStaffData = (staffMembers) => {
  if (!Array.isArray(staffMembers)) return [];

  const seenIds = new Set();
  const seenNames = new Set();
  const cleanedStaff = [];

  staffMembers.forEach((staff) => {
    if (!staff || !staff.id || !staff.name) return;

    // Skip if we've already seen this ID or name
    if (seenIds.has(staff.id) || seenNames.has(staff.name)) {
      return;
    }

    seenIds.add(staff.id);
    seenNames.add(staff.name);
    cleanedStaff.push(staff);
  });

  return cleanedStaff;
};

// Clean up all periods in local storage
export const cleanupAllPeriodsStaffData = (optimizedStorage) => {
  console.log("🧹 Starting cleanup of all periods...");
  let totalCleaned = 0;

  for (let periodIndex = 0; periodIndex < 6; periodIndex++) {
    const staffData = optimizedStorage.getStaffData(periodIndex);
    if (staffData && Array.isArray(staffData)) {
      const cleanedData = cleanupStaffData(staffData);
      if (cleanedData.length !== staffData.length) {
        optimizedStorage.saveStaffData(periodIndex, cleanedData);
        totalCleaned += staffData.length - cleanedData.length;
        console.log(
          `🧹 Period ${periodIndex}: ${staffData.length} → ${cleanedData.length} staff members`,
        );
      }
    }
  }

  console.log(
    `🧹 Cleanup complete! Removed ${totalCleaned} duplicate entries total.`,
  );
  return totalCleaned;
};

// Fix staff data inconsistencies across periods
export const fixStaffDataInconsistencies = (optimizedStorage) => {
  console.log("🔧 Starting staff data consistency fix...");

  // Build a map of staff by ID across all periods
  const staffMap = new Map();

  // First pass: collect all staff data from all periods
  for (let periodIndex = 0; periodIndex < 6; periodIndex++) {
    const staffData = optimizedStorage.getStaffData(periodIndex);
    if (staffData && Array.isArray(staffData)) {
      staffData.forEach((staff) => {
        if (staff && staff.id) {
          if (!staffMap.has(staff.id)) {
            staffMap.set(staff.id, []);
          }
          staffMap.get(staff.id).push({
            ...staff,
            periodIndex,
            lastModified: staff.lastModified || 0,
          });
        }
      });
    }
  }

  let fixedCount = 0;

  // Second pass: fix inconsistencies by using the most recent data
  staffMap.forEach((staffVersions, staffId) => {
    if (staffVersions.length > 1) {
      // Sort by lastModified (if available) or by period index (later periods are more recent)
      const sortedVersions = staffVersions.sort((a, b) => {
        if (a.lastModified && b.lastModified) {
          return b.lastModified - a.lastModified; // Most recent first
        }
        return b.periodIndex - a.periodIndex; // Later period first
      });

      const mostRecentVersion = sortedVersions[0];
      const staffName = mostRecentVersion.name;

      // Check if there are any inconsistencies
      const hasInconsistencies = staffVersions.some(
        (version) =>
          version.status !== mostRecentVersion.status ||
          JSON.stringify(version.startPeriod) !==
            JSON.stringify(mostRecentVersion.startPeriod) ||
          JSON.stringify(version.endPeriod) !==
            JSON.stringify(mostRecentVersion.endPeriod),
      );

      if (hasInconsistencies) {
        console.log(`🔧 Fixing inconsistencies for ${staffName}:`, {
          correctData: {
            status: mostRecentVersion.status,
            startPeriod: mostRecentVersion.startPeriod,
            endPeriod: mostRecentVersion.endPeriod,
          },
          fromPeriod: mostRecentVersion.periodIndex,
        });

        // Update all periods with the correct data
        staffVersions.forEach((version) => {
          const periodStaff = optimizedStorage.getStaffData(
            version.periodIndex,
          );
          if (periodStaff && Array.isArray(periodStaff)) {
            const staffIndex = periodStaff.findIndex((s) => s.id === staffId);
            if (staffIndex !== -1) {
              const updatedStaff = [...periodStaff];
              updatedStaff[staffIndex] = {
                ...updatedStaff[staffIndex],
                status: mostRecentVersion.status,
                startPeriod: mostRecentVersion.startPeriod,
                endPeriod: mostRecentVersion.endPeriod,
                lastModified: Date.now(),
              };
              optimizedStorage.saveStaffData(version.periodIndex, updatedStaff);
              fixedCount++;

              console.log(
                `  ✅ Updated ${staffName} in period ${version.periodIndex}`,
              );
            }
          }
        });
      }
    }
  });

  console.log(
    `🔧 Consistency fix complete! Fixed ${fixedCount} inconsistencies.`,
  );
  return fixedCount;
};

// Initialize schedule data structure (only for missing entries, preserves existing data)
export const initializeSchedule = (
  staffMembers,
  dateRange,
  existingSchedule = {},
) => {
  const scheduleData = { ...existingSchedule }; // Start with existing data

  // Create schedule structure for each staff member
  staffMembers.forEach((staff) => {
    if (staff && staff.id) {
      // Only initialize if staff doesn't exist in schedule
      if (!scheduleData[staff.id]) {
        scheduleData[staff.id] = {};
      }

      // Initialize missing dates for this staff member
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0]; // Format: YYYY-MM-DD
        // Only initialize if date doesn't exist (preserves existing data)
        if (scheduleData[staff.id][dateKey] === undefined) {
          scheduleData[staff.id][dateKey] = ""; // Start with blank
        }
      });
    }
  });

  return scheduleData;
};
