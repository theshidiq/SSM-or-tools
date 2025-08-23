# AI Performance Optimization System

This comprehensive performance optimization system prevents UI blocking during ML processing and provides an enhanced user experience for AI schedule generation.

## Architecture Overview

The system consists of 6 main components that work together to optimize AI processing:

1. **Web Worker Architecture** (`aiWorker.js`, `WorkerManager.js`)
2. **Progressive Processing** (`FallbackMLProcessor.js`)
3. **Memory Management** (`TensorMemoryManager.js`)
4. **Performance Monitoring** (`PerformanceMonitor.js`)
5. **Streaming Results** (`StreamingResultsManager.js`)
6. **Enhanced UI Components** (`EnhancedAIAssistantModal.jsx`)

All coordinated by the **AI Performance Manager** (`AIPerformanceManager.js`).

## Key Features

### 🚀 Non-Blocking Processing
- **Web Workers**: Heavy ML computations run in background threads
- **Progressive Processing**: Main thread processing with yielding mechanisms
- **Streaming Results**: Real-time result updates without blocking UI

### 🧠 Memory Management
- **TensorFlow.js Optimization**: Automatic tensor cleanup and memory limits
- **Memory Pressure Detection**: Automatic cleanup when memory usage is high
- **Tensor Pooling**: Reuse tensors to reduce allocation overhead

### 📊 Performance Monitoring
- **Real-time Metrics**: CPU, memory, and frame rate monitoring
- **Performance Alerts**: Automatic detection of performance issues
- **Progress Tracking**: Detailed progress reporting with time estimates

### 🌊 Streaming & Lazy Loading
- **Progressive Results**: Results stream as they're processed
- **Lazy Loading**: Large datasets loaded on-demand
- **Caching**: Intelligent result caching with TTL

### 🎛️ Enhanced User Experience
- **Cancellation Support**: Cancel long-running operations
- **Pause/Resume**: Pause and resume processing
- **Performance Dashboard**: Real-time system health monitoring

## Usage Examples

### Basic Integration

```javascript
import { getAIPerformanceManager } from './ai/performance/AIPerformanceManager';

// Initialize the performance system
const performanceManager = getAIPerformanceManager();
await performanceManager.initialize({
  enableWorkers: true,
  enableMemoryManagement: true,
  enablePerformanceMonitoring: true,
  enableStreaming: true,
  maxMemoryMB: 400
});

// Process ML predictions with all optimizations
const result = await performanceManager.processMLPredictions(
  {
    scheduleData: currentSchedule,
    staffMembers: staffList,
    dateRange: dates,
    options: { strategy: 'enhanced' }
  },
  (progress) => {
    console.log(`Progress: ${progress.progress}% - ${progress.message}`);
    // Update UI with progress
  }
);
```

### React Component Integration

```jsx
import React, { useState, useEffect } from 'react';
import { getAIPerformanceManager } from './ai/performance/AIPerformanceManager';
import EnhancedAIAssistantModal from './components/ai/EnhancedAIAssistantModal';

function ScheduleEditor() {
  const [performanceManager, setPerformanceManager] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  useEffect(() => {
    const initializeAI = async () => {
      try {
        const manager = getAIPerformanceManager();
        await manager.initialize();
        setPerformanceManager(manager);
      } catch (error) {
        console.error('AI initialization failed:', error);
      }
    };
    
    initializeAI();
    
    return () => {
      if (performanceManager) {
        performanceManager.destroy();
      }
    };
  }, []);

  const handleAIProcessing = async (progressCallback) => {
    if (!performanceManager) {
      throw new Error('AI system not initialized');
    }

    setIsProcessing(true);
    
    try {
      const result = await performanceManager.processMLPredictions(
        {
          scheduleData: currentSchedule,
          staffMembers: staffMembers,
          dateRange: dateRange
        },
        progressCallback
      );
      
      // Apply results to schedule
      applyAIResults(result.data);
      
      return result;
      
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAI = async () => {
    if (performanceManager) {
      await performanceManager.cancelProcessing();
    }
  };

  const handlePauseAI = async () => {
    if (performanceManager) {
      await performanceManager.pauseProcessing();
    }
  };

  const handleResumeAI = async () => {
    if (performanceManager) {
      await performanceManager.resumeProcessing();
    }
  };

  return (
    <div>
      {/* Your schedule editor UI */}
      
      <button onClick={() => setShowAIModal(true)}>
        🤖 AI Assistant
      </button>

      <EnhancedAIAssistantModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onAutoFillSchedule={handleAIProcessing}
        isProcessing={isProcessing}
        systemStatus={performanceManager?.getSystemStatus()}
        performanceMonitor={performanceManager?.components.performanceMonitor}
        streamingManager={performanceManager?.components.streamingManager}
        onCancel={handleCancelAI}
        onPause={handlePauseAI}
        onResume={handleResumeAI}
      />
    </div>
  );
}
```

