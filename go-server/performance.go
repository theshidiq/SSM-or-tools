// Phase 4.1: Performance Optimizations - OptimizedServer implementation
package main

import (
	"context"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
)

// OptimizedServer - Connection pooling and performance optimizations as specified in plan lines 441-447
type OptimizedServer struct {
	connPool      *ConnectionPool
	messageQueue  chan Message
	workerPool    *WorkerPool
	metrics       *MetricsCollector
	rateLimiter   *RateLimiter
	batcher       *MessageBatcher
	ctx           context.Context
	cancel        context.CancelFunc
}

// ConnectionPool manages WebSocket connections efficiently
type ConnectionPool struct {
	connections map[string]*websocket.Conn
	mutex       sync.RWMutex
	maxSize     int
}

// WorkerPool handles concurrent message processing
type WorkerPool struct {
	workers   int
	workChan  chan func()
	workerWg  sync.WaitGroup
	ctx       context.Context
	cancel    context.CancelFunc
}

// RateLimiter controls request rates per client
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mutex    sync.RWMutex
	rate     rate.Limit
	burst    int
}

// Message represents a WebSocket message for processing
type Message struct {
	Type      string                 `json:"type"`
	Data      map[string]interface{} `json:"data"`
	ClientID  string                 `json:"client_id"`
	Timestamp time.Time              `json:"timestamp"`
}

// NewOptimizedServer creates a new optimized server instance
func NewOptimizedServer() *OptimizedServer {
	ctx, cancel := context.WithCancel(context.Background())

	return &OptimizedServer{
		connPool:     NewConnectionPool(1000),
		messageQueue: make(chan Message, 10000),
		workerPool:   NewWorkerPool(ctx, 10),
		metrics:      NewMetricsCollector(),
		rateLimiter:  NewRateLimiter(100, 10), // 100 requests per second, burst of 10
		batcher:      NewMessageBatcher(50, 100*time.Millisecond),
		ctx:          ctx,
		cancel:       cancel,
	}
}

// NewConnectionPool creates a new connection pool
func NewConnectionPool(maxSize int) *ConnectionPool {
	return &ConnectionPool{
		connections: make(map[string]*websocket.Conn),
		maxSize:     maxSize,
	}
}

// AddConnection adds a connection to the pool
func (cp *ConnectionPool) AddConnection(id string, conn *websocket.Conn) bool {
	cp.mutex.Lock()
	defer cp.mutex.Unlock()

	if len(cp.connections) >= cp.maxSize {
		return false
	}

	cp.connections[id] = conn
	return true
}

// RemoveConnection removes a connection from the pool
func (cp *ConnectionPool) RemoveConnection(id string) {
	cp.mutex.Lock()
	defer cp.mutex.Unlock()

	if conn, exists := cp.connections[id]; exists {
		conn.Close()
		delete(cp.connections, id)
	}
}

// GetConnection retrieves a connection by ID
func (cp *ConnectionPool) GetConnection(id string) (*websocket.Conn, bool) {
	cp.mutex.RLock()
	defer cp.mutex.RUnlock()

	conn, exists := cp.connections[id]
	return conn, exists
}

// GetAllConnections returns all active connections
func (cp *ConnectionPool) GetAllConnections() map[string]*websocket.Conn {
	cp.mutex.RLock()
	defer cp.mutex.RUnlock()

	connections := make(map[string]*websocket.Conn)
	for id, conn := range cp.connections {
		connections[id] = conn
	}
	return connections
}

// Count returns the number of active connections
func (cp *ConnectionPool) Count() int {
	cp.mutex.RLock()
	defer cp.mutex.RUnlock()
	return len(cp.connections)
}

// NewWorkerPool creates a new worker pool
func NewWorkerPool(ctx context.Context, workers int) *WorkerPool {
	wp := &WorkerPool{
		workers:  workers,
		workChan: make(chan func(), 1000),
		ctx:      ctx,
	}

	// Start workers
	for i := 0; i < workers; i++ {
		wp.workerWg.Add(1)
		go wp.worker()
	}

	return wp
}

// worker processes work items from the work channel
func (wp *WorkerPool) worker() {
	defer wp.workerWg.Done()

	for {
		select {
		case work := <-wp.workChan:
			work()
		case <-wp.ctx.Done():
			return
		}
	}
}

// Submit adds work to the worker pool
func (wp *WorkerPool) Submit(work func()) {
	select {
	case wp.workChan <- work:
	case <-wp.ctx.Done():
	default:
		// Drop work if queue is full
	}
}

// Stop gracefully shuts down the worker pool
func (wp *WorkerPool) Stop() {
	close(wp.workChan)
	wp.workerWg.Wait()
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(r rate.Limit, burst int) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     r,
		burst:    burst,
	}
}

// GetLimiter returns a rate limiter for the given client ID
func (rl *RateLimiter) GetLimiter(clientID string) *rate.Limiter {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	limiter, exists := rl.limiters[clientID]
	if !exists {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[clientID] = limiter
	}

	return limiter
}

// Allow checks if a request is allowed for the given client
func (rl *RateLimiter) Allow(clientID string) bool {
	limiter := rl.GetLimiter(clientID)
	return limiter.Allow()
}

// Start begins the optimized server operations
func (os *OptimizedServer) Start() {
	// Start message processing
	go os.processMessages()

	// Start metrics collection
	os.metrics.Start()

	// Start message batcher
	os.batcher.Start(os.ctx)
}

// processMessages handles messages from the queue
func (os *OptimizedServer) processMessages() {
	for {
		select {
		case msg := <-os.messageQueue:
			os.workerPool.Submit(func() {
				os.handleMessage(msg)
			})
		case <-os.ctx.Done():
			return
		}
	}
}

// handleMessage processes individual messages
func (os *OptimizedServer) handleMessage(msg Message) {
	start := time.Now()
	defer func() {
		os.metrics.RecordMessageLatency(time.Since(start))
		os.metrics.IncrementMessagesPerSecond()
	}()

	// Add message to batcher for efficient broadcasting
	os.batcher.AddMessage(msg)
}

// AddMessage adds a message to the processing queue
func (os *OptimizedServer) AddMessage(msg Message) {
	if !os.rateLimiter.Allow(msg.ClientID) {
		return // Rate limited
	}

	select {
	case os.messageQueue <- msg:
	default:
		// Queue is full, drop message
	}
}

// Stop gracefully shuts down the optimized server
func (os *OptimizedServer) Stop() {
	os.cancel()
	os.workerPool.Stop()
	os.batcher.Stop()
	os.metrics.Stop()
}