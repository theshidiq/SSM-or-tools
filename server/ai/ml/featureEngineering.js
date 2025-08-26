/**
 * Server-side Feature Engineering
 * Optimized for server processing with batch operations and memory management
 * Based on Phase 1 & 2 optimizations from client-side
 */

/**
 * Generate optimized features for server-side processing
 * @param {Object} scheduleData - Current schedule data
 * @param {Array} staffMembers - Staff member information
 * @param {Array} dateRange - Array of dates to process
 * @param {Object} options - Processing options
 * @returns {Object} Generated features with progress tracking
 */
async function optimizeFeatureGeneration(scheduleData, staffMembers, dateRange, options = {}) {
  const {
    enableCaching = true,
    serverSide = true,
    batchProcessing = true,
    chunkSize = 50,
  } = options;

  console.log('⚡ Starting optimized feature generation on server...');
  const startTime = Date.now();
  
  const progress = [];
  const features = {};
  
  // Batch process staff members in chunks for memory efficiency
  const staffChunks = chunkArray(staffMembers, chunkSize);
  
  for (let chunkIndex = 0; chunkIndex < staffChunks.length; chunkIndex++) {
    const staffChunk = staffChunks[chunkIndex];
    
    progress.push({
      completion: (chunkIndex / staffChunks.length) * 0.6, // 60% for staff processing
      description: `Processing staff chunk ${chunkIndex + 1}/${staffChunks.length}`,
      detail: `${staffChunk.length} staff members`,
    });
    
    // Process each staff member in the chunk
    for (const staff of staffChunk) {
      features[staff.id] = await generateStaffFeatures(
        staff,
        scheduleData[staff.id] || {},
        dateRange,
        { serverOptimized: true }
      );
    }
    
    // Yield control to prevent blocking (server equivalent of client-side yielding)
    if (serverSide && chunkIndex % 3 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  // Generate global features
  progress.push({
    completion: 0.8,
    description: 'Generating global schedule features',
    detail: 'Historical patterns and constraints',
  });
  
  const globalFeatures = await generateGlobalFeatures(
    scheduleData,
    staffMembers,
    dateRange
  );
  
  // Final feature optimization
  progress.push({
    completion: 0.95,
    description: 'Optimizing feature vectors',
    detail: 'Normalizing and vectorizing features',
  });
  
  const optimizedFeatures = await optimizeFeatureVectors(features, globalFeatures);
  
  const processingTime = Date.now() - startTime;
  
  progress.push({
    completion: 1.0,
    description: 'Feature generation completed',
    detail: `${Object.keys(optimizedFeatures).length} feature sets in ${processingTime}ms`,
  });
  
  console.log(`✅ Feature generation completed in ${processingTime}ms`);
  
  return {
    features: optimizedFeatures,
    progress,
    metadata: {
      processingTime,
      staffCount: staffMembers.length,
      dateRangeLength: dateRange.length,
      serverProcessed: true,
    },
  };
}

/**
 * Generate features for a single staff member
 */
async function generateStaffFeatures(staff, staffSchedule, dateRange, options = {}) {
  const features = {
    // Basic staff information
    staffId: staff.id,
    isPartTime: staff.status === 'パート' ? 1 : 0,
    
    // Historical patterns
    workingDayRatio: 0,
    preferredShifts: {},
    dayOfWeekPatterns: {},
    consecutiveWorkTolerance: 0,
    
    // Current schedule analysis
    currentWorkingDays: 0,
    currentOffDays: 0,
    consecutiveWorkDays: 0,
    lastWorkingDay: null,
    
    // Shift preferences (learned from data)
    shiftTypePreferences: {
      early: 0,    // △
      normal: 0,   // ○ or empty for regular staff
      late: 0,     // ▽
      off: 0,      // ×
    },
  };
  
  // Analyze current schedule
  const shifts = [];
  let workingDays = 0;
  let offDays = 0;
  let consecutiveWork = 0;
  let maxConsecutive = 0;
  
  dateRange.forEach((date, index) => {
    const dateKey = date.toISOString().split('T')[0];
    const shift = staffSchedule[dateKey] || '';
    shifts.push(shift);
    
    const dayOfWeek = date.getDay();
    
    // Count working vs off days
    if (shift === '×') {
      offDays++;
      consecutiveWork = 0;
    } else if (shift !== '') {
      workingDays++;
      consecutiveWork++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveWork);
      features.lastWorkingDay = index;
      
      // Track shift preferences
      switch (shift) {
        case '△':
          features.shiftTypePreferences.early++;
          break;
        case '○':
          features.shiftTypePreferences.normal++;
          break;
        case '▽':
          features.shiftTypePreferences.late++;
          break;
      }
    } else if (!staff.isPartTime) {
      // Empty shift for regular staff = working
      workingDays++;
      consecutiveWork++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveWork);
      features.shiftTypePreferences.normal++;
    } else {
      consecutiveWork = 0;
    }
    
    // Track day-of-week patterns
    if (!features.dayOfWeekPatterns[dayOfWeek]) {
      features.dayOfWeekPatterns[dayOfWeek] = { work: 0, off: 0 };
    }
    
    if (shift === '×') {
      features.dayOfWeekPatterns[dayOfWeek].off++;
    } else if (shift !== '' || !staff.isPartTime) {
      features.dayOfWeekPatterns[dayOfWeek].work++;
    }
  });
  
  // Calculate derived features
  const totalDays = dateRange.length;
  features.workingDayRatio = totalDays > 0 ? workingDays / totalDays : 0;
  features.currentWorkingDays = workingDays;
  features.currentOffDays = offDays;
  features.consecutiveWorkTolerance = maxConsecutive;
  
  // Normalize shift preferences
  const totalShifts = Object.values(features.shiftTypePreferences).reduce((a, b) => a + b, 0);
  if (totalShifts > 0) {
    Object.keys(features.shiftTypePreferences).forEach(shiftType => {
      features.shiftTypePreferences[shiftType] /= totalShifts;
    });
  }
  
  // Convert day patterns to ratios
  Object.keys(features.dayOfWeekPatterns).forEach(day => {
    const pattern = features.dayOfWeekPatterns[day];
    const dayTotal = pattern.work + pattern.off;
    if (dayTotal > 0) {
      features.dayOfWeekPatterns[day] = {
        workRatio: pattern.work / dayTotal,
        offRatio: pattern.off / dayTotal,
      };
    }
  });
  
  return features;
}

