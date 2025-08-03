/**
 * DataNormalizer.js
 * 
 * Utility functions for normalizing and standardizing data formats for AI processing.
 * Ensures consistent data structures across the AI system.
 */

/**
 * Normalize shift values to standard format
 * @param {string} shiftValue - Raw shift value
 * @returns {string} Normalized shift value
 */
export const normalizeShiftValue = (shiftValue) => {
  if (shiftValue === undefined || shiftValue === null) {
    return '';
  }

  const value = String(shiftValue).trim();
  
  // Map common variations to standard values
  const shiftMapping = {
    // Off days
    '×': '×',
    'off': '×',
    'OFF': '×',
    '休': '×',
    '★': '★',
    'holiday': '★',
    'HOLIDAY': '★',
    '祝': '★',
    
    // Early shifts
    '△': '△',
    'early': '△',
    'EARLY': '△',
    '早': '△',
    'E': '△',
    
    // Late shifts
    '◇': '◇',
    'late': '◇',
    'LATE': '◇',
    '遅': '◇',
    'L': '◇',
    
    // Normal shifts
    '': '',
    'normal': '',
    'NORMAL': '',
    '通': '',
    'N': '',
    'o': '',
    'O': '',
    '○': '',
    
    // Special shifts
    '●': '●',
    'special': '●',
    '◎': '◎',
    'medamayaki': '◎',
    '目玉焼き': '◎',
    '▣': '▣',
    'zensai': '▣',
    '前菜': '▣',
    
    // Unavailable
    '⊘': '⊘',
    'unavailable': '⊘',
    'UNAVAILABLE': '⊘',
    '不可': '⊘'
  };

  return shiftMapping[value] !== undefined ? shiftMapping[value] : value;
};

/**
 * Normalize staff member object
 * @param {Object} staff - Raw staff object
 * @returns {Object} Normalized staff object
 */
