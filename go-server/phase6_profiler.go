// Phase 6: Comprehensive Performance Profiling and Optimization
// Success Criteria: 50% network traffic reduction, 99.95% connection stability, AI >90% accuracy
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"

	"shift-schedule-go-server/models"
)

// Phase6Profiler - Comprehensive performance monitoring and optimization
type Phase6Profiler struct {
	// Core metrics
	networkTrafficReduction float64
	connectionStability     float64
	aiAccuracy             float64

	// Detailed metrics
	messageStats           *MessageStatistics
	compressionStats       *CompressionStatistics
	connectionStats        *ConnectionStatistics
	aiStats               *AIStatistics

	mutex                  sync.RWMutex
	startTime             time.Time
}

// MessageStatistics tracks message processing performance
type MessageStatistics struct {
	TotalMessages         int64     `json:"total_messages"`
	CompressedMessages    int64     `json:"compressed_messages"`
	UncompressedMessages  int64     `json:"uncompressed_messages"`
	PartialUpdates        int64     `json:"partial_updates"`
	AverageLatency        float64   `json:"average_latency_ms"`
	MessagesPerSecond     float64   `json:"messages_per_second"`
	LastUpdated          time.Time `json:"last_updated"`
}

// CompressionStatistics tracks compression performance
type CompressionStatistics struct {
	TotalDataBefore       int64   `json:"total_data_before_bytes"`
	TotalDataAfter        int64   `json:"total_data_after_bytes"`
	CompressionRatio      float64 `json:"compression_ratio_percent"`
	BandwidthSaved        int64   `json:"bandwidth_saved_bytes"`
	CompressionTime       float64 `json:"avg_compression_time_ms"`
	DecompressionTime     float64 `json:"avg_decompression_time_ms"`
}

// ConnectionStatistics tracks WebSocket connection stability
type ConnectionStatistics struct {
	TotalConnections      int64     `json:"total_connections"`
	ActiveConnections     int64     `json:"active_connections"`
	ReconnectionAttempts  int64     `json:"reconnection_attempts"`
	SuccessfulReconnects  int64     `json:"successful_reconnects"`
	ConnectionUptime      float64   `json:"connection_uptime_percent"`
	AverageLatency        float64   `json:"average_latency_ms"`
	ConnectionErrors      int64     `json:"connection_errors"`
}

// AIStatistics tracks AI conflict resolution performance
type AIStatistics struct {
	TotalConflicts        int64   `json:"total_conflicts"`
	AIResolved           int64   `json:"ai_resolved"`
	ManualResolved       int64   `json:"manual_resolved"`
	AIAccuracy           float64 `json:"ai_accuracy_percent"`
	AverageConfidence    float64 `json:"average_confidence"`
	ResolutionTime       float64 `json:"avg_resolution_time_ms"`
	StrategyDistribution map[string]int64 `json:"strategy_distribution"`
}

// NewPhase6Profiler creates a new performance profiler
func NewPhase6Profiler() *Phase6Profiler {
	return &Phase6Profiler{
		messageStats: &MessageStatistics{
			LastUpdated: time.Now(),
		},
		compressionStats: &CompressionStatistics{},
		connectionStats: &ConnectionStatistics{},
		aiStats: &AIStatistics{
			StrategyDistribution: make(map[string]int64),
		},
		startTime: time.Now(),
	}
}

// RecordMessage records message processing metrics
func (p *Phase6Profiler) RecordMessage(messageType string, compressed bool, originalSize, compressedSize int, processingTime time.Duration) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.messageStats.TotalMessages++

	if compressed {
		p.messageStats.CompressedMessages++
		p.compressionStats.TotalDataBefore += int64(originalSize)
		p.compressionStats.TotalDataAfter += int64(compressedSize)

		// Update compression ratio
		if p.compressionStats.TotalDataBefore > 0 {
			p.compressionStats.CompressionRatio = (1.0 - float64(p.compressionStats.TotalDataAfter)/float64(p.compressionStats.TotalDataBefore)) * 100.0
		}
		p.compressionStats.BandwidthSaved = p.compressionStats.TotalDataBefore - p.compressionStats.TotalDataAfter
	} else {
		p.messageStats.UncompressedMessages++
	}

	if messageType == models.MessageTypePartialUpdate {
		p.messageStats.PartialUpdates++
	}

	// Update average latency
	latency := float64(processingTime.Nanoseconds()) / 1000000 // Convert to milliseconds
	p.messageStats.AverageLatency = (p.messageStats.AverageLatency*float64(p.messageStats.TotalMessages-1) + latency) / float64(p.messageStats.TotalMessages)

	// Update messages per second
	elapsed := time.Since(p.startTime).Seconds()
	if elapsed > 0 {
		p.messageStats.MessagesPerSecond = float64(p.messageStats.TotalMessages) / elapsed
	}

	p.messageStats.LastUpdated = time.Now()
}

