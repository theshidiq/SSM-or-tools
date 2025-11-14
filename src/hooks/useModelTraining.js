/**
 * useModelTraining.js
 *
 * Hook for managing ML model training separately from prediction
 * Handles training orchestration, model persistence, and retraining detection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { TensorFlowScheduler } from '../ai/ml/TensorFlowScheduler';
import {
  detectAvailablePeriods,
  detectAvailablePeriodsUpToNow,
  comparePeriodsWithModel,
  formatPeriodList,
} from '../utils/periodDetection';
import { supabase } from '../utils/supabase';

const MODEL_METADATA_KEY = 'ml_model_metadata';
const LAST_TRAINING_CHECK_KEY = 'ml_last_training_check';

/**
 * Custom hook for ML model training management
 * @returns {Object} Training state and control functions
 */
export const useModelTraining = () => {
  const [modelStatus, setModelStatus] = useState({
    isReady: false,
    isTraining: false,
    needsRetraining: false,
    metadata: null,
    error: null,
  });

  const [trainingProgress, setTrainingProgress] = useState({
    stage: '',
    percentage: 0,
    currentEpoch: 0,
    totalEpochs: 0,
    loss: 0,
    accuracy: 0,
    estimatedTimeRemaining: 0,
  });

  const [periodComparison, setPeriodComparison] = useState(null);
  const schedulerRef = useRef(null);
  const trainingAbortRef = useRef(false);

  /**
   * Initialize TensorFlow scheduler
   */
  const initializeScheduler = useCallback(async () => {
    if (!schedulerRef.current) {
      schedulerRef.current = new TensorFlowScheduler();
      await schedulerRef.current.initialize();
    }
    return schedulerRef.current;
  }, []);

  /**
   * Load model metadata from localStorage
   */
  const loadModelMetadata = useCallback(() => {
    try {
      const metadataJson = localStorage.getItem(MODEL_METADATA_KEY);
      if (metadataJson) {
        const metadata = JSON.parse(metadataJson);
        console.log('📊 Loaded model metadata:', metadata);
        return metadata;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load model metadata:', error);
    }
    return null;
  }, []);

  /**
   * Save model metadata to localStorage
   */
  const saveModelMetadata = useCallback((metadata) => {
    try {
      const enrichedMetadata = {
        ...metadata,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(MODEL_METADATA_KEY, JSON.stringify(enrichedMetadata));
      console.log('💾 Saved model metadata:', enrichedMetadata);
      return true;
    } catch (error) {
      console.error('❌ Failed to save model metadata:', error);
      return false;
    }
  }, []);

  /**
   * Check if model exists and needs retraining
   */
  const checkModelStatus = useCallback(async () => {
    try {
      console.log('🔍 Checking model status...');

      // Load metadata
      const metadata = loadModelMetadata();

      // Detect current available periods
      const currentPeriods = detectAvailablePeriods();

      if (!metadata) {
        // No model trained yet
        setModelStatus({
          isReady: false,
          isTraining: false,
          needsRetraining: true,
          metadata: null,
          error: null,
        });
        setPeriodComparison({
          currentPeriods,
          modelPeriods: [],
          newPeriods: currentPeriods,
          removedPeriods: [],
          hasChanges: true,
          needsRetraining: true,
        });
        console.log('⚠️ No trained model found');
        return { isReady: false, needsRetraining: true };
      }

      // Compare periods
      const comparison = comparePeriodsWithModel(metadata.periodsUsed || []);
      setPeriodComparison(comparison);

      // Check if model exists in IndexedDB
      const scheduler = await initializeScheduler();
      const hasModel = scheduler.model !== null;

      const isReady = hasModel && !comparison.needsRetraining;
      const needsRetraining = !hasModel || comparison.needsRetraining;

      setModelStatus({
        isReady,
        isTraining: false,
        needsRetraining,
        metadata,
        error: null,
      });

      if (comparison.newPeriods.length > 0) {
        console.log(`📊 New periods detected: ${formatPeriodList(comparison.newPeriods)}`);
      }

      return { isReady, needsRetraining, comparison, metadata };
    } catch (error) {
      console.error('❌ Model status check failed:', error);
      setModelStatus(prev => ({
        ...prev,
        error: error.message,
      }));
      return { isReady: false, needsRetraining: true, error: error.message };
    }
  }, [loadModelMetadata, initializeScheduler]);

  /**
   * Sync Supabase data to localStorage for ML training
   * Uses correct schema: schedules ⋈ schedule_staff_assignments
   */
  const syncSupabaseToLocalStorage = async () => {
    try {
      console.log('🔄 [Training Bridge] Starting Supabase → localStorage sync...');

      // Fetch all schedules with correct join to schedule_staff_assignments
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          id,
          schedule_data,
          created_at,
          updated_at,
          schedule_staff_assignments!inner (
            period_index
          )
        `);

      if (schedulesError) {
        throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
      }

      if (!schedules || schedules.length === 0) {
        console.warn('⚠️ [Training Bridge] No schedules found in Supabase');
        return { success: false, periodsSynced: 0 };
      }

      // Fetch all staff members (no period_index column in staff table)
      const { data: allStaff, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (staffError) {
        console.warn('⚠️ [Training Bridge] Failed to fetch staff:', staffError.message);
        // Continue without staff data - we can infer from schedule_data
      }

      console.log(`📊 [Training Bridge] Found ${schedules.length} schedules and ${allStaff?.length || 0} staff records`);

      // Group schedules by period
      const periodMap = {};
      const staffByPeriod = {};

      // Build staff lookup by ID for quick access
      const staffLookup = {};
      if (allStaff) {
        allStaff.forEach(staff => {
          staffLookup[staff.id] = staff;
        });
      }

      // Process schedules - extract schedule_data grouped by period
      schedules.forEach(schedule => {
        // Get period_index from junction table (schedule_staff_assignments)
        const periodIndex = schedule.schedule_staff_assignments?.[0]?.period_index;

        if (periodIndex == null) {
          console.warn(`⚠️ [Training Bridge] Schedule ${schedule.id} has no period_index`);
          return;
        }

        if (!periodMap[periodIndex]) {
          periodMap[periodIndex] = {};
        }

        // Get schedule_data (JSONB) - format: { "staff_id": { "2024-01-21": "○", ... }, ... }
        const scheduleData = schedule.schedule_data || {};

        // Merge this schedule's data into the period map
        Object.entries(scheduleData).forEach(([staffId, shifts]) => {
          if (shifts && typeof shifts === 'object') {
            // Merge shifts for this staff member
            if (!periodMap[periodIndex][staffId]) {
              periodMap[periodIndex][staffId] = {};
            }
            Object.assign(periodMap[periodIndex][staffId], shifts);

            // Add staff to period's staff list if we have their data
            if (staffLookup[staffId]) {
              if (!staffByPeriod[periodIndex]) {
                staffByPeriod[periodIndex] = [];
              }

              // Only add if not already in the list
              if (!staffByPeriod[periodIndex].find(s => s.id === staffId)) {
                staffByPeriod[periodIndex].push(staffLookup[staffId]);
              }
            }
          }
        });
      });

      // Write to localStorage with expected keys
      let syncedCount = 0;
      Object.keys(periodMap).forEach(periodIndex => {
        // FIXED: Use correct localStorage keys that match optimizedStorage format
        const scheduleKey = `schedule-${periodIndex}`;
        const staffKey = `staff-${periodIndex}`;

        try {
          // Write schedule data
          localStorage.setItem(scheduleKey, JSON.stringify(periodMap[periodIndex]));

          // Write staff data if available
          if (staffByPeriod[periodIndex] && staffByPeriod[periodIndex].length > 0) {
            localStorage.setItem(staffKey, JSON.stringify(staffByPeriod[periodIndex]));
          }

          syncedCount++;
          console.log(
            `✅ [Training Bridge] Synced period ${periodIndex}: ${Object.keys(periodMap[periodIndex]).length} staff members, ${staffByPeriod[periodIndex]?.length || 0} staff records`
          );
        } catch (storageError) {
          console.error(
            `❌ [Training Bridge] Failed to write period ${periodIndex} to localStorage:`,
            storageError
          );
        }
      });

      console.log(`🎉 [Training Bridge] Sync complete! Synced ${syncedCount} periods to localStorage`);
      return { success: true, periodsSynced: syncedCount };
    } catch (error) {
      console.error('❌ [Training Bridge] Sync failed:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Start model training
   */
  const startTraining = useCallback(async (options = {}) => {
    try {
      console.log('🚀 Starting model training...');
      trainingAbortRef.current = false;

      // Update status
      setModelStatus(prev => ({
        ...prev,
        isTraining: true,
        error: null,
      }));

      // Reset progress
      setTrainingProgress({
        stage: 'データ同期中...',
        percentage: 0,
        currentEpoch: 0,
        totalEpochs: 0,
        loss: 0,
        accuracy: 0,
        estimatedTimeRemaining: 0,
      });

      // STEP 1: Sync Supabase data to localStorage
      console.log('🔄 Step 1: Syncing data from Supabase...');
      const syncResult = await syncSupabaseToLocalStorage();

      if (!syncResult.success) {
        throw new Error(`データ同期失敗: ${syncResult.error || 'Unknown error'}`);
      }

      if (syncResult.periodsSynced === 0) {
        throw new Error('Supabaseにトレーニングデータがありません');
      }

      console.log(`✅ Synced ${syncResult.periodsSynced} periods from Supabase`);

      // Update progress to data extraction
      setTrainingProgress(prev => ({
        ...prev,
        stage: 'データ抽出中...',
        percentage: 5,
      }));

      // Initialize scheduler
      const scheduler = await initializeScheduler();

      // STEP 2: Filter periods to current date only
      console.log('📅 Step 2: Filtering periods to current date...');
      const periodsToUse = detectAvailablePeriodsUpToNow();

      if (periodsToUse.length === 0) {
        throw new Error('現在の日付までのトレーニングデータがありません');
      }

      console.log(`✅ Using ${periodsToUse.length} periods for training: ${formatPeriodList(periodsToUse)}`);

      // Training progress callback
      const onProgress = (progress) => {
        if (trainingAbortRef.current) {
          throw new Error('Training cancelled by user');
        }

        setTrainingProgress(prev => ({
          ...prev,
          ...progress,
        }));
      };

      // STEP 3: Start training with filtered periods
      console.log('🎯 Step 3: Starting training with filtered periods...');
      const trainingResult = await scheduler.trainModel(null, {
        ...options,
        forceRetrain: true,
        periodsToUse, // Pass filtered periods to training
        onProgress,
      });

      if (!trainingResult.success) {
        throw new Error(trainingResult.error || 'Training failed');
      }

      // Save metadata
      const metadata = {
        version: trainingResult.modelVersion || '2.1.0',
        trainedAt: new Date().toISOString(),
        accuracy: trainingResult.finalAccuracy,
        loss: trainingResult.finalLoss,
        trainingSamples: trainingResult.trainingSamples,
        validationSamples: trainingResult.validationSamples,
        staffCount: trainingResult.staffCount,
        trainingTime: trainingResult.trainingTime,
        periodsUsed: trainingResult.periodsUsed || [],
        totalPeriods: trainingResult.totalPeriods || 0,
        phase2Enabled: true, // Pattern memory is enabled by default
        phase3Enabled: true, // Adaptive intelligence is enabled by default
      };

      saveModelMetadata(metadata);

      // Update status
      setModelStatus({
        isReady: true,
        isTraining: false,
        needsRetraining: false,
        metadata,
        error: null,
      });

      // Reset progress
      setTrainingProgress({
        stage: '完了',
        percentage: 100,
        currentEpoch: trainingResult.currentEpoch || 0,
        totalEpochs: trainingResult.totalEpochs || 0,
        loss: trainingResult.finalLoss,
        accuracy: trainingResult.finalAccuracy,
        estimatedTimeRemaining: 0,
      });

      console.log('✅ Training completed successfully:', trainingResult);
      return {
        success: true,
        metadata,
        result: trainingResult,
      };
    } catch (error) {
      console.error('❌ Training failed:', error);

      setModelStatus(prev => ({
        ...prev,
        isTraining: false,
        error: error.message,
      }));

      setTrainingProgress(prev => ({
        ...prev,
        stage: 'エラー',
        percentage: 0,
      }));

      return {
        success: false,
        error: error.message,
      };
    }
  }, [initializeScheduler, saveModelMetadata]);

  /**
   * Cancel ongoing training
   */
  const cancelTraining = useCallback(() => {
    console.log('🛑 Cancelling training...');
    trainingAbortRef.current = true;

    setModelStatus(prev => ({
      ...prev,
      isTraining: false,
    }));

    setTrainingProgress({
      stage: 'キャンセル済み',
      percentage: 0,
      currentEpoch: 0,
      totalEpochs: 0,
      loss: 0,
      accuracy: 0,
      estimatedTimeRemaining: 0,
    });
  }, []);

  /**
   * Load trained model for use
   */
  const loadModel = useCallback(async () => {
    try {
      console.log('📥 Loading trained model...');
      const scheduler = await initializeScheduler();

      // Model should auto-load from IndexedDB during initialization
      if (scheduler.model) {
        console.log('✅ Model loaded successfully');
        return { success: true, model: scheduler.model };
      } else {
        console.warn('⚠️ No model found in storage');
        return { success: false, error: 'No trained model found' };
      }
    } catch (error) {
      console.error('❌ Failed to load model:', error);
      return { success: false, error: error.message };
    }
  }, [initializeScheduler]);

  /**
   * Get model info for display
   */
  const getModelInfo = useCallback(() => {
    const metadata = modelStatus.metadata;
    if (!metadata) {
      return {
        status: 'not_trained',
        message: 'モデルが未トレーニングです',
        canPredict: false,
      };
    }

    const comparison = periodComparison;
    if (comparison?.needsRetraining) {
      return {
        status: 'needs_retraining',
        message: `新しい期間が検出されました (${formatPeriodList(comparison.newPeriods)})`,
        canPredict: true, // Can still use old model
        warning: '再トレーニング推奨',
      };
    }

    return {
      status: 'ready',
      message: `トレーニング済み (${formatPeriodList(metadata.periodsUsed)})`,
      canPredict: true,
      accuracy: metadata.accuracy,
      trainedAt: metadata.trainedAt,
      samples: metadata.trainingSamples,
    };
  }, [modelStatus.metadata, periodComparison]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    checkModelStatus();
  }, [checkModelStatus]);

  /**
   * Check for new periods periodically (every 5 minutes)
   */
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const lastCheck = localStorage.getItem(LAST_TRAINING_CHECK_KEY);
      const now = Date.now();

      // Check every 5 minutes
      if (!lastCheck || now - parseInt(lastCheck) > 5 * 60 * 1000) {
        checkModelStatus();
        localStorage.setItem(LAST_TRAINING_CHECK_KEY, now.toString());
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [checkModelStatus]);

  return {
    // Status
    modelStatus,
    trainingProgress,
    periodComparison,

    // Actions
    startTraining,
    cancelTraining,
    loadModel,
    checkModelStatus,
    getModelInfo,

    // Computed values
    isReady: modelStatus.isReady,
    isTraining: modelStatus.isTraining,
    needsRetraining: modelStatus.needsRetraining,
    canPredict: modelStatus.isReady || (modelStatus.metadata !== null),
  };
};
