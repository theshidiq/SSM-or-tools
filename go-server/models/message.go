// Phase 1.3: WebSocket Protocol Design - Message types as specified in official plan
// Phase 6.1: Advanced Features - Message compression and optimization
package models

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"time"
)

// WebSocketMessage - Exact interface from official plan lines 125-131
type WebSocketMessage struct {
    Type           string      `json:"type"`
    Payload        interface{} `json:"payload"`
    Timestamp      string      `json:"timestamp"`
    ClientID       string      `json:"clientId"`
    SequenceNumber int         `json:"sequenceNumber"`
}

// StaffUpdateMessage - Exact interface from official plan lines 133-141
type StaffUpdateMessage struct {
    Type    string             `json:"type"`
    Payload StaffUpdatePayload `json:"payload"`
}

type StaffUpdatePayload struct {
    StaffID string                 `json:"staffId"`
    Changes map[string]interface{} `json:"changes"`
    Version int64                  `json:"version"`
}

// Message types as defined in official plan line 126
const (
    MessageTypeStaffUpdate = "STAFF_UPDATE"
    MessageTypeStaffCreate = "STAFF_CREATE"
    MessageTypeStaffDelete = "STAFF_DELETE"
    MessageTypeSyncRequest = "SYNC_REQUEST"
    MessageTypeSyncResponse = "SYNC_RESPONSE"
    MessageTypePing = "PING"
    MessageTypePong = "PONG"
    // Phase 6.1: New message types for advanced features
    MessageTypeCompressed = "COMPRESSED"
    MessageTypePartialUpdate = "PARTIAL_UPDATE"
)

// CompressedMessage - Exact implementation from official plan lines 645-650
type CompressedMessage struct {
    Type       string `json:"type"`
    Compressed bool   `json:"compressed"`
    Payload    []byte `json:"payload"` // gzip compressed
    Checksum   string `json:"checksum"`
}

// PartialUpdate - Exact implementation from official plan lines 653-658
type PartialUpdate struct {
    Path      string      `json:"path"`      // JSON path
    Operation string      `json:"operation"` // set, delete, append
    Value     interface{} `json:"value"`
    Version   int64       `json:"version"`
}

// NewWebSocketMessage creates a new WebSocket message with timestamp
func NewWebSocketMessage(msgType string, payload interface{}, clientID string, sequenceNumber int) *WebSocketMessage {
    return &WebSocketMessage{
        Type:           msgType,
        Payload:        payload,
        Timestamp:      time.Now().UTC().Format(time.RFC3339),
        ClientID:       clientID,
        SequenceNumber: sequenceNumber,
    }
}

// NewStaffUpdateMessage creates a staff update message
func NewStaffUpdateMessage(staffID string, changes map[string]interface{}, version int64) *StaffUpdateMessage {
    return &StaffUpdateMessage{
        Type: MessageTypeStaffUpdate,
        Payload: StaffUpdatePayload{
            StaffID: staffID,
            Changes: changes,
            Version: version,
        },
    }
}

// Phase 6.1: Compression and optimization functions

// CompressData compresses data using gzip and returns a CompressedMessage
func CompressData(data interface{}) (*CompressedMessage, error) {
    // Marshal the data to JSON
    jsonData, err := json.Marshal(data)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal data: %w", err)
    }

    // Only compress if data is larger than 1KB
    if len(jsonData) < 1024 {
        // Return uncompressed for small payloads
        return &CompressedMessage{
            Type:       MessageTypeCompressed,
            Compressed: false,
            Payload:    jsonData,
            Checksum:   calculateChecksum(jsonData),
        }, nil
    }

    // Compress the JSON data
    var buf bytes.Buffer
    gzipWriter := gzip.NewWriter(&buf)

    if _, err := gzipWriter.Write(jsonData); err != nil {
        return nil, fmt.Errorf("failed to write to gzip: %w", err)
    }

    if err := gzipWriter.Close(); err != nil {
        return nil, fmt.Errorf("failed to close gzip writer: %w", err)
    }

    compressedData := buf.Bytes()

    return &CompressedMessage{
        Type:       MessageTypeCompressed,
        Compressed: true,
        Payload:    compressedData,
        Checksum:   calculateChecksum(compressedData),
    }, nil
}

// DecompressData decompresses a CompressedMessage and returns the original data
func DecompressData(msg *CompressedMessage, target interface{}) error {
    // Verify checksum
    expectedChecksum := calculateChecksum(msg.Payload)
    if expectedChecksum != msg.Checksum {
        return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedChecksum, msg.Checksum)
    }

    var jsonData []byte

    if msg.Compressed {
        // Decompress the data
        reader := bytes.NewReader(msg.Payload)
        gzipReader, err := gzip.NewReader(reader)
        if err != nil {
            return fmt.Errorf("failed to create gzip reader: %w", err)
        }
        defer gzipReader.Close()

        jsonData, err = io.ReadAll(gzipReader)
        if err != nil {
            return fmt.Errorf("failed to read gzip data: %w", err)
        }
    } else {
        // Data is not compressed
        jsonData = msg.Payload
    }

    // Unmarshal the JSON data
    if err := json.Unmarshal(jsonData, target); err != nil {
        return fmt.Errorf("failed to unmarshal data: %w", err)
    }

    return nil
}

