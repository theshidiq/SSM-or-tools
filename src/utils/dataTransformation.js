// Data transformation utilities for Supabase integration

// Transform current schedule data to Supabase format
export const transformScheduleToSupabase = (scheduleData, staffMembers) => {
  const shifts = [];
  const scheduleMetadata = {
    schedule_name: `Schedule ${new Date().toISOString().split("T")[0]}`,
    schedule_period_start: null,
    schedule_period_end: null,
    department: "Operations",
    manager_name: "Manager",
    status: "draft",
  };

  // Get date range from schedule data
  const allDates = new Set();
  Object.values(scheduleData).forEach((staffSchedule) => {
    Object.keys(staffSchedule).forEach((date) => allDates.add(date));
  });

  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length > 0) {
    scheduleMetadata.schedule_period_start = sortedDates[0];
    scheduleMetadata.schedule_period_end = sortedDates[sortedDates.length - 1];
  }

  // Transform schedule data to individual shifts
  Object.entries(scheduleData).forEach(([staffId, staffSchedule]) => {
    const staffMember = staffMembers.find((s) => s.id === staffId);

    Object.entries(staffSchedule).forEach(([date, shiftType]) => {
      if (shiftType && shiftType !== "off") {
        const shift = {
          date,
          staff_member: staffMember ? staffMember.name : staffId,
          shift_type: mapShiftType(shiftType),
          start_time: getShiftStartTime(shiftType),
          end_time: getShiftEndTime(shiftType),
          notes: shiftType === "holiday" ? "Public Holiday" : null,
        };
        shifts.push(shift);
      }
    });
  });

  return {
    scheduleMetadata,
    shifts,
    originalData: scheduleData,
  };
};

// Transform Supabase data back to current format
export const transformSupabaseToSchedule = (shifts, staffMembers) => {
  const scheduleData = {};

  // Initialize schedule data structure
  staffMembers.forEach((staff) => {
    scheduleData[staff.id] = {};
  });

  // Process shifts from database
  shifts.forEach((shift) => {
    const staffMember = staffMembers.find((s) => s.name === shift.staff_member);
    const staffId = staffMember ? staffMember.id : shift.staff_member;

    if (!scheduleData[staffId]) {
      scheduleData[staffId] = {};
    }

    scheduleData[staffId][shift.date] = mapSupabaseShiftType(shift.shift_type);
  });

  return scheduleData;
};

// Map current shift types to Supabase shift types
const mapShiftType = (currentShiftType) => {
  const shiftTypeMap = {
    early: "morning",
    normal: "afternoon",
    special: "evening",
    off: null,
    holiday: "full-day",
  };

  return shiftTypeMap[currentShiftType] || "afternoon";
};

// Map Supabase shift types back to current format
const mapSupabaseShiftType = (supabaseShiftType) => {
  const shiftTypeMap = {
    morning: "early",
    afternoon: "normal",
    evening: "special",
    night: "special",
    "full-day": "holiday",
  };

  return shiftTypeMap[supabaseShiftType] || "normal";
};

// Get shift start time based on shift type
const getShiftStartTime = (shiftType) => {
  const timeMap = {
    early: "10:00",
    normal: "11:00",
    special: "12:00",
    holiday: "09:00",
  };

  return timeMap[shiftType] || "11:00";
};

// Get shift end time based on shift type
const getShiftEndTime = (shiftType) => {
  const timeMap = {
    early: "18:00",
    normal: "20:00",
    special: "21:00",
    holiday: "18:00",
  };

  return timeMap[shiftType] || "20:00";
};

// Create sample schedule data for testing
export const createSampleScheduleData = (staffMembers) => {
  const sampleData = {};
  const startDate = new Date("2024-07-21");

  staffMembers.forEach((staff) => {
    sampleData[staff.id] = {};

    // Generate 30 days of sample data
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      // Random shift assignment
      const shiftTypes = ["early", "normal", "special", "off"];
      const randomShift =
        shiftTypes[Math.floor(Math.random() * shiftTypes.length)];

      sampleData[staff.id][dateStr] = randomShift;
    }
  });

  return sampleData;
};

// Validate schedule data structure
export const validateScheduleData = (scheduleData) => {
  const errors = [];

  if (!scheduleData || typeof scheduleData !== "object") {
    errors.push("Schedule data must be an object");
    return errors;
  }

  Object.entries(scheduleData).forEach(([staffId, staffSchedule]) => {
    if (!staffSchedule || typeof staffSchedule !== "object") {
      errors.push(`Staff schedule for ${staffId} must be an object`);
      return;
    }

    Object.entries(staffSchedule).forEach(([date, shiftType]) => {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push(`Invalid date format: ${date}`);
      }

      // Validate shift type - allow any non-empty string (predefined types + custom text)
      if (shiftType) {
        if (typeof shiftType !== "string") {
          errors.push(
            `Invalid shift type: ${shiftType} for ${staffId} on ${date} (must be string)`,
          );
        } else if (shiftType.trim() === "") {
          errors.push(`Empty shift type for ${staffId} on ${date}`);
        }
      }
    });
  });

  return errors;
};

// Merge schedule data (useful for conflict resolution)
export const mergeScheduleData = (localData, remoteData) => {
  const merged = { ...localData };

  Object.entries(remoteData).forEach(([staffId, staffSchedule]) => {
    if (!merged[staffId]) {
      merged[staffId] = {};
    }

    Object.entries(staffSchedule).forEach(([date, shiftType]) => {
      // Remote data takes precedence
      merged[staffId][date] = shiftType;
    });
  });

  return merged;
};