export const normalizeStaffMember = (staff) => {
  if (!staff || typeof staff !== 'object') {
    return null;
  }

  const normalized = {
    id: staff.id || `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: String(staff.name || '').trim(),
    position: String(staff.position || '').trim(),
    status: normalizeStaffStatus(staff.status),
    type: String(staff.type || staff.status || '派遣').trim(),
    department: String(staff.department || '').trim(),
    startPeriod: normalizeWorkPeriod(staff.startPeriod),
    endPeriod: normalizeWorkPeriod(staff.endPeriod),
    active: staff.active !== undefined ? Boolean(staff.active) : true
  };

  // Ensure required fields
  if (!normalized.name) {
    normalized.name = `Staff ${normalized.id.slice(-4)}`;
  }

  return normalized;
};

/**
 * Normalize staff status
 * @param {string} status - Raw status value
 * @returns {string} Normalized status
 */
export const normalizeStaffStatus = (status) => {
  if (!status) return '派遣';
  
  const statusString = String(status).trim();
  
  const statusMapping = {
    '社員': '社員',
    'employee': '社員',
    'EMPLOYEE': '社員',
    'regular': '社員',
    'full-time': '社員',
    
    '派遣': '派遣',
    'temp': '派遣',
    'TEMP': '派遣',
    'temporary': '派遣',
    'dispatch': '派遣',
    
    'パート': 'パート',
    'part-time': 'パート',
    'part_time': 'パート',
    'parttime': 'パート',
    'PART_TIME': 'パート'
  };

  return statusMapping[statusString] || '派遣';
};

/**
 * Normalize work period object
 * @param {Object} period - Raw period object
 * @returns {Object|null} Normalized period object
 */
export const normalizeWorkPeriod = (period) => {
  if (!period || typeof period !== 'object') {
    return null;
  }

  const year = parseInt(period.year);
  const month = parseInt(period.month);
  const day = parseInt(period.day);

  if (isNaN(year) || isNaN(month) || year < 2020 || year > 2030 || month < 1 || month > 12) {
    return null;
  }

  return {
    year,
    month,
    day: isNaN(day) ? 1 : Math.max(1, Math.min(31, day))
  };
};

/**
 * Normalize schedule data object
 * @param {Object} scheduleData - Raw schedule data
 * @returns {Object} Normalized schedule data
 */
export const normalizeScheduleData = (scheduleData) => {
  if (!scheduleData || typeof scheduleData !== 'object') {
    return {};
  }

  const normalized = {};

  Object.keys(scheduleData).forEach(staffId => {
    if (staffId === '_staff_members') {
      // Skip metadata field
      return;
    }

    const staffSchedule = scheduleData[staffId];
    if (staffSchedule && typeof staffSchedule === 'object') {
      normalized[staffId] = {};
      
      Object.keys(staffSchedule).forEach(dateKey => {
        if (isValidDateKey(dateKey)) {
          const shiftValue = staffSchedule[dateKey];
          normalized[staffId][dateKey] = normalizeShiftValue(shiftValue);
        }
      });
    }
  });

  return normalized;
};

/**
 * Validate date key format (YYYY-MM-DD)
 * @param {string} dateKey - Date key to validate
 * @returns {boolean} True if valid date key
 */
export const isValidDateKey = (dateKey) => {
  if (typeof dateKey !== 'string') {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateKey)) {
    return false;
  }

  const date = new Date(dateKey);
  return !isNaN(date.getTime()) && dateKey === date.toISOString().split('T')[0];
};

/**
 * Normalize date range array
 * @param {Array} dateRange - Array of dates or date strings
 * @returns {Array} Array of normalized Date objects
 */
export const normalizeDateRange = (dateRange) => {
  if (!Array.isArray(dateRange)) {
    return [];
  }

  return dateRange
    .map(date => {
      if (date instanceof Date) {
        return date;
      }
      if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      return null;
    })
    .filter(date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
};

/**
 * Normalize staff members array
 * @param {Array} staffMembers - Array of staff member objects
 * @returns {Array} Array of normalized staff members
 */
export const normalizeStaffMembers = (staffMembers) => {
  if (!Array.isArray(staffMembers)) {
    return [];
  }

  const normalizedStaff = staffMembers
    .map(staff => normalizeStaffMember(staff))
    .filter(staff => staff !== null);

  // Ensure unique IDs
  const usedIds = new Set();
  const uniqueStaff = [];

  normalizedStaff.forEach(staff => {
    let id = staff.id;
    let counter = 1;
    
    while (usedIds.has(id)) {
      id = `${staff.id}_${counter}`;
      counter++;
    }
    
    usedIds.add(id);
    uniqueStaff.push({ ...staff, id });
  });

  return uniqueStaff;
};

/**
 * Normalize complete period data
 * @param {Object} periodData - Raw period data
 * @returns {Object} Normalized period data
 */
export const normalizePeriodData = (periodData) => {
  if (!periodData || typeof periodData !== 'object') {
    return null;
  }

  return {
    monthIndex: parseInt(periodData.monthIndex) || 0,
    scheduleData: normalizeScheduleData(periodData.scheduleData || {}),
    staffData: normalizeStaffMembers(periodData.staffData || []),
    dateRange: normalizeDateRange(periodData.dateRange || []),
    metadata: {
      ...periodData.metadata,
      totalStaff: (periodData.staffData || []).length,
      totalDays: (periodData.dateRange || []).length,
      normalizedAt: new Date().toISOString()
    }
  };
};

/**
 * Normalize extracted data for AI processing
 * @param {Object} extractedData - Raw extracted data
 * @returns {Object} Normalized extracted data
 */
export const normalizeExtractedData = (extractedData) => {
  if (!extractedData || !extractedData.success || !extractedData.data) {
    return {
      success: false,
      error: 'Invalid extracted data provided',
      data: null
    };
  }

  try {
    const normalizedData = {
      ...extractedData,
      data: {
        ...extractedData.data,
        rawPeriodData: extractedData.data.rawPeriodData.map(periodData => 
          normalizePeriodData(periodData)
        ).filter(data => data !== null),
        normalizedAt: new Date().toISOString()
      }
    };

    // Update summary with normalized data
    if (normalizedData.data.summary) {
      normalizedData.data.summary.totalPeriods = normalizedData.data.rawPeriodData.length;
    }

    return normalizedData;

  } catch (error) {
    return {
      success: false,
      error: `Normalization failed: ${error.message}`,
      data: null
    };
  }
};

/**
 * Normalize constraint violation object
 * @param {Object} violation - Raw violation object
 * @returns {Object} Normalized violation object
 */
export const normalizeViolation = (violation) => {
  if (!violation || typeof violation !== 'object') {
    return null;
  }

  return {
    type: String(violation.type || 'unknown'),
    severity: normalizeSeverity(violation.severity),
    message: String(violation.message || ''),
    staffId: violation.staffId ? String(violation.staffId) : null,
    staffName: violation.staffName ? String(violation.staffName) : null,
    date: violation.date && isValidDateKey(violation.date) ? violation.date : null,
    details: violation.details && typeof violation.details === 'object' ? 
             { ...violation.details } : {},
    timestamp: new Date().toISOString()
  };
};

/**
 * Normalize severity level
 * @param {string} severity - Raw severity value
 * @returns {string} Normalized severity
 */
export const normalizeSeverity = (severity) => {
  const severityString = String(severity || '').toLowerCase().trim();
  
  const validSeverities = ['critical', 'high', 'medium', 'low'];
  
  if (validSeverities.includes(severityString)) {
    return severityString;
  }
  
  // Map common variations
  const severityMapping = {
    'error': 'high',
    'warning': 'medium',
    'info': 'low',
    'urgent': 'critical',
    'important': 'high',
    'minor': 'low'
  };
  
  return severityMapping[severityString] || 'medium';
};

/**
 * Validate and normalize preference object
 * @param {Object} preference - Raw preference object
 * @returns {Object|null} Normalized preference object
 */
export const normalizePreference = (preference) => {
  if (!preference || typeof preference !== 'object') {
    return null;
  }

  const validTypes = ['day_of_week', 'shift_type', 'consecutive_pattern', 'frequency', 'seasonal'];
  const validConfidenceLevels = ['very_high', 'high', 'medium', 'low', 'very_low'];

  if (!validTypes.includes(preference.type)) {
    return null;
  }

  return {
    id: preference.id || `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    staffId: String(preference.staffId || ''),
    staffName: String(preference.staffName || ''),
    type: preference.type,
    confidence: validConfidenceLevels.includes(preference.confidence) ? 
                preference.confidence : 'medium',
    strength: Math.max(0, Math.min(100, Number(preference.strength) || 0)),
    active: preference.active !== undefined ? Boolean(preference.active) : true,
    source: String(preference.source || 'unknown'),
    detectedAt: preference.detectedAt || new Date().toISOString(),
    notes: String(preference.notes || '')
  };
};

