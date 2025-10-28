/**
 * Schedule Import Hook
 *
 * Orchestrates the complete HTML schedule import process:
 * 1. Parse HTML file
 * 2. Match staff names to IDs
 * 3. Validate data
 * 4. Import to target period
 * 5. Real-time sync via WebSocket
 */

import { useState, useCallback } from 'react';
import { parseHTMLFile, buildScheduleData, validateParsedSchedule } from '../utils/htmlScheduleParser';
import { matchStaffNames, createOrderedStaffArray, applyManualMappings } from '../utils/staffNameMapper';
import {
  validateScheduleData,
  validateDateRange,
  validatePeriodCompatibility,
  checkScheduleConflicts
} from '../utils/scheduleValidator';
import { useScheduleDataPrefetch } from './useScheduleDataPrefetch';
import { generateDateRange } from '../utils/dateUtils';

/**
 * Import states
 */
const IMPORT_STATES = {
  IDLE: 'idle',
  PARSING: 'parsing',
  MATCHING: 'matching',
  VALIDATING: 'validating',
  PENDING_MANUAL_MAPPING: 'pending_manual_mapping',
  READY: 'ready',
  IMPORTING: 'importing',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Hook for importing HTML schedules
 *
 * @param {number} targetPeriodIndex - Target period index to import into
 * @param {Object} targetPeriod - Target period object
 * @returns {Object} Import methods and state
 */
export function useScheduleImport(targetPeriodIndex, targetPeriod) {
  const [importState, setImportState] = useState(IMPORT_STATES.IDLE);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Parsed data from HTML
  const [parsedData, setParsedData] = useState(null);
  const [matchResults, setMatchResults] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);

  // Get schedule operations from main hook
  const {
    staff,
    schedule: currentSchedule,
    updateSchedule,
    isLoading: scheduleLoading
  } = useScheduleDataPrefetch(targetPeriodIndex);

  /**
   * Step 1: Parse HTML file
   */
  const parseHTMLStep = useCallback(async (file) => {
    setImportState(IMPORT_STATES.PARSING);
    setProgress(10);
    setError(null);

    try {
      console.log('📄 [IMPORT] Parsing HTML file:', file.name);

      const parsed = await parseHTMLFile(file);

      console.log('✅ [IMPORT] HTML parsed successfully:', {
        staffCount: parsed.staffNames.length,
        rowCount: parsed.rows.length,
        period: parsed.period
      });

      // Validate parsed structure
      const validation = validateParsedSchedule(parsed);
      if (!validation.isValid) {
        throw new Error(`Invalid HTML structure: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️ [IMPORT] Parse warnings:', validation.warnings);
      }

      setParsedData(parsed);
      setProgress(25);

      return parsed;
    } catch (err) {
      console.error('❌ [IMPORT] Parse error:', err);
      setError({ step: 'parsing', message: err.message });
      setImportState(IMPORT_STATES.ERROR);
      throw err;
    }
  }, []);

  /**
   * Step 2: Match staff names
   */
  const matchStaffStep = useCallback((parsedData) => {
    setImportState(IMPORT_STATES.MATCHING);
    setProgress(40);

    try {
      console.log('🔍 [IMPORT] Matching staff names...');

      const results = matchStaffNames(parsedData.staffNames, staff);

      console.log('✅ [IMPORT] Staff matching complete:', {
        matched: results.matched.length,
        unmatched: results.unmatched.length,
        matchRate: `${results.summary.matchRate.toFixed(1)}%`
      });

      setMatchResults(results);
      setProgress(55);

      // If there are unmatched names, need manual mapping
      if (results.unmatched.length > 0) {
        setImportState(IMPORT_STATES.PENDING_MANUAL_MAPPING);
        return { ...results, needsManualMapping: true };
      }

      return { ...results, needsManualMapping: false };
    } catch (err) {
      console.error('❌ [IMPORT] Match error:', err);
      setError({ step: 'matching', message: err.message });
      setImportState(IMPORT_STATES.ERROR);
      throw err;
    }
  }, [staff]);

  /**
   * Step 3: Apply manual mappings (if needed)
   */
  const applyManualMappingsStep = useCallback((manualMappings) => {
    if (!matchResults) {
      throw new Error('No match results to apply manual mappings to');
    }

    try {
      console.log('👤 [IMPORT] Applying manual mappings:', manualMappings);

      const resolved = applyManualMappings(
        matchResults.unmatched,
        manualMappings,
        staff
      );

      // Merge with existing matched results
      const updatedResults = {
        matched: [...matchResults.matched, ...resolved.filter(r => r.staffId)],
        unmatched: resolved.filter(r => !r.staffId),
        summary: {
          total: matchResults.summary.total,
          matchedCount: matchResults.matched.length + resolved.filter(r => r.staffId).length,
          unmatchedCount: resolved.filter(r => !r.staffId).length,
          matchRate: 0 // Will be recalculated
        }
      };

      updatedResults.summary.matchRate =
        (updatedResults.matched.length / updatedResults.summary.total) * 100;

      console.log('✅ [IMPORT] Manual mappings applied:', {
        newlyMatched: resolved.filter(r => r.staffId).length,
        stillUnmatched: updatedResults.unmatched.length
      });

      setMatchResults(updatedResults);

      // If still have unmatched, stay in manual mapping state
      if (updatedResults.unmatched.length > 0) {
        return { ...updatedResults, needsManualMapping: true };
      }

      return { ...updatedResults, needsManualMapping: false };
    } catch (err) {
      console.error('❌ [IMPORT] Manual mapping error:', err);
      setError({ step: 'manual_mapping', message: err.message });
      throw err;
    }
  }, [matchResults, staff]);

  /**
   * Step 4: Validate schedule data
   */
  const validateStep = useCallback(() => {
    if (!parsedData || !matchResults) {
      throw new Error('Missing parsed data or match results');
    }

    setImportState(IMPORT_STATES.VALIDATING);
    setProgress(70);

    try {
      console.log('✓ [IMPORT] Validating schedule data...');

      // Generate date range for target period
      const dateRange = generateDateRange(targetPeriodIndex);

      // Create ordered staff array from match results
      const orderedStaff = createOrderedStaffArray(matchResults.matched);

      // Build schedule data structure
      const builtScheduleData = buildScheduleData(parsedData, orderedStaff, dateRange);

      // Validate date range matches
      const dateValidation = validateDateRange(parsedData.rows, dateRange);
      if (!dateValidation.isValid) {
        console.warn('⚠️ [IMPORT] Date validation warnings:', dateValidation.errors);
      }

      // Validate period compatibility
      const periodValidation = validatePeriodCompatibility(parsedData, targetPeriod);
      if (!periodValidation.isCompatible) {
        console.warn('⚠️ [IMPORT] Period compatibility warnings:', periodValidation.warnings);
      }

      // Validate schedule data
      const scheduleValidation = validateScheduleData(
        builtScheduleData,
        dateRange,
        orderedStaff,
        {
          allowCustomShifts: true,
          strictDateValidation: false, // Don't require all dates
          checkStaffAvailability: true
        }
      );

      console.log('✅ [IMPORT] Validation complete:', {
        isValid: scheduleValidation.isValid,
        errors: scheduleValidation.errors.length,
        warnings: scheduleValidation.warnings.length,
        stats: scheduleValidation.stats
      });

      // Check for conflicts with existing schedule
      const conflicts = checkScheduleConflicts(builtScheduleData, currentSchedule);
      if (conflicts.hasConflicts) {
        console.warn('⚠️ [IMPORT] Found conflicts:', conflicts.summary);
      }

      const allResults = {
        scheduleValidation,
        dateValidation,
        periodValidation,
        conflicts
      };

      setValidationResults(allResults);
      setScheduleData(builtScheduleData);
      setProgress(85);

      // If validation failed, error state
      if (!scheduleValidation.isValid) {
        setImportState(IMPORT_STATES.ERROR);
        setError({
          step: 'validation',
          message: 'Schedule validation failed',
          details: scheduleValidation.errors
        });
        return { isValid: false, results: allResults };
      }

      // Ready to import
      setImportState(IMPORT_STATES.READY);
      return { isValid: true, results: allResults, scheduleData: builtScheduleData };
    } catch (err) {
      console.error('❌ [IMPORT] Validation error:', err);
      setError({ step: 'validation', message: err.message });
      setImportState(IMPORT_STATES.ERROR);
      throw err;
    }
  }, [parsedData, matchResults, targetPeriodIndex, targetPeriod, currentSchedule]);

  /**
   * Step 5: Execute import
   */
  const executeImport = useCallback(async (overrideConflicts = false) => {
    if (!scheduleData) {
      throw new Error('No schedule data to import');
    }

    if (importState !== IMPORT_STATES.READY) {
      throw new Error(`Cannot import in state: ${importState}`);
    }

    setImportState(IMPORT_STATES.IMPORTING);
    setProgress(90);

    try {
      console.log('📥 [IMPORT] Executing schedule import...');
      console.log('📊 [IMPORT] Schedule data:', {
        staffCount: Object.keys(scheduleData).length,
        totalShifts: Object.values(scheduleData).reduce(
          (sum, shifts) => sum + Object.keys(shifts).length,
          0
        )
      });

      // Use the updateSchedule operation from useScheduleDataPrefetch
      // This will use WebSocket if enabled, or Supabase fallback
      await updateSchedule(scheduleData, staff, {
        fromAI: false,
        source: 'html-import',
        overrideConflicts
      });

      console.log('✅ [IMPORT] Schedule imported successfully!');

      setImportState(IMPORT_STATES.SUCCESS);
      setProgress(100);

      return { success: true, scheduleData };
    } catch (err) {
      console.error('❌ [IMPORT] Import error:', err);
      setError({ step: 'import', message: err.message });
      setImportState(IMPORT_STATES.ERROR);
      throw err;
    }
  }, [scheduleData, importState, updateSchedule, staff]);

  /**
   * Complete import workflow (all steps)
   */
  const importHTMLSchedule = useCallback(async (file, manualMappings = {}) => {
    try {
      // Step 1: Parse
      const parsed = await parseHTMLStep(file);

      // Step 2: Match
      const matchResult = matchStaffStep(parsed);

      // Step 3: Manual mapping if needed
      if (matchResult.needsManualMapping && Object.keys(manualMappings).length > 0) {
        applyManualMappingsStep(manualMappings);
      }

      // If still need manual mapping, stop here
      if (matchResult.needsManualMapping && Object.keys(manualMappings).length === 0) {
        return { success: false, needsManualMapping: true, unmatchedStaff: matchResult.unmatched };
      }

      // Step 4: Validate
      const validationResult = validateStep();

      // If validation failed, stop here
      if (!validationResult.isValid) {
        return { success: false, validationFailed: true, validation: validationResult };
      }

      // Ready to import (user must call executeImport explicitly)
      return { success: true, ready: true, validation: validationResult };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [parseHTMLStep, matchStaffStep, applyManualMappingsStep, validateStep]);

  /**
   * Reset import state
   */
  const reset = useCallback(() => {
    setImportState(IMPORT_STATES.IDLE);
    setProgress(0);
    setError(null);
    setParsedData(null);
    setMatchResults(null);
    setValidationResults(null);
    setScheduleData(null);
  }, []);

  return {
    // State
    importState,
    progress,
    error,
    isLoading: importState === IMPORT_STATES.PARSING ||
               importState === IMPORT_STATES.IMPORTING ||
               scheduleLoading,
    isReady: importState === IMPORT_STATES.READY,
    isSuccess: importState === IMPORT_STATES.SUCCESS,
    needsManualMapping: importState === IMPORT_STATES.PENDING_MANUAL_MAPPING,

    // Data
    parsedData,
    matchResults,
    validationResults,
    scheduleData,

    // Methods
    parseHTMLStep,
    matchStaffStep,
    applyManualMappingsStep,
    validateStep,
    executeImport,
    importHTMLSchedule,
    reset,

    // Constants
    IMPORT_STATES
  };
}

export default useScheduleImport;