/**
 * Generate global features for the entire schedule
 */
async function generateGlobalFeatures(scheduleData, staffMembers, dateRange) {
  const globalFeatures = {
    // Schedule coverage metrics
    totalStaff: staffMembers.length,
    partTimeStaff: staffMembers.filter(s => s.status === 'パート').length,
    regularStaff: staffMembers.filter(s => s.status !== 'パート').length,
    
    // Date range characteristics
    totalDays: dateRange.length,
    weekdays: 0,
    weekends: 0,
    
    // Coverage patterns
    dailyCoverage: {},
    shiftDistribution: {
      early: 0,   // △
      normal: 0,  // ○ and empty
      late: 0,    // ▽
      off: 0,     // ×
    },
    
    // Workload distribution
    averageWorkload: 0,
    workloadVariance: 0,
  };
  
  // Analyze date characteristics
  dateRange.forEach((date, index) => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      globalFeatures.weekends++;
    } else {
      globalFeatures.weekdays++;
    }
    
    const dateKey = date.toISOString().split('T')[0];
    let workingStaff = 0;
    
    // Count working staff for this date
    staffMembers.forEach(staff => {
      const shift = scheduleData[staff.id]?.[dateKey] || '';
      if (shift !== '×' && (shift !== '' || staff.status !== 'パート')) {
        workingStaff++;
        
        // Count shift types
        switch (shift) {
          case '△':
            globalFeatures.shiftDistribution.early++;
            break;
          case '○':
            globalFeatures.shiftDistribution.normal++;
            break;
          case '▽':
            globalFeatures.shiftDistribution.late++;
            break;
          case '×':
            globalFeatures.shiftDistribution.off++;
            break;
          default:
            if (staff.status !== 'パート') {
              globalFeatures.shiftDistribution.normal++; // Empty = normal for regular staff
            }
        }
      } else {
        globalFeatures.shiftDistribution.off++;
      }
    });
    
    globalFeatures.dailyCoverage[dateKey] = {
      workingStaff,
      coverageRatio: globalFeatures.totalStaff > 0 ? workingStaff / globalFeatures.totalStaff : 0,
    };
  });
  
  // Calculate workload statistics
  const workloads = staffMembers.map(staff => {
    let workingDays = 0;
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const shift = scheduleData[staff.id]?.[dateKey] || '';
      if (shift !== '×' && (shift !== '' || staff.status !== 'パート')) {
        workingDays++;
      }
    });
    return workingDays;
  });
  
  if (workloads.length > 0) {
    globalFeatures.averageWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length;
    
    const variance = workloads.reduce((sum, workload) => {
      return sum + Math.pow(workload - globalFeatures.averageWorkload, 2);
    }, 0) / workloads.length;
    
    globalFeatures.workloadVariance = variance;
  }
  
  return globalFeatures;
}

