import React, { useEffect, useState, useRef, useCallback } from "react";
import { getCLS, getFID, getFCP, getLCP, getTTFB } from "web-vitals";

// Performance metrics collector
class PerformanceCollector {
  constructor() {
    this.metrics = new Map();
    this.marks = new Map();
    this.observers = [];
  }

  // Web Vitals tracking
  initWebVitals(onMetric) {
    getCLS(onMetric);
    getFID(onMetric);
    getFCP(onMetric);
    getLCP(onMetric);
    getTTFB(onMetric);
  }

  // Custom performance marks
  mark(name) {
    performance.mark(name);
    this.marks.set(name, performance.now());
  }

  // Measure between marks
  measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      const latest = entries[entries.length - 1];
      return latest ? latest.duration : 0;
    } catch (error) {
      console.warn('Performance measure failed:', error);
      return 0;
    }
  }

  // Memory usage tracking
  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
      };
    }
    return null;
  }

  // Frame rate monitoring
  startFrameRateMonitor(callback) {
    let lastTime = performance.now();
    let frameCount = 0;
    const targetFPS = 60;
    const frameDuration = 1000 / targetFPS;

    const measureFrame = (currentTime) => {
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        callback(fps);
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  // Long task detection
  detectLongTasks(callback) {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          callback({
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name || 'Unknown'
          });
        });
      });

      try {
        observer.observe({ type: 'longtask', buffered: true });
        this.observers.push(observer);
      } catch (error) {
        console.warn('Long task detection not supported');
      }
    }
  }

  // Cleanup
  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Performance monitoring hook
export const usePerformanceMonitoring = (options = {}) => {
  const {
    trackWebVitals = true,
    trackMemory = true,
    trackFrameRate = false,
    trackLongTasks = true,
    sampleRate = 0.1 // Only track for 10% of sessions to reduce overhead
  } = options;

  const [metrics, setMetrics] = useState({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const collectorRef = useRef(null);

  const shouldTrack = Math.random() < sampleRate;

  useEffect(() => {
    if (!shouldTrack) return;

    const collector = new PerformanceCollector();
    collectorRef.current = collector;
    setIsMonitoring(true);

    const updateMetric = (metric) => {
      setMetrics(prev => ({
        ...prev,
        [metric.name]: {
          value: metric.value,
          rating: metric.rating,
          timestamp: Date.now()
        }
      }));
    };

    // Initialize tracking
    if (trackWebVitals) {
      collector.initWebVitals(updateMetric);
    }

    if (trackMemory) {
      const trackMemory = () => {
        const memory = collector.getMemoryUsage();
        if (memory) {
          updateMetric({
            name: 'memory',
            value: memory.used,
            rating: memory.used > 50 ? 'poor' : memory.used > 25 ? 'needs-improvement' : 'good'
          });
        }
      };

      const memoryInterval = setInterval(trackMemory, 5000);
      return () => clearInterval(memoryInterval);
    }

    if (trackFrameRate) {
      collector.startFrameRateMonitor((fps) => {
        updateMetric({
          name: 'fps',
          value: fps,
          rating: fps < 30 ? 'poor' : fps < 50 ? 'needs-improvement' : 'good'
        });
      });
    }

    if (trackLongTasks) {
      collector.detectLongTasks((task) => {
        updateMetric({
          name: 'longtask',
          value: task.duration,
          rating: task.duration > 100 ? 'poor' : task.duration > 50 ? 'needs-improvement' : 'good'
        });
      });
    }

    return () => {
      collector.disconnect();
      setIsMonitoring(false);
    };
  }, [shouldTrack, trackWebVitals, trackMemory, trackFrameRate, trackLongTasks]);

  const markStart = useCallback((name) => {
    if (collectorRef.current && shouldTrack) {
      collectorRef.current.mark(`${name}-start`);
    }
  }, [shouldTrack]);

  const markEnd = useCallback((name) => {
    if (collectorRef.current && shouldTrack) {
      collectorRef.current.mark(`${name}-end`);
      const duration = collectorRef.current.measure(name, `${name}-start`, `${name}-end`);
      
      setMetrics(prev => ({
        ...prev,
        [name]: {
          value: duration,
          rating: duration > 500 ? 'poor' : duration > 200 ? 'needs-improvement' : 'good',
          timestamp: Date.now()
        }
      }));
    }
  }, [shouldTrack]);

  return {
    metrics,
    isMonitoring,
    markStart,
    markEnd
  };
};

// Performance monitoring component
const PerformanceMonitor = React.memo(({ 
  enabled = process.env.NODE_ENV === 'development',
  showDevTools = false,
  onMetric 
}) => {
  const { metrics, isMonitoring, markStart, markEnd } = usePerformanceMonitoring({
    trackWebVitals: enabled,
    trackMemory: enabled,
    trackFrameRate: showDevTools,
    trackLongTasks: enabled,
    sampleRate: enabled ? 1.0 : 0.1 // Always track in development
  });

  // Report metrics to external service
  useEffect(() => {
    if (onMetric && Object.keys(metrics).length > 0) {
      Object.entries(metrics).forEach(([name, metric]) => {
        onMetric(name, metric);
      });
    }
  }, [metrics, onMetric]);

  // Expose performance tools globally in development
  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      window.performance.markCardRenderStart = () => markStart('card-render');
      window.performance.markCardRenderEnd = () => markEnd('card-render');
      window.performance.markViewSwitchStart = () => markStart('view-switch');
      window.performance.markViewSwitchEnd = () => markEnd('view-switch');
      window.performance.getMetrics = () => metrics;
    }
  }, [enabled, markStart, markEnd, metrics]);

  if (!showDevTools) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs font-mono max-w-xs">
      <div className="font-bold mb-2">Performance Monitor</div>
      <div className="space-y-1">
        <div>Status: {isMonitoring ? '🟢 Active' : '🔴 Inactive'}</div>
        {Object.entries(metrics).map(([name, metric]) => (
          <div key={name} className="flex justify-between">
            <span>{name}:</span>
            <span className={`ml-2 ${
              metric.rating === 'good' ? 'text-green-400' :
              metric.rating === 'needs-improvement' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {typeof metric.value === 'number' ? 
                (name === 'memory' ? `${metric.value}MB` : `${Math.round(metric.value)}ms`) :
                metric.value
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;