/**
 * LazyAIComponents.jsx
 * 
 * Lazy loaded AI components to reduce initial bundle size
 * Core app functionality remains available while AI features load on-demand
 */

import { lazy } from 'react';

// Lazy load AI assistant components
export const LazyAIAssistantModal = lazy(() => 
  import('../ai/AIAssistantModal.jsx').catch(error => {
    console.warn('Failed to load AI Assistant Modal:', error);
    // Return a fallback component
    return { default: () => null };
  })
);

export const LazyEnhancedAIAssistantModal = lazy(() => 
  import('../ai/EnhancedAIAssistantModal.jsx').catch(error => {
    console.warn('Failed to load Enhanced AI Assistant Modal:', error);
    return { default: () => null };
  })
);



// Lazy load performance monitoring components  
export const LazyPerformanceMonitor = lazy(() => 
  // Return a placeholder since PerformanceMonitor.jsx doesn't exist yet
  Promise.resolve({
    default: () => (
      <div className="text-gray-500 text-sm p-4 border rounded">
        Performance Monitor (placeholder - component not implemented yet)
      </div>
    )
  })
);

export const LazyVirtualizedScheduleTable = lazy(() => 
  import('../performance/VirtualizedScheduleTable.jsx').catch(error => {
    console.warn('Failed to load Virtualized Schedule Table:', error);
    // Fallback to regular schedule table import if it exists
    return import('../schedule/ScheduleTable.jsx').catch(() => ({
      default: () => (
        <div className="text-gray-500 text-sm p-4">
          Virtualized Schedule Table not available
        </div>
      )
    }));
  })
);

// Lazy load AI hooks with proper error handling
export const createLazyAIHook = (hookPath, hookName) => {
  return lazy(async () => {
    try {
      const module = await import(hookPath);
      
      // Return a component wrapper that provides the hook
      return {
        default: ({ children, ...props }) => {
          const hook = module[hookName] || module.default;
          if (typeof hook === 'function') {
            const result = hook(props);
            return children(result);
          }
          return children({});
        }
      };
    } catch (error) {
      console.warn(`Failed to load AI hook ${hookName}:`, error);
      return {
        default: ({ children }) => children({})
      };
    }
  });
};

// Helper function to check if AI features are supported
export const checkAIFeatureSupport = () => {
  try {
    // Check for required browser features
    const hasModuleSupport = 'noModule' in HTMLScriptElement.prototype;
    const hasPromiseSupport = typeof Promise !== 'undefined';
    const hasAsyncSupport = (function() {
      try {
        return (async function() {})().constructor === (async function() {}).constructor;
      } catch (e) {
        return false;
      }
    })();

    return hasModuleSupport && hasPromiseSupport && hasAsyncSupport;
  } catch (error) {
    console.warn('Error checking AI feature support:', error);
    return false;
  }
};

// AI Feature loader with progress tracking
export class AIFeatureLoader {
  constructor() {
    this.features = new Map();
    this.listeners = new Set();
    this.isLoading = false;
  }

  addProgressListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyProgress(progress) {
    this.listeners.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Error in progress callback:', error);
      }
    });
  }

  async loadFeatures(featureList = []) {
    if (this.isLoading) return;

    this.isLoading = true;
    const startTime = Date.now();
    let loadedCount = 0;

    try {
      this.notifyProgress({ 
        currentFeature: 'Initializing...', 
        progress: 0, 
        features: featureList.map(f => ({ ...f, loading: false, loaded: false }))
      });

      for (let i = 0; i < featureList.length; i++) {
        const feature = featureList[i];
        
        try {
          this.notifyProgress({ 
            currentFeature: `Loading ${feature.name}...`, 
            progress: (i / featureList.length) * 80, // Leave 20% for finalization
            features: featureList.map((f, idx) => ({
              ...f,
              loading: idx === i,
              loaded: idx < i
            }))
          });

          const module = await feature.loader();
          this.features.set(feature.name, module);
          loadedCount++;

        } catch (error) {
          console.warn(`Failed to load feature ${feature.name}:`, error);
          this.features.set(feature.name, null);
        }
      }

      this.notifyProgress({ 
        currentFeature: 'Finalizing...', 
        progress: 100, 
        features: featureList.map(f => ({ ...f, loading: false, loaded: true }))
      });

      const totalTime = Date.now() - startTime;
      console.log(`AI features loaded: ${loadedCount}/${featureList.length} in ${totalTime}ms`);

    } finally {
      this.isLoading = false;
    }
  }

  getFeature(name) {
    return this.features.get(name);
  }

  isFeatureLoaded(name) {
    return this.features.has(name) && this.features.get(name) !== null;
  }

  getLoadedFeatures() {
    const loaded = [];
    this.features.forEach((module, name) => {
      if (module !== null) {
        loaded.push(name);
      }
    });
    return loaded;
  }
}

// Global AI feature loader instance
export const aiFeatureLoader = new AIFeatureLoader();

// Default AI features that can be lazy loaded
export const AI_FEATURES = {
  ASSISTANT: 'ai-assistant',
  DEBUG_TOOLS: 'debug-tools', 
  PERFORMANCE: 'performance-monitoring',
  ADVANCED_INTELLIGENCE: 'advanced-intelligence',
  AUTONOMOUS_ENGINE: 'autonomous-engine'
};

// Feature definitions with their loaders
export const getAIFeatureDefinitions = () => [
  {
    name: AI_FEATURES.ASSISTANT,
    loader: () => import('../ai/AIAssistantModal.jsx'),
    description: 'AI Schedule Assistant',
    size: '~45kB'
  },
  {
    name: AI_FEATURES.DEBUG_TOOLS,
    loader: () => import('../debug/AIAssistantDebugTester.jsx'),
    description: 'Development Debug Tools',
    size: '~15kB'
  },
  {
    name: AI_FEATURES.PERFORMANCE,
    loader: () => Promise.resolve({
      default: () => (
        <div className="text-gray-500 text-sm p-4 border rounded">
          Performance monitoring placeholder
        </div>
      )
    }),
    description: 'Performance Monitoring (placeholder)',
    size: '~1kB'
  },
  {
    name: AI_FEATURES.ADVANCED_INTELLIGENCE,
    loader: () => import('../../ai/AdvancedIntelligence.js'),
    description: 'Advanced AI Engine',
    size: '~87kB'
  },
  {
    name: AI_FEATURES.AUTONOMOUS_ENGINE,
    loader: () => import('../../ai/AutonomousEngine.js'),
    description: 'Autonomous Learning System',
    size: '~65kB'
  }
];

export default {
  LazyAIAssistantModal,
  LazyEnhancedAIAssistantModal,
  LazyPerformanceMonitor,
  LazyVirtualizedScheduleTable,
  aiFeatureLoader,
  AI_FEATURES,
  getAIFeatureDefinitions,
  checkAIFeatureSupport
};