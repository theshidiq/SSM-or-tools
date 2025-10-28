/**
 * Performance Monitoring Utility
 *
 * Tracks key performance metrics for the schedule table:
 * - Render times
 * - WebSocket latency
 * - State update frequency
 * - Re-render counts
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderTimes: [],
      wsLatency: [],
      stateUpdates: [],
      reRenderCount: 0,
    };
    this.marks = new Map();
    this.enabled = process.env.NODE_ENV === 'development';
  }

  /**
   * Start a performance measurement
   */
  startMeasure(name) {
    if (!this.enabled) return;

    const markName = `${name}-start`;
    this.marks.set(name, performance.now());

    if (performance.mark) {
      performance.mark(markName);
    }
  }

  /**
   * End a performance measurement and record the duration
   */
  endMeasure(name, category = 'renderTimes') {
    if (!this.enabled) return;

    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`⚠️ [PERF] No start mark found for: ${name}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(name);

    // Record metric
    if (this.metrics[category]) {
      this.metrics[category].push({
        name,
        duration,
        timestamp: Date.now(),
      });

      // Keep only last 50 measurements
      if (this.metrics[category].length > 50) {
        this.metrics[category].shift();
      }
    }

    // Create performance measure if available
    if (performance.measure) {
      try {
        performance.measure(name, `${name}-start`);
      } catch (e) {
        // Ignore measure errors
      }
    }

    // Log slow operations (different thresholds for initial vs re-render)
    const threshold = name.includes('initial') ? 3000 : 100; // 3s for initial, 100ms for re-renders
    if (duration > threshold) {
      console.warn(`⚠️ [PERF] Slow ${category}: ${name} took ${duration.toFixed(2)}ms`);
    } else if (name.includes('initial') && process.env.NODE_ENV === 'development') {
      console.log(`✅ [PERF] ${name} completed in ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Record WebSocket latency
   */
  recordWSLatency(latency) {
    if (!this.enabled) return;

    this.metrics.wsLatency.push({
      latency,
      timestamp: Date.now(),
    });

    // Keep only last 50 measurements
    if (this.metrics.wsLatency.length > 50) {
      this.metrics.wsLatency.shift();
    }
  }

  /**
   * Record state update
   */
  recordStateUpdate(updateType) {
    if (!this.enabled) return;

    this.metrics.stateUpdates.push({
      type: updateType,
      timestamp: Date.now(),
    });

    // Keep only last 50 measurements
    if (this.metrics.stateUpdates.length > 50) {
      this.metrics.stateUpdates.shift();
    }
  }

  /**
   * Increment re-render counter
   */
  incrementReRender() {
    if (!this.enabled) return;
    this.metrics.reRenderCount++;
  }

  /**
   * Get average for a metric
   */
  getAverage(category) {
    if (!this.metrics[category] || this.metrics[category].length === 0) {
      return 0;
    }

    const values = this.metrics[category].map(m => m.duration || m.latency);
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    return {
      avgRenderTime: this.getAverage('renderTimes').toFixed(2),
      avgWSLatency: this.getAverage('wsLatency').toFixed(2),
      reRenderCount: this.metrics.reRenderCount,
      stateUpdateCount: this.metrics.stateUpdates.length,
      recentRenders: this.metrics.renderTimes.slice(-5),
      recentWSLatency: this.metrics.wsLatency.slice(-5),
    };
  }

  /**
   * Print performance report
   */
  printReport() {
    if (!this.enabled) return;

    const summary = this.getSummary();

    console.group('📊 Performance Report');
    console.log('Average Render Time:', `${summary.avgRenderTime}ms`);
    console.log('Average WebSocket Latency:', `${summary.avgWSLatency}ms`);
    console.log('Total Re-renders:', summary.reRenderCount);
    console.log('State Updates:', summary.stateUpdateCount);
    console.log('Recent Renders:', summary.recentRenders);
    console.log('Recent WS Latency:', summary.recentWSLatency);
    console.groupEnd();

    return summary;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      renderTimes: [],
      wsLatency: [],
      stateUpdates: [],
      reRenderCount: 0,
    };
    this.marks.clear();
    console.log('🔄 [PERF] Metrics reset');
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`${enabled ? '✅' : '❌'} [PERF] Monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.perfMonitor = performanceMonitor;
  console.log('💡 Performance monitor available at window.perfMonitor');
  console.log('   - perfMonitor.printReport() - View metrics');
  console.log('   - perfMonitor.reset() - Reset counters');
  console.log('   - perfMonitor.getSummary() - Get summary object');
}

export default performanceMonitor;
