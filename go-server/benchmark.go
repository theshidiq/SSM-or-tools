// Phase 4.3: Performance Benchmarking - Go benchmarks for performance testing
package main

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"testing"
	"time"
)

// BenchmarkConnectionPool tests connection pool performance
func BenchmarkConnectionPool(b *testing.B) {
	connPool := NewConnectionPool(1000)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			clientID := fmt.Sprintf("client_%d", i)
			// Simulate connection operations
			connPool.AddConnection(clientID, nil) // nil conn for benchmark
			_, exists := connPool.GetConnection(clientID)
			if !exists {
				b.Errorf("Connection not found: %s", clientID)
			}
			connPool.RemoveConnection(clientID)
			i++
		}
	})
}

// BenchmarkMessageBatcher tests message batching performance
func BenchmarkMessageBatcher(b *testing.B) {
	batcher := NewMessageBatcher(50, 100*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	batcher.Start(ctx)
	defer batcher.Stop()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			msg := Message{
				Type:      "benchmark_test",
				Data:      map[string]interface{}{"test_id": i},
				ClientID:  fmt.Sprintf("client_%d", i%10),
				Timestamp: time.Now(),
			}
			batcher.AddMessage(msg)
			i++
		}
	})
}

// BenchmarkWorkerPool tests worker pool performance
func BenchmarkWorkerPool(b *testing.B) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workerPool := NewWorkerPool(ctx, 10)
	defer workerPool.Stop()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			workerPool.Submit(func() {
				// Simulate work
				time.Sleep(time.Microsecond)
			})
		}
	})
}

// BenchmarkRateLimiter tests rate limiter performance
func BenchmarkRateLimiter(b *testing.B) {
	rateLimiter := NewRateLimiter(1000, 10) // High rate for benchmarking

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			clientID := fmt.Sprintf("client_%d", i%100)
			rateLimiter.Allow(clientID)
			i++
		}
	})
}

// BenchmarkMetricsCollection tests metrics collection performance
func BenchmarkMetricsCollection(b *testing.B) {
	metrics := NewMetricsCollector()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			metrics.IncrementMessagesPerSecond()
			metrics.RecordMessageLatency(time.Millisecond)
			metrics.UpdateActiveConnections(100)
		}
	})
}

// BenchmarkOptimizedServerEnd2End tests the complete optimized server
func BenchmarkOptimizedServerEnd2End(b *testing.B) {
	server := NewOptimizedServer()
	server.Start()
	defer server.Stop()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			msg := Message{
				Type:      "end2end_test",
				Data:      map[string]interface{}{"test_id": i},
				ClientID:  fmt.Sprintf("client_%d", i%50),
				Timestamp: time.Now(),
			}
			server.AddMessage(msg)
			i++
		}
	})
}

// PerformanceTest runs comprehensive performance tests
func PerformanceTest() {
	fmt.Println("PHASE4: Running Performance Benchmarks...")
	fmt.Println("=========================================")

	// Test connection pool scalability
	fmt.Println("Testing Connection Pool Scalability...")
	testConnectionPoolScalability()

	// Test message throughput
	fmt.Println("Testing Message Throughput...")
	testMessageThroughput()

	// Test concurrent load
	fmt.Println("Testing Concurrent Load Handling...")
	testConcurrentLoad()

	// Test memory usage
	fmt.Println("Testing Memory Usage...")
	testMemoryUsage()

	fmt.Println("Performance benchmarks completed!")
}

// testConnectionPoolScalability tests connection pool with increasing load
func testConnectionPoolScalability() {
	sizes := []int{100, 500, 1000, 2000}

	for _, size := range sizes {
		connPool := NewConnectionPool(size)
		start := time.Now()

		// Add connections
		for i := 0; i < size; i++ {
			clientID := fmt.Sprintf("client_%d", i)
			connPool.AddConnection(clientID, nil)
		}

		// Simulate random access
		for i := 0; i < 1000; i++ {
			clientID := fmt.Sprintf("client_%d", i%size)
			connPool.GetConnection(clientID)
		}

		duration := time.Since(start)
		fmt.Printf("  Pool size %d: %v (%.2f μs per operation)\n",
			size, duration, float64(duration.Nanoseconds())/1000.0/1000.0)
	}
}

// testMessageThroughput tests message processing throughput
func testMessageThroughput() {
	batcher := NewMessageBatcher(100, 10*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	batcher.Start(ctx)
	defer batcher.Stop()

	messageCount := 10000
	start := time.Now()

	for i := 0; i < messageCount; i++ {
		msg := Message{
			Type:      "throughput_test",
			Data:      map[string]interface{}{"id": i},
			ClientID:  fmt.Sprintf("client_%d", i%10),
			Timestamp: time.Now(),
		}
		batcher.AddMessage(msg)
	}

	// Wait for processing
	time.Sleep(100 * time.Millisecond)
	duration := time.Since(start)

	throughput := float64(messageCount) / duration.Seconds()
	fmt.Printf("  Message throughput: %.0f messages/second\n", throughput)
	fmt.Printf("  Average latency: %.2f μs per message\n",
		float64(duration.Nanoseconds())/float64(messageCount)/1000.0)
}

// testConcurrentLoad tests concurrent connection handling
func testConcurrentLoad() {
	server := NewOptimizedServer()
	server.Start()
	defer server.Stop()

	concurrency := []int{10, 50, 100, 200}

	for _, c := range concurrency {
		start := time.Now()
		var wg sync.WaitGroup

		for i := 0; i < c; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				// Simulate client activity
				for j := 0; j < 100; j++ {
					msg := Message{
						Type:      "concurrent_test",
						Data:      map[string]interface{}{"worker_id": id, "msg_id": j},
						ClientID:  fmt.Sprintf("client_%d", id),
						Timestamp: time.Now(),
					}
					server.AddMessage(msg)

					// Small delay to simulate realistic usage
					time.Sleep(time.Microsecond * 10)
				}
			}(i)
		}

		wg.Wait()
		duration := time.Since(start)

		fmt.Printf("  Concurrency %d: %v (%.2f msg/s per goroutine)\n",
			c, duration, float64(100)/duration.Seconds())
	}
}

// testMemoryUsage provides basic memory usage insights
func testMemoryUsage() {

	var m1, m2 runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&m1)

	// Create and test components
	server := NewOptimizedServer()
	server.Start()

	// Simulate load
	for i := 0; i < 1000; i++ {
		msg := Message{
			Type:      "memory_test",
			Data:      map[string]interface{}{"id": i},
			ClientID:  fmt.Sprintf("client_%d", i%50),
			Timestamp: time.Now(),
		}
		server.AddMessage(msg)
	}

	runtime.GC()
	runtime.ReadMemStats(&m2)
	server.Stop()

	allocDiff := m2.TotalAlloc - m1.TotalAlloc
	fmt.Printf("  Memory allocated during test: %d bytes (%.2f KB)\n",
		allocDiff, float64(allocDiff)/1024.0)
	fmt.Printf("  Current heap size: %d bytes (%.2f MB)\n",
		m2.HeapAlloc, float64(m2.HeapAlloc)/1024.0/1024.0)
}