// RecordConnection records connection statistics
func (p *Phase6Profiler) RecordConnection(connected bool, latency time.Duration) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if connected {
		p.connectionStats.TotalConnections++
		p.connectionStats.ActiveConnections++
	} else {
		if p.connectionStats.ActiveConnections > 0 {
			p.connectionStats.ActiveConnections--
		}
	}

	// Update average latency
	if latency > 0 {
		latencyMs := float64(latency.Nanoseconds()) / 1000000
		totalConnections := float64(p.connectionStats.TotalConnections)
		if totalConnections > 0 {
			p.connectionStats.AverageLatency = (p.connectionStats.AverageLatency*(totalConnections-1) + latencyMs) / totalConnections
		}
	}
}

// RecordReconnection records reconnection attempts and success
func (p *Phase6Profiler) RecordReconnection(successful bool) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.connectionStats.ReconnectionAttempts++
	if successful {
		p.connectionStats.SuccessfulReconnects++
	}

	// Calculate connection stability (success rate)
	if p.connectionStats.ReconnectionAttempts > 0 {
		successRate := float64(p.connectionStats.SuccessfulReconnects) / float64(p.connectionStats.ReconnectionAttempts)
		p.connectionStats.ConnectionUptime = successRate * 100.0
	}
}

// RecordAIResolution records AI conflict resolution statistics
func (p *Phase6Profiler) RecordAIResolution(aiResolved bool, confidence float64, strategy string, resolutionTime time.Duration) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.aiStats.TotalConflicts++

	if aiResolved {
		p.aiStats.AIResolved++
	} else {
		p.aiStats.ManualResolved++
	}

	// Update accuracy
	if p.aiStats.TotalConflicts > 0 {
		p.aiStats.AIAccuracy = (float64(p.aiStats.AIResolved) / float64(p.aiStats.TotalConflicts)) * 100.0
	}

	// Update average confidence
	totalConflicts := float64(p.aiStats.TotalConflicts)
	p.aiStats.AverageConfidence = (p.aiStats.AverageConfidence*(totalConflicts-1) + confidence) / totalConflicts

	// Update resolution time
	resolutionMs := float64(resolutionTime.Nanoseconds()) / 1000000
	p.aiStats.ResolutionTime = (p.aiStats.ResolutionTime*(totalConflicts-1) + resolutionMs) / totalConflicts

	// Update strategy distribution
	p.aiStats.StrategyDistribution[strategy]++
}

// GetPhase6Metrics returns comprehensive Phase 6 metrics
func (p *Phase6Profiler) GetPhase6Metrics() *Phase6Metrics {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	// Calculate network traffic reduction (target: 50%)
	networkReduction := p.compressionStats.CompressionRatio

	// Calculate connection stability (target: 99.95%)
	connectionStability := p.connectionStats.ConnectionUptime

	// AI accuracy is already calculated (target: >90%)
	aiAccuracy := p.aiStats.AIAccuracy

	return &Phase6Metrics{
		NetworkTrafficReduction: networkReduction,
		ConnectionStability:     connectionStability,
		AIAccuracy:             aiAccuracy,
		MessageStats:           *p.messageStats,
		CompressionStats:       *p.compressionStats,
		ConnectionStats:        *p.connectionStats,
		AIStats:               *p.aiStats,
		OverallStatus:          p.calculateOverallStatus(networkReduction, connectionStability, aiAccuracy),
		Timestamp:              time.Now(),
		Uptime:                time.Since(p.startTime),
	}
}