### Advanced Configuration

```javascript
// Advanced configuration for high-performance scenarios
await performanceManager.initialize({
  // Web Worker configuration
  enableWorkers: true,
  workerConfig: {
    memoryLimitMB: 600,
    timeout: 300000, // 5 minutes
    enableTensorPooling: true
  },

  // Memory management
  enableMemoryManagement: true,
  memoryConfig: {
    maxMemoryMB: 800,
    warningThreshold: 600,
    criticalThreshold: 750,
    autoCleanupEnabled: true,
    optimizationStrategies: {
      aggressiveCleanup: true,
      tensorPooling: true,
      memoryDefragmentation: true
    }
  },

  // Performance monitoring
  enablePerformanceMonitoring: true,
  performanceConfig: {
    monitoringIntervalMs: 1000,
    alertThresholds: {
      memoryIncrease: 100 * 1024 * 1024, // 100MB
      processingTimeIncrease: 10000,      // 10 seconds
      frameDropThreshold: 10
    }
  },

  // Streaming configuration
  enableStreaming: true,
  streamingConfig: {
    streamBufferSize: 200,
    cacheMaxSize: 2000,
    lazyLoadThreshold: 100,
    batchSize: 50
  }
});
```

## Performance Strategies

The system automatically selects the optimal processing strategy based on:

1. **Data Size**: Number of staff × number of dates
2. **Available Memory**: Current system memory usage
3. **System Load**: Current CPU utilization
4. **Component Availability**: Which optimization components are available

### Strategy Selection

| Data Size | Memory | System Load | Selected Strategy |
|-----------|--------|-------------|-------------------|
| Large (>1000) | High | Low | **Worker + Streaming** |
| Medium (500-1000) | Medium | Low | **Worker Batch** |
| Medium (100-500) | Low | High | **Streaming Fallback** |
| Small (<100) | Any | Any | **Basic Fallback** |

## Performance Monitoring

### Real-time Metrics

```javascript
// Subscribe to performance updates
performanceManager.on('progress', (progress) => {
  console.log('Progress:', progress.progress + '%');
  console.log('Stage:', progress.stage);
  console.log('Memory Usage:', progress.memoryUsage);
  console.log('Processing Speed:', progress.itemsPerSecond);
});

// Subscribe to performance alerts
performanceManager.on('alert', (alert) => {
  if (alert.severity === 'critical') {
    console.error('Critical Alert:', alert.message);
    // Take corrective action
  }
});
```

### Health Monitoring

```javascript
// Check system health
const health = await performanceManager.checkSystemHealth();

console.log('Overall Health:', health.overall); // 'good', 'warning', 'critical'
console.log('Components:', health.components);
console.log('Recommendations:', health.recommendations);
```

## Memory Management

### Automatic Cleanup

The system automatically manages memory through:

- **Tensor Lifecycle Tracking**: Monitors all TensorFlow.js tensors
- **Memory Pressure Detection**: Triggers cleanup when usage is high
- **Automatic Garbage Collection**: Forces cleanup when needed
- **Tensor Pooling**: Reuses tensors to reduce allocations

### Manual Memory Management

```javascript
// Get memory statistics
const memoryStats = performanceManager.components.memoryManager.getMemoryStats();
console.log('Current Memory:', memoryStats.currentMemoryUsage);
console.log('Peak Memory:', memoryStats.peakMemoryUsage);
console.log('Memory Utilization:', memoryStats.memoryUtilization + '%');

// Force memory cleanup
await performanceManager.components.memoryManager.performMemoryCleanup();

// Setup memory pressure alerts
performanceManager.components.memoryManager.onMemoryPressure('high', (stats) => {
  console.warn('High memory usage detected:', stats);
});
```

## Streaming Results

### Real-time Updates