/**
 * Clean and validate analysis results
 * @param {Object} analysisResult - Raw analysis result
 * @returns {Object} Cleaned analysis result
 */
export const normalizeAnalysisResult = (analysisResult) => {
  if (!analysisResult || typeof analysisResult !== 'object') {
    return {
      success: false,
      error: 'Invalid analysis result',
      analysis: null
    };
  }

  if (!analysisResult.success) {
    return {
      success: false,
      error: String(analysisResult.error || 'Analysis failed'),
      analysis: null
    };
  }

  return {
    success: true,
    analyzedAt: analysisResult.analyzedAt || new Date().toISOString(),
    analysis: {
      ...analysisResult.analysis,
      summary: {
        ...analysisResult.analysis.summary,
        normalizedAt: new Date().toISOString()
      }
    }
  };
};

/**
 * Batch normalize multiple data objects
 * @param {Array} dataArray - Array of data objects to normalize
 * @param {Function} normalizeFunction - Normalization function to apply
 * @returns {Array} Array of normalized objects
 */
export const batchNormalize = (dataArray, normalizeFunction) => {
  if (!Array.isArray(dataArray)) {
    return [];
  }

  return dataArray
    .map(item => {
      try {
        return normalizeFunction(item);
      } catch (error) {
        console.warn('Normalization failed for item:', item, error);
        return null;
      }
    })
    .filter(item => item !== null);
};

/**
 * Deep clone and normalize object
 * @param {Object} obj - Object to clone and normalize
 * @param {Object} normalizers - Object with field-specific normalizer functions
 * @returns {Object} Cloned and normalized object
 */
export const deepNormalizeClone = (obj, normalizers = {}) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepNormalizeClone(item, normalizers));
  }

  const normalized = {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    if (normalizers[key] && typeof normalizers[key] === 'function') {
      normalized[key] = normalizers[key](value);
    } else if (typeof value === 'object' && value !== null) {
      normalized[key] = deepNormalizeClone(value, normalizers);
    } else {
      normalized[key] = value;
    }
  });

  return normalized;
};