/**
 * Optimize feature vectors for ML processing
 */
async function optimizeFeatureVectors(staffFeatures, globalFeatures) {
  const optimized = {};
  
  Object.keys(staffFeatures).forEach(staffId => {
    const features = staffFeatures[staffId];
    
    // Create normalized feature vector
    optimized[staffId] = {
      // Binary features
      isPartTime: features.isPartTime,
      
      // Normalized continuous features
      workingDayRatio: Math.min(1.0, Math.max(0.0, features.workingDayRatio)),
      consecutiveWorkNormalized: Math.min(1.0, features.consecutiveWorkTolerance / 7.0),
      
      // Shift preference vector
      shiftPreferences: [
        features.shiftTypePreferences.early,
        features.shiftTypePreferences.normal,
        features.shiftTypePreferences.late,
        features.shiftTypePreferences.off,
      ],
      
      // Day-of-week preference vector (7 days)
      dayPreferences: Array.from({ length: 7 }, (_, day) => {
        const pattern = features.dayOfWeekPatterns[day];
        return pattern ? pattern.workRatio : 0.5; // Default to neutral
      }),
      
      // Context features from global analysis
      relativeWorkload: globalFeatures.averageWorkload > 0 ? 
        features.currentWorkingDays / globalFeatures.averageWorkload : 0.5,
      
      // Combined feature hash for caching
      featureHash: generateFeatureHash(features, globalFeatures),
    };
  });
  
  return optimized;
}

/**
 * Generate feature hash for caching optimization
 */
function generateFeatureHash(staffFeatures, globalFeatures) {
  const combined = {
    ...staffFeatures,
    globalAverageWorkload: globalFeatures.averageWorkload,
    totalStaff: globalFeatures.totalStaff,
  };
  
  // Simple hash function for feature fingerprinting
  return JSON.stringify(combined).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a; // Convert to 32-bit integer
  }, 0).toString(36);
}

/**
 * Chunk array into smaller arrays
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Create basic features (fallback for simple processing)
 */
function createFeatures(scheduleData, staffMembers, dateRange) {
  console.log('📊 Creating basic features...');
  
  const features = {};
  
  staffMembers.forEach(staff => {
    const staffSchedule = scheduleData[staff.id] || {};
    
    // Simple feature vector
    features[staff.id] = {
      isPartTime: staff.status === 'パート' ? 1 : 0,
      workingDays: 0,
      offDays: 0,
      shiftVector: [], // Will be filled with shift encodings
    };
    
    // Count current schedule state
    dateRange.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const shift = staffSchedule[dateKey] || '';
      
      if (shift === '×') {
        features[staff.id].offDays++;
        features[staff.id].shiftVector.push(0); // Off = 0
      } else if (shift !== '') {
        features[staff.id].workingDays++;
        // Encode shift types: △=1, ○=2, ▽=3
        const shiftCode = shift === '△' ? 1 : shift === '○' ? 2 : shift === '▽' ? 3 : 2;
        features[staff.id].shiftVector.push(shiftCode);
      } else {
        // Empty shift - working for regular, not working for part-time
        if (staff.status !== 'パート') {
          features[staff.id].workingDays++;
          features[staff.id].shiftVector.push(2); // Default to normal shift
        } else {
          features[staff.id].shiftVector.push(0); // Part-time not working
        }
      }
    });
  });
  
  console.log(`✅ Generated basic features for ${Object.keys(features).length} staff members`);
  return features;
}

module.exports = {
  optimizeFeatureGeneration,
  createFeatures,
  generateStaffFeatures,
  generateGlobalFeatures,
  optimizeFeatureVectors,
};