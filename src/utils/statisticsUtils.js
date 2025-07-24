import { format } from 'date-fns';
import { isStaffActiveInCurrentPeriod } from './staffUtils';

// Calculate vacation days for a staff member
export const calculateVacationDays = (staffId, schedule, dateRange) => {
  let vacationDays = 0;
  dateRange.forEach(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    // Safe access to schedule data
    const staffSchedule = schedule[staffId];
    const shift = staffSchedule && staffSchedule[dateKey] ? staffSchedule[dateKey] : '';
    
    if (shift === 'early') {
      vacationDays += 0.5; // △ = 0.5 days
    } else if (shift === 'off' || shift === 'unavailable' || shift === 'holiday') {
      vacationDays += 1; // × and ⊘ and ★ = 1 day each
    }
  });
  
  return vacationDays;
};

// Generate comprehensive statistics for all staff
export const generateStatistics = (staffMembers, schedule, dateRange) => {
  const stats = {
    totalDays: dateRange.length,
    staffStats: {}
  };

  // Only calculate stats for active staff members
  const activeStaff = staffMembers.filter(staff => isStaffActiveInCurrentPeriod(staff, dateRange));
  
  activeStaff.forEach(staff => {
    stats.staffStats[staff.id] = {
      name: staff.name,
      position: staff.position,
      early: 0,
      normal: 0, 
      late: 0,
      off: 0,
      holiday: 0,
      unavailable: 0,
      workDays: 0,
      vacationDays: 0
    };

    dateRange.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      // Safe access to schedule data
      const staffSchedule = schedule[staff.id];
      const shift = staffSchedule && staffSchedule[dateKey] ? staffSchedule[dateKey] : '';
      
      // Count shifts with mapping: special->normal, unavailable->off, holiday->off
      // Exclude medamayaki and zensai from all statistics
      let countedShift = shift;
      if (shift === 'special') countedShift = 'normal';
      if (shift === 'unavailable') countedShift = 'off';
      if (shift === 'holiday') countedShift = 'off';
      
      // Skip medamayaki and zensai entirely from counting
      if (shift === 'medamayaki' || shift === 'zensai') {
        return; // Don't count these shifts at all
      }
      
      if (countedShift && stats.staffStats[staff.id][countedShift] !== undefined) {
        stats.staffStats[staff.id][countedShift]++;
      }
      
      // Count work days (anything that's not off, unavailable, holiday, or blank)
      if (shift && shift !== 'off' && shift !== 'unavailable' && shift !== 'holiday' && shift !== 'medamayaki' && shift !== 'zensai') {
        stats.staffStats[staff.id].workDays++;
      }
    });
    
    // Calculate vacation days using the dedicated function
    stats.staffStats[staff.id].vacationDays = calculateVacationDays(staff.id, schedule, dateRange);
  });

  return stats;
};

// Calculate workload percentage for a staff member
export const calculateWorkloadPercentage = (staffStats, totalDays) => {
  if (!staffStats || totalDays === 0) return 0;
  return Math.round((staffStats.workDays / totalDays) * 100);
};