/**
 * LazyAdvancedAI.jsx
 * 
 * Lazy loaded wrapper for advanced AI features to reduce initial bundle size
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AILoadingSpinner } from '../ui/LoadingStates';

let AdvancedIntelligence = null;
let AutonomousEngine = null;

const LazyAdvancedAI = ({ 
  scheduleData, 
  staffMembers, 
  currentMonthIndex, 
  updateSchedule,
  enabled = false,
  onSystemReady
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [system, setSystem] = useState(null);

  // Load advanced AI systems on demand
  const loadAdvancedAI = useCallback(async () => {
    if (isLoaded || isLoading) return system;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Loading Advanced AI Systems...');
      
      // Load AdvancedIntelligence
      if (!AdvancedIntelligence) {
        const aiModule = await import('../../ai/AdvancedIntelligence.js');
        AdvancedIntelligence = aiModule.advancedIntelligence || aiModule.default;
      }
      
      // Load AutonomousEngine 
      if (!AutonomousEngine) {
        const aeModule = await import('../../ai/AutonomousEngine.js');
        AutonomousEngine = aeModule.autonomousEngine || aeModule.default;
      }
      
      // Initialize system
      const advancedSystem = {
        intelligence: AdvancedIntelligence,
        autonomous: AutonomousEngine,
        initialized: false
      };
      
      // Initialize if needed
      if (AdvancedIntelligence?.initialize) {
        await AdvancedIntelligence.initialize({
          scheduleData,
          staffMembers,
          currentMonthIndex
        });
        advancedSystem.initialized = true;
      }
      
      setSystem(advancedSystem);
      setIsLoaded(true);
      
      if (onSystemReady) {
        onSystemReady(advancedSystem);
      }
      
      console.log('✅ Advanced AI Systems loaded successfully');
      return advancedSystem;
      
    } catch (err) {
      console.error('❌ Failed to load Advanced AI Systems:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isLoading, scheduleData, staffMembers, currentMonthIndex, onSystemReady]);

  // Auto-load when enabled
  useEffect(() => {
    if (enabled && !isLoaded && !isLoading) {
      loadAdvancedAI();
    }
  }, [enabled, isLoaded, isLoading, loadAdvancedAI]);

  // Provide AI methods
  const aiMethods = useMemo(() => {
    if (!system || !isLoaded) {
      return {
        generateSchedule: async () => ({ success: false, message: 'AI system not loaded' }),
        optimizeSchedule: async () => ({ success: false, message: 'AI system not loaded' }),
        predictStaffing: async () => ({ success: false, message: 'AI system not loaded' }),
        isReady: false,
        isLoading,
        error
      };
    }

    return {
      generateSchedule: async (options = {}) => {
        try {
          if (system.intelligence?.generateSchedule) {
            return await system.intelligence.generateSchedule({
              scheduleData,
              staffMembers,
              currentMonthIndex,
              updateSchedule,
              ...options
            });
          }
          return { success: false, message: 'Generate schedule not available' };
        } catch (err) {
          console.error('Error in generateSchedule:', err);
          return { success: false, error: err.message };
        }
      },
      
      optimizeSchedule: async (options = {}) => {
        try {
          if (system.intelligence?.optimizeSchedule) {
            return await system.intelligence.optimizeSchedule({
              scheduleData,
              staffMembers,
              currentMonthIndex,
              updateSchedule,
              ...options
            });
          }
          return { success: false, message: 'Optimize schedule not available' };
        } catch (err) {
          console.error('Error in optimizeSchedule:', err);
          return { success: false, error: err.message };
        }
      },
      
      predictStaffing: async (options = {}) => {
        try {
          if (system.autonomous?.predictStaffing) {
            return await system.autonomous.predictStaffing({
              scheduleData,
              staffMembers,
              currentMonthIndex,
              ...options
            });
          }
          return { success: false, message: 'Predict staffing not available' };
        } catch (err) {
          console.error('Error in predictStaffing:', err);
          return { success: false, error: err.message };
        }
      },
      
      isReady: system.initialized,
      isLoading,
      error: null
    };
  }, [system, isLoaded, scheduleData, staffMembers, currentMonthIndex, updateSchedule, isLoading]);

  // Don't render anything - this is a logic component
  // The methods are accessed through refs or callbacks
  return null;
};

// Hook version for easier integration
export const useAdvancedAI = (scheduleData, staffMembers, currentMonthIndex, updateSchedule, enabled = false) => {
  const [system, setSystem] = useState(null);
  const [methods, setMethods] = useState({
    generateSchedule: async () => ({ success: false, message: 'AI system not loaded' }),
    optimizeSchedule: async () => ({ success: false, message: 'AI system not loaded' }),
    predictStaffing: async () => ({ success: false, message: 'AI system not loaded' }),
    isReady: false,
    isLoading: false,
    error: null
  });

  const handleSystemReady = useCallback((aiSystem) => {
    setSystem(aiSystem);
  }, []);

  // Create the lazy component instance
  const lazyAI = useMemo(() => (
    <LazyAdvancedAI
      scheduleData={scheduleData}
      staffMembers={staffMembers}
      currentMonthIndex={currentMonthIndex}
      updateSchedule={updateSchedule}
      enabled={enabled}
      onSystemReady={handleSystemReady}
    />
  ), [scheduleData, staffMembers, currentMonthIndex, updateSchedule, enabled, handleSystemReady]);

  // Update methods when system changes
  useEffect(() => {
    if (system) {
      setMethods({
        generateSchedule: async (options = {}) => {
          try {
            if (system.intelligence?.generateSchedule) {
              return await system.intelligence.generateSchedule({
                scheduleData,
                staffMembers,
                currentMonthIndex,
                updateSchedule,
                ...options
              });
            }
            return { success: false, message: 'Generate schedule not available' };
          } catch (err) {
            return { success: false, error: err.message };
          }
        },
        optimizeSchedule: async (options = {}) => {
          try {
            if (system.intelligence?.optimizeSchedule) {
              return await system.intelligence.optimizeSchedule({
                scheduleData,
                staffMembers,
                currentMonthIndex,
                updateSchedule,
                ...options
              });
            }
            return { success: false, message: 'Optimize schedule not available' };
          } catch (err) {
            return { success: false, error: err.message };
          }
        },
        predictStaffing: async (options = {}) => {
          try {
            if (system.autonomous?.predictStaffing) {
              return await system.autonomous.predictStaffing({
                scheduleData,
                staffMembers,
                currentMonthIndex,
                ...options
              });
            }
            return { success: false, message: 'Predict staffing not available' };
          } catch (err) {
            return { success: false, error: err.message };
          }
        },
        isReady: system.initialized,
        isLoading: false,
        error: null
      });
    }
  }, [system, scheduleData, staffMembers, currentMonthIndex, updateSchedule]);

  return {
    ...methods,
    component: lazyAI // Render this in your component tree
  };
};

export default LazyAdvancedAI;