```javascript
// Subscribe to streaming results
const unsubscribe = streamingManager.subscribeToStream(
  'ml_processing',
  (data, metadata) => {
    if (metadata.type === 'chunk') {
      // Process partial results
      data.forEach(result => {
        updateScheduleCell(result.staffId, result.dateKey, result.prediction);
      });
    } else if (metadata.type === 'complete') {
      // Handle completion
      console.log('Streaming completed:', data);
    }
  },
  {
    includePartial: true,
    throttle: 100 // Update every 100ms max
  }
);
```

### Lazy Loading

```javascript
// Large datasets are automatically lazy-loaded
const result = await streamingManager.streamMLResults(
  'large_dataset',
  {
    scheduleData,
    staffMembers, // 100+ staff members
    dateRange     // 60+ days
  },
  (progress) => {
    // Progress includes lazy loading status
    console.log('Lazy loaded items:', progress.lazyLoadedItems);
  }
);
```

## Error Handling & Recovery

### Graceful Degradation

The system provides graceful degradation when optimizations fail:

1. **Worker Failure**: Falls back to main thread processing with yielding
2. **Memory Pressure**: Automatically reduces memory usage and switches strategies
3. **Processing Errors**: Provides detailed error information and recovery options

### Error Recovery

```javascript
performanceManager.on('error', async (error) => {
  console.error('Processing error:', error);
  
  if (error.recoverable) {
    // Attempt recovery with different strategy
    await performanceManager.processMLPredictions(data, progressCallback);
  } else {
    // Show error to user with retry option
    showErrorMessage(error.message, {
      canRetry: true,
      onRetry: () => retryProcessing()
    });
  }
});
```

## Best Practices

### 1. Initialize Early
```javascript
// Initialize during app startup
useEffect(() => {
  const initAI = async () => {
    const manager = getAIPerformanceManager();
    await manager.initialize();
    setAIManager(manager);
  };
  initAI();
}, []);
```

### 2. Handle Cleanup
```javascript
// Always cleanup on unmount
useEffect(() => {
  return () => {
    if (aiManager) {
      aiManager.destroy();
    }
  };
}, [aiManager]);
```

### 3. Monitor Performance
```javascript
// Monitor system health regularly
useEffect(() => {
  if (!aiManager) return;
  
  const interval = setInterval(async () => {
    const health = await aiManager.checkSystemHealth();
    if (health.overall === 'critical') {
      // Take action
      setShowPerformanceWarning(true);
    }
  }, 30000);
  
  return () => clearInterval(interval);
}, [aiManager]);
```

### 4. Provide User Feedback
```javascript
// Always show progress and allow cancellation
const handleAI = async () => {
  setIsProcessing(true);
  setCanCancel(true);
  
  try {
    await aiManager.processMLPredictions(data, (progress) => {
      setProgress(progress);
      setCanPause(progress.canPause);
    });
  } finally {
    setIsProcessing(false);
    setCanCancel(false);
    setCanPause(false);
  }
};
```

## Performance Metrics

### Key Performance Indicators

- **Processing Time**: Target < 15 seconds for typical schedules
- **Memory Usage**: Stay under 400MB for optimal performance
- **UI Responsiveness**: Maintain > 30fps during processing
- **Success Rate**: > 95% successful completions
- **User Experience**: < 2 seconds to first result

### Benchmarking

The system includes built-in benchmarking:

```javascript
// Run performance benchmark
const benchmark = await performanceManager.runBenchmark({
  dataSize: 'large', // small, medium, large
  iterations: 5,
  includeMemoryProfile: true
});

console.log('Benchmark Results:', benchmark);
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce `maxMemoryMB` setting
   - Enable aggressive cleanup
   - Use streaming for large datasets

2. **Slow Processing**
   - Ensure Web Workers are enabled
   - Check system memory availability
   - Consider reducing data size

3. **UI Blocking**
   - Enable progressive processing
   - Reduce `yieldThreshold` in fallback processor
   - Check for long-running synchronous operations

### Debug Mode

```javascript
// Enable debug logging
await performanceManager.initialize({
  debug: true,
  logLevel: 'verbose'
});
```

## Browser Compatibility

- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Limited Web Worker support (fallback available)
- **Edge**: Full support

## Future Enhancements

- **WebAssembly Integration**: For even faster processing
- **Service Worker Support**: For background processing
- **IndexedDB Caching**: For persistent result caching
- **WebGPU Support**: For GPU-accelerated ML inference
- **Progressive Web App Features**: For offline AI processing

---

This performance optimization system ensures your AI schedule generation remains responsive and user-friendly, regardless of dataset size or system capabilities.