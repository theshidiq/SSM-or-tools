// Phase 2.4: Supabase Integration - Client configuration and connection
package supabase

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// SupabaseConfig holds Supabase connection configuration
type SupabaseConfig struct {
	URL    string
	APIKey string
	Client *http.Client
}

// SupabaseClient wraps the Supabase HTTP client
type SupabaseClient struct {
	config *SupabaseConfig
}

// NewSupabaseClient creates a new Supabase client
func NewSupabaseClient() (*SupabaseClient, error) {
	url := os.Getenv("SUPABASE_URL")
	apiKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	if url == "" {
		// Return a mock client for development
		return &SupabaseClient{
			config: &SupabaseConfig{
				URL:    "http://mock-supabase",
				APIKey: "mock-key",
				Client: &http.Client{Timeout: 10 * time.Second},
			},
		}, nil
	}

	if apiKey == "" {
		return nil, fmt.Errorf("SUPABASE_SERVICE_ROLE_KEY environment variable is required")
	}

	config := &SupabaseConfig{
		URL:    url,
		APIKey: apiKey,
		Client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	return &SupabaseClient{config: config}, nil
}

// makeRequest makes a HTTP request to Supabase
func (sc *SupabaseClient) makeRequest(method, endpoint string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader

	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	url := fmt.Sprintf("%s/rest/v1/%s", sc.config.URL, endpoint)
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+sc.config.APIKey)
	req.Header.Set("apikey", sc.config.APIKey)
	req.Header.Set("Prefer", "return=representation")

	return sc.config.Client.Do(req)
}

// Get makes a GET request to Supabase
func (sc *SupabaseClient) Get(endpoint string, result interface{}) error {
	resp, err := sc.makeRequest("GET", endpoint, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error %d: %s", resp.StatusCode, string(body))
	}

	return json.NewDecoder(resp.Body).Decode(result)
}

// Post makes a POST request to Supabase
func (sc *SupabaseClient) Post(endpoint string, body interface{}, result interface{}) error {
	resp, err := sc.makeRequest("POST", endpoint, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}

	return nil
}

// Put makes a PUT request to Supabase
func (sc *SupabaseClient) Put(endpoint string, body interface{}, result interface{}) error {
	resp, err := sc.makeRequest("PUT", endpoint, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}

	return nil
}

// Patch makes a PATCH request to Supabase
func (sc *SupabaseClient) Patch(endpoint string, body interface{}, result interface{}) error {
	resp, err := sc.makeRequest("PATCH", endpoint, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}

	return nil
}

// Delete makes a DELETE request to Supabase
func (sc *SupabaseClient) Delete(endpoint string) error {
	resp, err := sc.makeRequest("DELETE", endpoint, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// IsMockClient returns true if this is a mock client (for testing/development)
func (sc *SupabaseClient) IsMockClient() bool {
	return sc.config.URL == "http://mock-supabase"
}