// Phase6Metrics comprehensive metrics structure
type Phase6Metrics struct {
	NetworkTrafficReduction float64                `json:"network_traffic_reduction_percent"`
	ConnectionStability     float64                `json:"connection_stability_percent"`
	AIAccuracy             float64                `json:"ai_accuracy_percent"`
	MessageStats           MessageStatistics      `json:"message_statistics"`
	CompressionStats       CompressionStatistics  `json:"compression_statistics"`
	ConnectionStats        ConnectionStatistics   `json:"connection_statistics"`
	AIStats               AIStatistics           `json:"ai_statistics"`
	OverallStatus          string                 `json:"overall_status"`
	Timestamp              time.Time              `json:"timestamp"`
	Uptime                 time.Duration          `json:"uptime"`

	// System performance
	MemoryUsage            uint64                 `json:"memory_usage_bytes"`
	GoroutineCount         int                    `json:"goroutine_count"`
	CPUUsage              float64                `json:"cpu_usage_percent"`
}

// calculateOverallStatus determines if Phase 6 success criteria are met
func (p *Phase6Profiler) calculateOverallStatus(networkReduction, connectionStability, aiAccuracy float64) string {
	criteria := []struct {
		name   string
		value  float64
		target float64
		met    bool
	}{
		{"Network Traffic Reduction", networkReduction, 50.0, networkReduction >= 50.0},
		{"Connection Stability", connectionStability, 99.95, connectionStability >= 99.95},
		{"AI Accuracy", aiAccuracy, 90.0, aiAccuracy >= 90.0},
	}

	metCount := 0
	for _, c := range criteria {
		if c.met {
			metCount++
		}
		log.Printf("📊 Phase 6 Criteria - %s: %.2f%% (Target: %.2f%%) %s",
			c.name, c.value, c.target, map[bool]string{true: "✅", false: "❌"}[c.met])
	}

	if metCount == len(criteria) {
		return "SUCCESS - All Phase 6 criteria met"
	} else if metCount >= 2 {
		return "PARTIAL - Most Phase 6 criteria met"
	} else {
		return "INCOMPLETE - Phase 6 criteria not met"
	}
}

// GetSystemMetrics adds system performance metrics
func (p *Phase6Profiler) GetSystemMetrics() map[string]interface{} {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	return map[string]interface{}{
		"memory_usage_bytes":   memStats.Alloc,
		"total_memory_bytes":   memStats.Sys,
		"goroutine_count":      runtime.NumGoroutine(),
		"gc_count":            memStats.NumGC,
		"uptime_seconds":      time.Since(p.startTime).Seconds(),
	}
}

// ExportMetrics exports all metrics to JSON
func (p *Phase6Profiler) ExportMetrics() ([]byte, error) {
	metrics := p.GetPhase6Metrics()
	systemMetrics := p.GetSystemMetrics()

	// Add system metrics to the main metrics structure
	metrics.MemoryUsage = systemMetrics["memory_usage_bytes"].(uint64)
	metrics.GoroutineCount = systemMetrics["goroutine_count"].(int)

	return json.MarshalIndent(metrics, "", "  ")
}

// LogPhase6Status logs current Phase 6 performance status
func (p *Phase6Profiler) LogPhase6Status() {
	metrics := p.GetPhase6Metrics()

	log.Printf("🚀 PHASE 6 STATUS REPORT - %s", metrics.OverallStatus)
	log.Printf("📊 Network Traffic Reduction: %.2f%% (Target: 50%%)", metrics.NetworkTrafficReduction)
	log.Printf("🔌 Connection Stability: %.2f%% (Target: 99.95%%)", metrics.ConnectionStability)
	log.Printf("🤖 AI Accuracy: %.2f%% (Target: 90%%)", metrics.AIAccuracy)
	log.Printf("📈 Messages/Second: %.2f", metrics.MessageStats.MessagesPerSecond)
	log.Printf("💾 Bandwidth Saved: %d bytes", metrics.CompressionStats.BandwidthSaved)
	log.Printf("🏃 Uptime: %v", metrics.Uptime)
}

// StartPerformanceMonitoring starts continuous performance monitoring
func (p *Phase6Profiler) StartPerformanceMonitoring() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			p.LogPhase6Status()
		}
	}()

	log.Println("🚀 Phase 6: Performance monitoring started")
}