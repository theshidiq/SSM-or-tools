// Staff migration and utility functions

// Migrate legacy staff data to new UUIDv7 format
export const migrateStaffMembers = (staffMembersData) => {
  if (!staffMembersData || !Array.isArray(staffMembersData)) {
    return [];
  }
  
  const uuidMap = {
    'chef': '01934d2c-8a7b-7000-8000-1a2b3c4d5e6f',
    'iseki': '01934d2c-8a7b-7001-8001-2b3c4d5e6f7a', 
    'yogi': '01934d2c-8a7b-7002-8002-3c4d5e6f7a8b',
    'tanabe': '01934d2c-8a7b-7003-8003-4d5e6f7a8b9c',
    'koto': '01934d2c-8a7b-7004-8004-5e6f7a8b9c0d',
    'koike': '01934d2c-8a7b-7005-8005-6f7a8b9c0d1e',
    'kishi': '01934d2c-8a7b-7006-8006-7a8b9c0d1e2f',
    'kamal': '01934d2c-8a7b-7007-8007-8b9c0d1e2f3a',
    'takano': '01934d2c-8a7b-7008-8008-9c0d1e2f3a4b',
    'yasui': '01934d2c-8a7b-7009-8009-0d1e2f3a4b5c',
    'nakata': '01934d2c-8a7b-700a-800a-1e2f3a4b5c6d'
  };

  return staffMembersData.map(staff => {
    if (typeof staff === 'string') {
      // Legacy string format - convert to object with UUID
      const staffId = staff.toLowerCase();
      return {
        id: uuidMap[staffId] || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: staff,
        position: 'Staff',
        color: 'position-staff',
        status: '派遣',
        startPeriod: { year: 2018, month: 4, day: 1 },
        endPeriod: null
      };
    } else if (staff && typeof staff === 'object') {
      // Already object format - ensure it has proper UUID
      const staffKey = staff.name?.toLowerCase().replace(/\s+/g, '');
      return {
        ...staff,
        id: staff.id || uuidMap[staffKey] || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: staff.status || '派遣',
        startPeriod: staff.startPeriod || { year: 2018, month: 4, day: 1 },
        endPeriod: staff.endPeriod || null
      };
    }
    return staff;
  });
};

// Check if staff is active in current period
export const isStaffActiveInCurrentPeriod = (staff, dateRange = []) => {
  if (!staff || !staff.startPeriod || !dateRange.length) return true;
  
  try {
    const periodStart = dateRange[0];
    const periodEnd = dateRange[dateRange.length - 1];
    
    // Create start date from staff startPeriod
    const staffStartDate = new Date(
      staff.startPeriod.year,
      staff.startPeriod.month - 1, // month is 0-indexed
      staff.startPeriod.day || 1
    );
    
    // Check if staff starts after period ends
    if (staffStartDate > periodEnd) {
      return false;
    }
    
    // Check if staff has ended before period starts
    if (staff.endPeriod) {
      const staffEndDate = new Date(
        staff.endPeriod.year,
        staff.endPeriod.month - 1, // month is 0-indexed  
        staff.endPeriod.day || 31
      );
      
      // If staff ended before period starts
      if (staffEndDate < periodStart) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.warn('Error checking staff activity:', error, staff);
    return true; // Default to showing staff if there's an error
  }
};

// Get ordered staff members with special ordering (中田 at end)
export const getOrderedStaffMembers = (staffMembers, dateRange = []) => {
  try {
    // Defensive check
    if (!staffMembers || !Array.isArray(staffMembers) || staffMembers.length === 0) {
      return []; // Return empty array if no staff members
    }
    
    // First filter out staff who are not active in the current period
    const activeStaff = staffMembers.filter(staff => {
      try {
        return staff && isStaffActiveInCurrentPeriod(staff, dateRange);
      } catch (error) {
        // If there's an error checking activity, include the staff member
        console.warn('Error checking staff activity:', error, staff);
        return true;
      }
    });
    
    // If no active staff found but we have staff members, return all staff (fallback)
    if (activeStaff.length === 0 && staffMembers.length > 0) {
      const nakataStaff = staffMembers.find(staff => staff && staff.name === '中田');
      const otherStaff = staffMembers.filter(staff => staff && staff.name !== '中田');
      return nakataStaff ? [...otherStaff, nakataStaff] : staffMembers;
    }
    
    const nakataStaff = activeStaff.find(staff => staff && staff.name === '中田');
    const otherStaff = activeStaff.filter(staff => staff && staff.name !== '中田');
    return nakataStaff ? [...otherStaff, nakataStaff] : activeStaff;
  } catch (error) {
    console.error('Error in getOrderedStaffMembers:', error);
    return staffMembers || []; // Return original staff members or empty array
  }
};

// Migrate legacy schedule data from string IDs to UUIDs
export const migrateScheduleData = (scheduleData, staffMembers) => {
  if (!scheduleData || typeof scheduleData !== 'object') {
    return {};
  }

  const uuidMap = {
    'chef': '01934d2c-8a7b-7000-8000-1a2b3c4d5e6f',
    'iseki': '01934d2c-8a7b-7001-8001-2b3c4d5e6f7a', 
    'yogi': '01934d2c-8a7b-7002-8002-3c4d5e6f7a8b',
    'tanabe': '01934d2c-8a7b-7003-8003-4d5e6f7a8b9c',
    'koto': '01934d2c-8a7b-7004-8004-5e6f7a8b9c0d',
    'koike': '01934d2c-8a7b-7005-8005-6f7a8b9c0d1e',
    'kishi': '01934d2c-8a7b-7006-8006-7a8b9c0d1e2f',
    'kamal': '01934d2c-8a7b-7007-8007-8b9c0d1e2f3a',
    'takano': '01934d2c-8a7b-7008-8008-9c0d1e2f3a4b',
    'yasui': '01934d2c-8a7b-7009-8009-0d1e2f3a4b5c',
    'nakata': '01934d2c-8a7b-700a-800a-1e2f3a4b5c6d'
  };

  const migratedSchedule = {};
  
  // First, copy all UUID-based entries as-is
  Object.keys(scheduleData).forEach(key => {
    if (key.startsWith('01934d2c-') || key === '_staff_members') {
      migratedSchedule[key] = scheduleData[key];
    } else if (uuidMap[key]) {
      // Migrate legacy string IDs to UUIDs
      migratedSchedule[uuidMap[key]] = scheduleData[key];
    }
  });

  // Ensure all current staff members have schedule entries
  staffMembers.forEach(staff => {
    if (staff && staff.id && !migratedSchedule[staff.id]) {
      migratedSchedule[staff.id] = {};
    }
  });

  return migratedSchedule;
};

// Initialize schedule data structure
export const initializeSchedule = (staffMembers, dateRange) => {
  const scheduleData = {};
  
  // Create schedule structure for each staff member
  staffMembers.forEach(staff => {
    if (staff && staff.id) {
      scheduleData[staff.id] = {};
      
      // Initialize all dates for this staff member
      dateRange.forEach(date => {
        const dateKey = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        scheduleData[staff.id][dateKey] = ''; // Start with blank
      });
    }
  });
  
  return scheduleData;
};