// NewPartialUpdate creates a new partial update message
func NewPartialUpdate(path, operation string, value interface{}, version int64) *PartialUpdate {
    return &PartialUpdate{
        Path:      path,
        Operation: operation,
        Value:     value,
        Version:   version,
    }
}

// ApplyPartialUpdate applies a partial update to a JSON object
func ApplyPartialUpdate(data map[string]interface{}, update *PartialUpdate) error {
    switch update.Operation {
    case "set":
        return setValueAtPath(data, update.Path, update.Value)
    case "delete":
        return deleteValueAtPath(data, update.Path)
    case "append":
        return appendValueAtPath(data, update.Path, update.Value)
    default:
        return fmt.Errorf("unknown operation: %s", update.Operation)
    }
}

// calculateChecksum calculates SHA256 checksum of data
func calculateChecksum(data []byte) string {
    hash := sha256.Sum256(data)
    return hex.EncodeToString(hash[:])
}

// setValueAtPath sets a value at the specified JSON path
func setValueAtPath(data map[string]interface{}, path string, value interface{}) error {
    // Simple path implementation for now - can be extended with full JSONPath
    if path == "" || path == "." {
        return fmt.Errorf("invalid path: %s", path)
    }

    // For now, support simple dot notation paths like "staff.name" or "schedule.date"
    keys := splitPath(path)
    current := data

    // Navigate to the parent of the target key
    for i, key := range keys[:len(keys)-1] {
        if val, exists := current[key]; exists {
            if nested, ok := val.(map[string]interface{}); ok {
                current = nested
            } else {
                return fmt.Errorf("path element %s at position %d is not an object", key, i)
            }
        } else {
            // Create intermediate objects if they don't exist
            current[key] = make(map[string]interface{})
            current = current[key].(map[string]interface{})
        }
    }

    // Set the final value
    finalKey := keys[len(keys)-1]
    current[finalKey] = value
    return nil
}

// deleteValueAtPath deletes a value at the specified JSON path
func deleteValueAtPath(data map[string]interface{}, path string) error {
    if path == "" || path == "." {
        return fmt.Errorf("invalid path: %s", path)
    }

    keys := splitPath(path)
    current := data

    // Navigate to the parent of the target key
    for i, key := range keys[:len(keys)-1] {
        if val, exists := current[key]; exists {
            if nested, ok := val.(map[string]interface{}); ok {
                current = nested
            } else {
                return fmt.Errorf("path element %s at position %d is not an object", key, i)
            }
        } else {
            return fmt.Errorf("path not found: %s", path)
        }
    }

    // Delete the final key
    finalKey := keys[len(keys)-1]
    delete(current, finalKey)
    return nil
}

// appendValueAtPath appends a value to an array at the specified JSON path
func appendValueAtPath(data map[string]interface{}, path string, value interface{}) error {
    if path == "" || path == "." {
        return fmt.Errorf("invalid path: %s", path)
    }

    keys := splitPath(path)
    current := data

    // Navigate to the parent of the target key
    for i, key := range keys[:len(keys)-1] {
        if val, exists := current[key]; exists {
            if nested, ok := val.(map[string]interface{}); ok {
                current = nested
            } else {
                return fmt.Errorf("path element %s at position %d is not an object", key, i)
            }
        } else {
            // Create intermediate objects if they don't exist
            current[key] = make(map[string]interface{})
            current = current[key].(map[string]interface{})
        }
    }

    // Append to the array
    finalKey := keys[len(keys)-1]
    if val, exists := current[finalKey]; exists {
        if arr, ok := val.([]interface{}); ok {
            current[finalKey] = append(arr, value)
        } else {
            return fmt.Errorf("target at path %s is not an array", path)
        }
    } else {
        // Create new array with the value
        current[finalKey] = []interface{}{value}
    }
    return nil
}

// splitPath splits a dot-notation path into individual keys
func splitPath(path string) []string {
    // Simple implementation - can be enhanced to handle escaped dots, arrays, etc.
    keys := make([]string, 0)
    current := ""

    for _, char := range path {
        if char == '.' {
            if current != "" {
                keys = append(keys, current)
                current = ""
            }
        } else {
            current += string(char)
        }
    }

    if current != "" {
        keys = append(keys, current)
    }

    return keys
}

// GetCompressionRatio returns the compression ratio as a percentage
func GetCompressionRatio(originalSize, compressedSize int) float64 {
    if originalSize == 0 {
        return 0
    }
    return (1.0 - float64(compressedSize)/float64(originalSize)) * 100.0
}