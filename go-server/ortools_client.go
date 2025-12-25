// OR-Tools client for communicating with the Python OR-Tools service
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// ORToolsClient handles communication with the Python OR-Tools service
type ORToolsClient struct {
	baseURL    string
	httpClient *http.Client
}

// ORToolsStaffMember represents a staff member for OR-Tools optimization
type ORToolsStaffMember struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Status   string `json:"status"`
	Position string `json:"position"`
}

// ORToolsRequest represents the request to the OR-Tools service
type ORToolsRequest struct {
	StaffMembers []ORToolsStaffMember   `json:"staffMembers"`
	DateRange    []string               `json:"dateRange"`
	Constraints  map[string]interface{} `json:"constraints"`
	Timeout      int                    `json:"timeout"`
}

// ORToolsResponse represents the response from OR-Tools service
type ORToolsResponse struct {
	Success    bool                          `json:"success"`
	Schedule   map[string]map[string]string  `json:"schedule"`
	SolveTime  float64                       `json:"solve_time"`
	IsOptimal  bool                          `json:"is_optimal"`
	Status     string                        `json:"status"`
	Stats      map[string]interface{}        `json:"stats"`
	Violations []map[string]interface{}      `json:"violations,omitempty"`
	Config     map[string]interface{}        `json:"config,omitempty"`
	Error      string                        `json:"error,omitempty"`
}

// NewORToolsClient creates a new OR-Tools client
func NewORToolsClient() *ORToolsClient {
	baseURL := os.Getenv("ORTOOLS_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://ortools-optimizer:5000"
	}

	return &ORToolsClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 90 * time.Second, // Allow longer than solve timeout for network latency
		},
	}
}

// Optimize sends a schedule optimization request to OR-Tools
func (c *ORToolsClient) Optimize(req ORToolsRequest) (*ORToolsResponse, error) {
	url := fmt.Sprintf("%s/optimize", c.baseURL)

	// Set default timeout if not specified
	if req.Timeout == 0 {
		req.Timeout = 30
	}

	// Marshal request
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[OR-TOOLS] Sending optimization request: %d staff, %d days, timeout=%ds",
		len(req.StaffMembers), len(req.DateRange), req.Timeout)

	// Make HTTP request
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to call OR-Tools service: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OR-Tools service returned status %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var result ORToolsResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if result.Success {
		log.Printf("[OR-TOOLS] ✅ Optimization successful: %s in %.2fs",
			result.Status, result.SolveTime)
	} else {
		log.Printf("[OR-TOOLS] ❌ Optimization failed: %s", result.Error)
	}

	return &result, nil
}

// HealthCheck checks if OR-Tools service is healthy
func (c *ORToolsClient) HealthCheck() bool {
	url := fmt.Sprintf("%s/health", c.baseURL)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		log.Printf("[OR-TOOLS] Health check failed: %v", err)
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}
