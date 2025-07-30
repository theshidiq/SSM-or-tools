import { format } from "date-fns";
import { isStaffActiveInCurrentPeriod } from "./staffUtils";

// Calculate vacation days for a staff member
export const calculateVacationDays = (staffId, schedule, dateRange) => {
  if (!staffId || !schedule || !Array.isArray(dateRange)) {
    return 0;
  }

  let vacationDays = 0;
  dateRange.forEach((date) => {
    if (!date) return;
    const dateKey = format(date, "yyyy-MM-dd");
    // Safe access to schedule data
    const staffSchedule = schedule[staffId];
    const shift =
      staffSchedule && staffSchedule[dateKey] ? staffSchedule[dateKey] : "";

    if (shift === "early") {
      vacationDays += 0.5; // △ = 0.5 days
    } else if (
      shift === "off" ||
      shift === "unavailable" ||
      shift === "holiday"
    ) {
      vacationDays += 1; // × and ⊘ and ★ = 1 day each
    }
  });

  return vacationDays;
};

// Generate comprehensive statistics for all staff
export const generateStatistics = (schedule, staffMembers, dateRange) => {
  const stats = {
    totalDays: dateRange ? dateRange.length : 0,
    staffStats: {},
  };

  // Ensure staffMembers is an array and dateRange exists
  if (!Array.isArray(staffMembers) || !dateRange || !schedule) {
    return stats;
  }

  // Only calculate stats for active staff members
  const activeStaff = staffMembers.filter(
    (staff) => staff && isStaffActiveInCurrentPeriod(staff, dateRange),
  );

  activeStaff.forEach((staff) => {
    if (!staff || !staff.id) return;

    stats.staffStats[staff.id] = {
      name: staff.name || "Unknown",
      position: staff.position || "",
      early: 0,
      normal: 0,
      late: 0,
      off: 0,
      holiday: 0,
      unavailable: 0,
      workDays: 0,
      vacationDays: 0,
    };

    dateRange.forEach((date) => {
      if (!date) return;

      const dateKey = format(date, "yyyy-MM-dd");
      // Safe access to schedule data
      const staffSchedule = schedule[staff.id];
      const shift =
        staffSchedule && staffSchedule[dateKey] ? staffSchedule[dateKey] : "";

      // Count shifts with proper mapping
      // Exclude medamayaki and zensai from all statistics
      if (
        shift === "medamayaki" ||
        shift === "zensai" ||
        shift === "◎" ||
        shift === "▣"
      ) {
        return; // Don't count these shifts at all
      }

      // Map shift values to statistics categories
      // Handle both symbol characters and key names
      let countedShift = shift;
      if (shift === "" || shift === undefined || shift === null) {
        // For パート staff, empty cells default to unavailable
        if (staff.status === "パート") {
          countedShift = "off"; // Count as day off for パート
        } else {
          countedShift = "normal"; // Blank counts as normal for other staff
        }
      } else if (shift === "normal" || shift === "special" || shift === "●") {
        countedShift = "normal"; // Normal/Special counts as normal
      } else if (shift === "early" || shift === "△") {
        countedShift = "early"; // Early shift or Triangle symbol
      } else if (
        shift === "off" ||
        shift === "unavailable" ||
        shift === "×" ||
        shift === "⊘"
      ) {
        countedShift = "off"; // Off/Unavailable/Cross symbol
      } else if (shift === "holiday" || shift === "★") {
        countedShift = "holiday"; // Holiday or Star symbol
      } else if (shift === "late" || shift === "◇") {
        countedShift = "late"; // Late shift or Diamond symbol
      } else if (shift === "○") {
        countedShift = "normal"; // Circle symbol for パート normal shift
      } else if (shift === "medamayaki" || shift === "◎") {
        countedShift = "medamayaki"; // Will be excluded above
      } else if (shift === "zensai" || shift === "▣") {
        countedShift = "zensai"; // Will be excluded above
      }
      // Keep other values as they are

      if (
        countedShift &&
        stats.staffStats[staff.id][countedShift] !== undefined
      ) {
        stats.staffStats[staff.id][countedShift]++;
      }

      // Count work days (blank counts as working for non-パート, off/unavailable/holiday don't count as work days)
      // For パート staff, empty cells are unavailable and don't count as work days
      const isWorkDay =
        staff.status === "パート"
          ? shift !== "" &&
            shift !== null &&
            shift !== undefined &&
            countedShift !== "off" &&
            countedShift !== "holiday"
          : countedShift !== "off" && countedShift !== "holiday";

      if (
        isWorkDay &&
        shift !== "medamayaki" &&
        shift !== "zensai" &&
        shift !== "◎" &&
        shift !== "▣"
      ) {
        stats.staffStats[staff.id].workDays++;
      }
    });

    // Calculate vacation days using the dedicated function
    stats.staffStats[staff.id].vacationDays = calculateVacationDays(
      staff.id,
      schedule,
      dateRange,
    );
  });

  return stats;
};

// Calculate workload percentage for a staff member
export const calculateWorkloadPercentage = (staffStats, totalDays) => {
  if (!staffStats || totalDays === 0) return 0;
  return Math.round((staffStats.workDays / totalDays) * 100);
};
