/**
 * Server-side Business Rule Validation
 * Reuses client-side business logic adapted for server environment
 */

/**
 * Validate business rules for server-side processing
 * This function adapts the client-side constraint validation for server use
 */
async function validateBusinessRules(schedule, staffMembers, dateRange, originalSchedule = {}) {
  try {
    console.log('🔍 Validating business rules on server...');
    
    const violations = [];
    const summary = {
      totalStaff: staffMembers.length,
      totalDays: dateRange.length,
      validationTime: Date.now(),
      rulesChecked: 0,
      violationsFound: 0,
    };
    
    // Define business rules (adapted from client-side constraints)
    const rules = {
      dailyLimits: {
        maxWorkingDaysPerMonth: 28,
        minOffDaysPerMonth: 4,
        maxConsecutiveWorkDays: 6,
      },
      staffTypeRules: {
        partTime: {
          maxWorkingDays: 20,
          minWorkingDays: 8,
          maxConsecutiveDays: 4,
        },
        fullTime: {
          minWorkingDays: 22,
          maxWorkingDays: 28,
          maxConsecutiveDays: 6,
        },
      },
      shiftRules: {
        validShifts: ['○', '△', '◇', '×', ''],
        earlyShiftCode: '△',
        normalShiftCode: '○',
        lateShiftCode: '◇',
        offShiftCode: '×',
        emptyShiftCode: '',
      },
    };
    
    // Validate each staff member
    for (const staff of staffMembers) {
      const staffViolations = await validateStaffMember(
        staff,
        schedule[staff.id] || {},
        dateRange,
        rules,
        originalSchedule[staff.id] || {}
      );
      
      violations.push(...staffViolations);
      summary.rulesChecked += 5; // Each staff has 5 rule categories
    }
    
    // Global schedule validation
    const globalViolations = await validateGlobalConstraints(
      schedule,
      staffMembers,
      dateRange,
      rules
    );
    
    violations.push(...globalViolations);
    summary.rulesChecked += 3; // Global rules
    summary.violationsFound = violations.length;
    
    const isValid = violations.length === 0;
    
    console.log(`📊 Business rule validation: ${isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`📊 Found ${violations.length} violations across ${summary.rulesChecked} rule checks`);
    
    return {
      valid: isValid,
      violations,
      summary,
      criticalViolations: violations.filter(v => v.severity === 'critical'),
      highViolations: violations.filter(v => v.severity === 'high'),
      mediumViolations: violations.filter(v => v.severity === 'medium'),
      lowViolations: violations.filter(v => v.severity === 'low'),
    };
    
  } catch (error) {
    console.error('❌ Business rule validation failed:', error);
    return {
      valid: false,
      violations: [{
        type: 'validation_system_error',
        message: `Validation system error: ${error.message}`,
        severity: 'critical',
        systemError: true,
      }],
      summary: {
        error: error.message,
        validationTime: Date.now(),
      },
    };
  }
}

/**
 * Validate individual staff member constraints
 */
async function validateStaffMember(staff, staffSchedule, dateRange, rules, originalStaffSchedule) {
  const violations = [];
  const isPartTime = staff.status === 'パート';
  const staffRules = isPartTime ? rules.staffTypeRules.partTime : rules.staffTypeRules.fullTime;
  
  // Analyze staff schedule
  const analysis = analyzeStaffSchedule(staff, staffSchedule, dateRange);
  
  // Rule 1: Working days limits
  if (analysis.workingDays > staffRules.maxWorkingDays) {
    violations.push({
      type: 'excessive_working_days',
      staffId: staff.id,
      staffName: staff.name,
      message: `${staff.name} の勤務日数が上限を超過: ${analysis.workingDays}日 > ${staffRules.maxWorkingDays}日`,
      severity: isPartTime ? 'critical' : 'high',
      details: {
        actual: analysis.workingDays,
        limit: staffRules.maxWorkingDays,
        excess: analysis.workingDays - staffRules.maxWorkingDays,
      },
    });
  }
  
  if (analysis.workingDays < staffRules.minWorkingDays) {
    violations.push({
      type: 'insufficient_working_days',
      staffId: staff.id,
      staffName: staff.name,
      message: `${staff.name} の勤務日数が最低基準を下回り: ${analysis.workingDays}日 < ${staffRules.minWorkingDays}日`,
      severity: isPartTime ? 'medium' : 'high',
      details: {
        actual: analysis.workingDays,
        minimum: staffRules.minWorkingDays,
        shortage: staffRules.minWorkingDays - analysis.workingDays,
      },
    });
  }
  
  // Rule 2: Consecutive working days
  if (analysis.maxConsecutiveWorkDays > staffRules.maxConsecutiveDays) {
    violations.push({
      type: 'excessive_consecutive_days',
      staffId: staff.id,
      staffName: staff.name,
      message: `${staff.name} の連続勤務日数が制限超過: ${analysis.maxConsecutiveWorkDays}日 > ${staffRules.maxConsecutiveDays}日`,
      severity: 'critical',
      details: {
        actual: analysis.maxConsecutiveWorkDays,
        limit: staffRules.maxConsecutiveDays,
        positions: analysis.consecutivePeriods.filter(p => p.length > staffRules.maxConsecutiveDays),
      },
    });
  }
  
  // Rule 3: Off days requirements
  const minOffDays = rules.dailyLimits.minOffDaysPerMonth;
  if (analysis.offDays < minOffDays) {
    violations.push({
      type: 'insufficient_off_days',
      staffId: staff.id,
      staffName: staff.name,
      message: `${staff.name} の休日が最低基準を下回り: ${analysis.offDays}日 < ${minOffDays}日`,
      severity: 'high',
      details: {
        actual: analysis.offDays,
        minimum: minOffDays,
        shortage: minOffDays - analysis.offDays,
      },
    });
  }
  
  // Rule 4: Invalid shift codes
  if (analysis.invalidShifts.length > 0) {
    violations.push({
      type: 'invalid_shift_codes',
      staffId: staff.id,
      staffName: staff.name,
      message: `${staff.name} のスケジュールに無効なシフトコード: ${analysis.invalidShifts.join(', ')}`,
      severity: 'medium',
      details: {
        invalidShifts: analysis.invalidShifts,
        validShifts: rules.shiftRules.validShifts,
      },
    });
  }
  
  // Rule 5: Part-time specific rules
  if (isPartTime && analysis.emptyShifts > 0) {
    violations.push({
      type: 'part_time_empty_shifts',
      staffId: staff.id,
      staffName: staff.name,
      message: `パートタイム ${staff.name} にブランクシフトが存在 (${analysis.emptyShifts}個所)`,
      severity: 'medium',
      details: {
        emptyShifts: analysis.emptyShifts,
        explanation: 'パートタイムスタッフは明示的にシフトを指定する必要があります',
      },
    });
  }
  
  return violations;
}

/**
 * Analyze staff schedule to extract key metrics
 */
function analyzeStaffSchedule(staff, staffSchedule, dateRange) {
  const isPartTime = staff.status === 'パート';
  
  const analysis = {
    workingDays: 0,
    offDays: 0,
    emptyShifts: 0,
    invalidShifts: [],
    maxConsecutiveWorkDays: 0,
    consecutivePeriods: [],
    shiftDistribution: {
      early: 0,    // △
      normal: 0,   // ○ and empty for regular staff
      late: 0,     // ▽
      off: 0,      // ×
    },
  };
  
  const validShifts = ['○', '△', '◇', '×', ''];
  let currentConsecutive = 0;
  let currentPeriod = [];
  
  dateRange.forEach((date, index) => {
    const dateKey = date.toISOString().split('T')[0];
    const shift = staffSchedule[dateKey];
    
    // Check for invalid shifts
    if (shift !== undefined && !validShifts.includes(shift)) {
      analysis.invalidShifts.push(shift);
    }
    
    // Classify shift type
    if (shift === '×') {
      // Off day
      analysis.offDays++;
      analysis.shiftDistribution.off++;
      
      // End consecutive work period
      if (currentConsecutive > 0) {
        analysis.consecutivePeriods.push([...currentPeriod]);
        analysis.maxConsecutiveWorkDays = Math.max(analysis.maxConsecutiveWorkDays, currentConsecutive);
        currentConsecutive = 0;
        currentPeriod = [];
      }
    } else if (shift === '' || shift === undefined) {
      // Empty shift
      analysis.emptyShifts++;
      
      if (!isPartTime) {
        // Regular staff: empty = working
        analysis.workingDays++;
        analysis.shiftDistribution.normal++;
        
        currentConsecutive++;
        currentPeriod.push({ date: dateKey, shift: 'empty' });
      } else {
        // Part-time staff: empty = not scheduled (treated as off)
        if (currentConsecutive > 0) {
          analysis.consecutivePeriods.push([...currentPeriod]);
          analysis.maxConsecutiveWorkDays = Math.max(analysis.maxConsecutiveWorkDays, currentConsecutive);
          currentConsecutive = 0;
          currentPeriod = [];
        }
      }
    } else {
      // Working shift (○, △, ▽)
      analysis.workingDays++;
      
      switch (shift) {
        case '△':
          analysis.shiftDistribution.early++;
          break;
        case '○':
          analysis.shiftDistribution.normal++;
          break;
        case '◇':
          analysis.shiftDistribution.late++;
          break;
      }
      
      currentConsecutive++;
      currentPeriod.push({ date: dateKey, shift });
    }
  });
  
  // Handle final consecutive period
  if (currentConsecutive > 0) {
    analysis.consecutivePeriods.push(currentPeriod);
    analysis.maxConsecutiveWorkDays = Math.max(analysis.maxConsecutiveWorkDays, currentConsecutive);
  }
  
  return analysis;
}

/**
 * Validate global schedule constraints
 */
async function validateGlobalConstraints(schedule, staffMembers, dateRange, rules) {
  const violations = [];
  
  // Rule 1: Daily coverage validation
  const coverageViolations = await validateDailyCoverage(schedule, staffMembers, dateRange);
  violations.push(...coverageViolations);
  
  // Rule 2: Workload distribution validation
  const workloadViolations = await validateWorkloadDistribution(schedule, staffMembers, dateRange);
  violations.push(...workloadViolations);
  
  // Rule 3: Shift distribution validation
  const distributionViolations = await validateShiftDistribution(schedule, staffMembers, dateRange);
  violations.push(...distributionViolations);
  
  return violations;
}

/**
 * Validate daily coverage requirements
 */
async function validateDailyCoverage(schedule, staffMembers, dateRange) {
  const violations = [];
  const minCoveragePerDay = Math.max(2, Math.floor(staffMembers.length * 0.4)); // At least 40% coverage
  
  dateRange.forEach(date => {
    const dateKey = date.toISOString().split('T')[0];
    let workingStaff = 0;
    
    staffMembers.forEach(staff => {
      const shift = schedule[staff.id]?.[dateKey];
      const isPartTime = staff.status === 'パート';
      
      // Count as working if not off and (has shift or is regular staff with empty)
      if (shift !== '×' && (shift || !isPartTime)) {
        workingStaff++;
      }
    });
    
    if (workingStaff < minCoveragePerDay) {
      violations.push({
        type: 'insufficient_daily_coverage',
        date: dateKey,
        message: `${dateKey} の勤務スタッフ数が不足: ${workingStaff}名 < ${minCoveragePerDay}名`,
        severity: 'high',
        details: {
          date: dateKey,
          workingStaff,
          requiredMinimum: minCoveragePerDay,
          shortage: minCoveragePerDay - workingStaff,
        },
      });
    }
  });
  
  return violations;
}

/**
 * Validate workload distribution fairness
 */
async function validateWorkloadDistribution(schedule, staffMembers, dateRange) {
  const violations = [];
  const workloads = [];
  
  // Calculate each staff member's workload
  staffMembers.forEach(staff => {
    let workingDays = 0;
    const isPartTime = staff.status === 'パート';
    
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const shift = schedule[staff.id]?.[dateKey];
      
      if (shift !== '×' && (shift || !isPartTime)) {
        workingDays++;
      }
    });
    
    workloads.push({
      staffId: staff.id,
      staffName: staff.name,
      workingDays,
      isPartTime,
    });
  });
  
  // Check for extreme workload imbalances
  const regularStaffWorkloads = workloads.filter(w => !w.isPartTime).map(w => w.workingDays);
  const partTimeWorkloads = workloads.filter(w => w.isPartTime).map(w => w.workingDays);
  
  if (regularStaffWorkloads.length > 1) {
    const maxRegular = Math.max(...regularStaffWorkloads);
    const minRegular = Math.min(...regularStaffWorkloads);
    const imbalance = maxRegular - minRegular;
    
    if (imbalance > 6) { // More than 6 days difference
      violations.push({
        type: 'workload_imbalance_regular',
        message: `正社員の勤務日数に大きな格差: ${imbalance}日の差`,
        severity: 'medium',
        details: {
          imbalance,
          maxWorkingDays: maxRegular,
          minWorkingDays: minRegular,
          staffType: 'regular',
        },
      });
    }
  }
  
  if (partTimeWorkloads.length > 1) {
    const maxPartTime = Math.max(...partTimeWorkloads);
    const minPartTime = Math.min(...partTimeWorkloads);
    const imbalance = maxPartTime - minPartTime;
    
    if (imbalance > 4) { // More than 4 days difference for part-time
      violations.push({
        type: 'workload_imbalance_parttime',
        message: `パートタイムの勤務日数に大きな格差: ${imbalance}日の差`,
        severity: 'medium',
        details: {
          imbalance,
          maxWorkingDays: maxPartTime,
          minWorkingDays: minPartTime,
          staffType: 'parttime',
        },
      });
    }
  }
  
  return violations;
}

/**
 * Validate shift type distribution
 */
async function validateShiftDistribution(schedule, staffMembers, dateRange) {
  const violations = [];
  
  // Count shift types across all staff and dates
  const shiftCounts = {
    early: 0,   // △
    normal: 0,  // ○ and empty for regular
    late: 0,    // ▽
    off: 0,     // ×
  };
  
  let totalSlots = 0;
  
  staffMembers.forEach(staff => {
    const isPartTime = staff.status === 'パート';
    
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const shift = schedule[staff.id]?.[dateKey];
      
      totalSlots++;
      
      switch (shift) {
        case '△':
          shiftCounts.early++;
          break;
        case '○':
          shiftCounts.normal++;
          break;
        case '◇':
          shiftCounts.late++;
          break;
        case '×':
          shiftCounts.off++;
          break;
        case '':
        case undefined:
          if (!isPartTime) {
            shiftCounts.normal++; // Empty = normal for regular staff
          }
          break;
      }
    });
  });
  
  // Check for extreme shift imbalances (this is informational rather than critical)
  const workingShifts = shiftCounts.early + shiftCounts.normal + shiftCounts.late;
  const workingRatio = totalSlots > 0 ? workingShifts / totalSlots : 0;
  
  if (workingRatio < 0.6) { // Less than 60% working shifts
    violations.push({
      type: 'low_working_ratio',
      message: `勤務シフトの割合が低すぎます: ${(workingRatio * 100).toFixed(1)}%`,
      severity: 'low',
      details: {
        workingRatio: workingRatio,
        workingShifts,
        totalSlots,
        shiftCounts,
      },
    });
  }
  
  return violations;
}

module.exports = {
  validateBusinessRules,
  validateStaffMember,
  validateGlobalConstraints,
  analyzeStaffSchedule,
};