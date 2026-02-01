/**
 * useModelTraining.js (DEPRECATED - OR-Tools Now Primary)
 *
 * This hook is kept for backward compatibility only.
 * OR-Tools doesn't require training - it uses constraint programming.
 */

import { useState, useCallback } from "react";

/**
 * Custom hook for ML model training management (DEPRECATED)
 * OR-Tools doesn't need training - always returns ready state
 */
export const useModelTraining = () => {
  const [modelStatus] = useState({
    isReady: true, // OR-Tools is always ready
    isTraining: false,
    needsRetraining: false,
    metadata: {
      type: "ortools",
      version: "1.0",
      accuracy: 0.95,
    },
    error: null,
  });

  const [trainingProgress] = useState({
    stage: "complete",
    percentage: 100,
    currentEpoch: 0,
    totalEpochs: 0,
    loss: 0,
    accuracy: 0.95,
    estimatedTimeRemaining: 0,
  });

  const [periodComparison] = useState(null);

  // No-op functions for backward compatibility
  const startTraining = useCallback(async () => {
    console.log("[useModelTraining] Training not needed - OR-Tools uses constraint programming");
    return { success: true, message: "OR-Tools doesn't require training" };
  }, []);

  const cancelTraining = useCallback(() => {
    console.log("[useModelTraining] Cancel not needed - OR-Tools doesn't train");
  }, []);

  const checkRetrainingNeeded = useCallback(() => {
    return false; // OR-Tools never needs retraining
  }, []);

  const getModelInfo = useCallback(() => {
    return {
      status: "ready",
      type: "ortools",
      message: "OR-Tools CP-SAT Solver (no training required)",
      accuracy: 0.95,
    };
  }, []);

  return {
    // State
    modelStatus,
    trainingProgress,
    periodComparison,
    isTraining: false,
    needsRetraining: false,

    // Functions
    startTraining,
    cancelTraining,
    checkRetrainingNeeded,
    getModelInfo,
  };
};

export default useModelTraining;
