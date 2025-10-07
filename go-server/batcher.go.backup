// Phase 4.1: MessageBatcher for high-frequency updates - Implementation per plan lines 449-467
package main

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"
)

// MessageBatcher - Message batching for high-frequency updates as specified in plan lines 450-455
type MessageBatcher struct {
	batchSize     int
	flushInterval time.Duration
	pending       []Message
	mutex         sync.Mutex
	flushTimer    *time.Timer
	connPool      *ConnectionPool
	ctx           context.Context
	cancel        context.CancelFunc
}

// BatchedMessage represents a collection of messages to be sent together
type BatchedMessage struct {
	Type      string    `json:"type"`
	Messages  []Message `json:"messages"`
	BatchSize int       `json:"batch_size"`
	Timestamp time.Time `json:"timestamp"`
}

// NewMessageBatcher creates a new message batcher instance
func NewMessageBatcher(batchSize int, flushInterval time.Duration) *MessageBatcher {
	ctx, cancel := context.WithCancel(context.Background())

	return &MessageBatcher{
		batchSize:     batchSize,
		flushInterval: flushInterval,
		pending:       make([]Message, 0, batchSize),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// SetConnectionPool sets the connection pool for message broadcasting
func (mb *MessageBatcher) SetConnectionPool(connPool *ConnectionPool) {
	mb.connPool = connPool
}

// Start begins the message batcher operations
func (mb *MessageBatcher) Start(ctx context.Context) {
	go mb.flushLoop(ctx)
}

// AddMessage adds a message to the batch - Implementation per plan lines 457-467
func (mb *MessageBatcher) AddMessage(msg Message) {
	mb.mutex.Lock()
	defer mb.mutex.Unlock()

	mb.pending = append(mb.pending, msg)

	// Flush immediately if batch size is reached - per plan line 463-465
	if len(mb.pending) >= mb.batchSize {
		mb.flush()
		return
	}

	// Reset the flush timer
	if mb.flushTimer != nil {
		mb.flushTimer.Stop()
	}
	mb.flushTimer = time.AfterFunc(mb.flushInterval, func() {
		mb.mutex.Lock()
		defer mb.mutex.Unlock()
		if len(mb.pending) > 0 {
			mb.flush()
		}
	})
}

// flush sends the current batch of messages
func (mb *MessageBatcher) flush() {
	if len(mb.pending) == 0 {
		return
	}

	// Create batched message
	batch := BatchedMessage{
		Type:      "batch_update",
		Messages:  make([]Message, len(mb.pending)),
		BatchSize: len(mb.pending),
		Timestamp: time.Now(),
	}

	// Copy messages to avoid race conditions
	copy(batch.Messages, mb.pending)

	// Clear pending messages
	mb.pending = mb.pending[:0]

	// Broadcast batch to all connections
	if mb.connPool != nil {
		go mb.broadcastBatch(batch)
	}

	log.Printf("PHASE4: Flushed batch of %d messages", batch.BatchSize)
}

// broadcastBatch sends a batched message to all connected clients
func (mb *MessageBatcher) broadcastBatch(batch BatchedMessage) {
	if mb.connPool == nil {
		return
	}

	// Serialize the batch
	data, err := json.Marshal(batch)
	if err != nil {
		log.Printf("PHASE4: Error marshaling batch: %v", err)
		return
	}

	// Get all connections and broadcast
	connections := mb.connPool.GetAllConnections()

	var wg sync.WaitGroup
	for clientID, conn := range connections {
		wg.Add(1)
		go func(id string, c *websocket.Conn) {
			defer wg.Done()

			if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("PHASE4: Error broadcasting batch to client %s: %v", id, err)
				// Remove failed connection
				mb.connPool.RemoveConnection(id)
			}
		}(clientID, conn)
	}

	wg.Wait()
}

// flushLoop periodically flushes pending messages
func (mb *MessageBatcher) flushLoop(ctx context.Context) {
	ticker := time.NewTicker(mb.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			mb.mutex.Lock()
			if len(mb.pending) > 0 {
				mb.flush()
			}
			mb.mutex.Unlock()
		case <-ctx.Done():
			// Final flush before shutdown
			mb.mutex.Lock()
			mb.flush()
			mb.mutex.Unlock()
			return
		}
	}
}

// GetPendingCount returns the number of pending messages
func (mb *MessageBatcher) GetPendingCount() int {
	mb.mutex.Lock()
	defer mb.mutex.Unlock()
	return len(mb.pending)
}

// GetBatchSize returns the configured batch size
func (mb *MessageBatcher) GetBatchSize() int {
	return mb.batchSize
}

// GetFlushInterval returns the configured flush interval
func (mb *MessageBatcher) GetFlushInterval() time.Duration {
	return mb.flushInterval
}

// Stop gracefully shuts down the message batcher
func (mb *MessageBatcher) Stop() {
	mb.cancel()

	// Final flush
	mb.mutex.Lock()
	defer mb.mutex.Unlock()
	mb.flush()

	if mb.flushTimer != nil {
		mb.flushTimer.Stop()
	}
}

// ForceFlush immediately flushes all pending messages
func (mb *MessageBatcher) ForceFlush() {
	mb.mutex.Lock()
	defer mb.mutex.Unlock()
	mb.flush()
}