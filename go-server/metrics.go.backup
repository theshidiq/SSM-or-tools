// Phase 4.2: Monitoring & Metrics - Prometheus metrics implementation per plan lines 471-477
package main

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// MetricsCollector - Prometheus metrics as specified in plan lines 471-477
type MetricsCollector struct {
	ActiveConnections   prometheus.Gauge
	MessagesPerSecond   prometheus.Counter
	MessageLatency      prometheus.Histogram
	ConflictResolutions prometheus.Counter
	SupabaseOperations  prometheus.Counter

	// Additional performance metrics
	BatchesPerSecond    prometheus.Counter
	QueueSize          prometheus.Gauge
	WorkerPoolUtilization prometheus.Gauge

	registry     *prometheus.Registry
	server       *http.Server
	startTime    time.Time
	mutex        sync.RWMutex
}

// NewMetricsCollector creates a new metrics collector instance
func NewMetricsCollector() *MetricsCollector {
	registry := prometheus.NewRegistry()

	// Define metrics as specified in the plan
	activeConnections := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "staff_active_connections",
		Help: "Number of active WebSocket connections",
	})

	messagesPerSecond := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "staff_messages_per_second_total",
		Help: "Total number of messages processed per second",
	})

	messageLatency := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name: "staff_message_latency_seconds",
		Help: "Message processing latency in seconds",
		Buckets: prometheus.DefBuckets,
	})

	conflictResolutions := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "staff_conflict_resolutions_total",
		Help: "Total number of conflict resolutions performed",
	})

	supabaseOperations := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "staff_supabase_operations_total",
		Help: "Total number of Supabase database operations",
	})

	// Additional performance metrics
	batchesPerSecond := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "staff_batches_per_second_total",
		Help: "Total number of message batches processed per second",
	})

	queueSize := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "staff_queue_size",
		Help: "Current size of the message queue",
	})

	workerPoolUtilization := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "staff_worker_pool_utilization",
		Help: "Worker pool utilization percentage",
	})

	// Register metrics
	registry.MustRegister(
		activeConnections,
		messagesPerSecond,
		messageLatency,
		conflictResolutions,
		supabaseOperations,
		batchesPerSecond,
		queueSize,
		workerPoolUtilization,
	)

	return &MetricsCollector{
		ActiveConnections:     activeConnections,
		MessagesPerSecond:     messagesPerSecond,
		MessageLatency:        messageLatency,
		ConflictResolutions:   conflictResolutions,
		SupabaseOperations:    supabaseOperations,
		BatchesPerSecond:      batchesPerSecond,
		QueueSize:            queueSize,
		WorkerPoolUtilization: workerPoolUtilization,
		registry:             registry,
		startTime:            time.Now(),
	}
}

// Start begins the metrics collection and HTTP server
func (mc *MetricsCollector) Start() {
	// Create HTTP server for metrics endpoint
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.HandlerFor(mc.registry, promhttp.HandlerOpts{}))

	mc.server = &http.Server{
		Addr:    ":9090",
		Handler: mux,
	}

	// Start metrics server in background
	go func() {
		log.Println("PHASE4: Starting Prometheus metrics server on :9090")
		if err := mc.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("PHASE4: Metrics server error: %v", err)
		}
	}()

	log.Println("PHASE4: Metrics collection started - endpoint: http://localhost:9090/metrics")
}

// UpdateActiveConnections updates the active connections metric
func (mc *MetricsCollector) UpdateActiveConnections(count int) {
	mc.ActiveConnections.Set(float64(count))
}

// IncrementMessagesPerSecond increments the messages per second counter
func (mc *MetricsCollector) IncrementMessagesPerSecond() {
	mc.MessagesPerSecond.Inc()
}

// RecordMessageLatency records message processing latency
func (mc *MetricsCollector) RecordMessageLatency(duration time.Duration) {
	mc.MessageLatency.Observe(duration.Seconds())
}

// IncrementConflictResolutions increments the conflict resolutions counter
func (mc *MetricsCollector) IncrementConflictResolutions() {
	mc.ConflictResolutions.Inc()
}

// IncrementSupabaseOperations increments the Supabase operations counter
func (mc *MetricsCollector) IncrementSupabaseOperations() {
	mc.SupabaseOperations.Inc()
}

// IncrementBatchesPerSecond increments the batches per second counter
func (mc *MetricsCollector) IncrementBatchesPerSecond() {
	mc.BatchesPerSecond.Inc()
}

// UpdateQueueSize updates the message queue size metric
func (mc *MetricsCollector) UpdateQueueSize(size int) {
	mc.QueueSize.Set(float64(size))
}

// UpdateWorkerPoolUtilization updates the worker pool utilization metric
func (mc *MetricsCollector) UpdateWorkerPoolUtilization(utilization float64) {
	mc.WorkerPoolUtilization.Set(utilization)
}

// GetMetricValue retrieves the current value of a specific metric
func (mc *MetricsCollector) GetMetricValue(metricName string) float64 {
	mc.mutex.RLock()
	defer mc.mutex.RUnlock()

	switch metricName {
	case "active_connections":
		dto := &prometheus.MetricFamily{}
		if err := mc.ActiveConnections.Write(dto); err == nil && len(dto.Metric) > 0 {
			return dto.Metric[0].GetGauge().GetValue()
		}
	case "queue_size":
		dto := &prometheus.MetricFamily{}
		if err := mc.QueueSize.Write(dto); err == nil && len(dto.Metric) > 0 {
			return dto.Metric[0].GetGauge().GetValue()
		}
	case "worker_pool_utilization":
		dto := &prometheus.MetricFamily{}
		if err := mc.WorkerPoolUtilization.Write(dto); err == nil && len(dto.Metric) > 0 {
			return dto.Metric[0].GetGauge().GetValue()
		}
	}
	return 0
}

// GetUptime returns the server uptime
func (mc *MetricsCollector) GetUptime() time.Duration {
	return time.Since(mc.startTime)
}

// GetMetricsSummary returns a summary of all metrics
func (mc *MetricsCollector) GetMetricsSummary() map[string]interface{} {
	return map[string]interface{}{
		"active_connections":       mc.GetMetricValue("active_connections"),
		"queue_size":              mc.GetMetricValue("queue_size"),
		"worker_pool_utilization": mc.GetMetricValue("worker_pool_utilization"),
		"uptime":                  mc.GetUptime().String(),
		"metrics_endpoint":        "http://localhost:9090/metrics",
	}
}

// Stop gracefully shuts down the metrics collector
func (mc *MetricsCollector) Stop() {
	if mc.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := mc.server.Shutdown(ctx); err != nil {
			log.Printf("PHASE4: Error shutting down metrics server: %v", err)
		} else {
			log.Println("PHASE4: Metrics server stopped gracefully")
		}
	}
}

// HealthMetrics returns health-related metrics for the health check endpoint
func (mc *MetricsCollector) HealthMetrics() map[string]interface{} {
	return map[string]interface{}{
		"active_connections":       mc.GetMetricValue("active_connections"),
		"queue_size":              mc.GetMetricValue("queue_size"),
		"worker_pool_utilization": mc.GetMetricValue("worker_pool_utilization"),
		"uptime_seconds":          mc.GetUptime().Seconds(),
	}
}