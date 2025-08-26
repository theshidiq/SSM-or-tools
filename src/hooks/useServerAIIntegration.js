/**
 * Server AI Integration Hook
 * 
 * This hook provides server-side AI processing capabilities with fallback to client-side processing.
 * It extends the existing useAIAssistant functionality with:
 * - Server endpoint integration
 * - Streaming progress updates via Server-Sent Events
 * - Automatic fallback to client-side processing
 * - Enhanced error handling and recovery
 */

import { useState, useCallback, useRef, useEffect } from "react";

const SERVER_AI_URL = process.env.REACT_APP_SERVER_AI_URL || 'http://localhost:3001';
const SERVER_TIMEOUT = 30000; // 30 seconds

export const useServerAIIntegration = () => {
  const [serverAvailable, setServerAvailable] = useState(false);
  const [serverStatus, setServerStatus] = useState('unknown');
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState(null);
  const [serverProcessing, setServerProcessing] = useState(false);
  
  const abortControllerRef = useRef(null);
  const eventSourceRef = useRef(null);

  /**
   * Check server availability and health
   */
  const checkServerHealth = useCallback(async () => {
    if (isCheckingServer) return serverAvailable;
    
    setIsCheckingServer(true);
    
    try {
      console.log('🔍 Checking server AI availability...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
      
      const response = await fetch(`${SERVER_AI_URL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const healthData = await response.json();
        const aiAvailable = healthData.ai?.ready === true;
        
        setServerAvailable(aiAvailable);
        setServerStatus(aiAvailable ? 'ready' : 'ai_not_ready');
        
        console.log(`✅ Server health check: ${aiAvailable ? 'AI READY' : 'AI NOT READY'}`);
        return aiAvailable;
      } else {
        console.warn('⚠️ Server health check failed:', response.status);
        setServerAvailable(false);
        setServerStatus('unhealthy');
        return false;
      }
    } catch (error) {
      console.log('💤 Server not available, will use client-side processing');
      setServerAvailable(false);
      setServerStatus(error.name === 'AbortError' ? 'timeout' : 'unreachable');
      return false;
    } finally {
      setIsCheckingServer(false);
    }
  }, [isCheckingServer, serverAvailable]);

  /**
   * Process schedule using server-side AI with streaming progress
   */
  const processWithServerAI = useCallback(async (
    scheduleData,
    staffMembers,
    currentMonthIndex,
    options = {},
    progressCallback = null
  ) => {
    if (!serverAvailable) {
      throw new Error('Server not available for AI processing');
    }

    if (serverProcessing) {
      throw new Error('Server processing already in progress');
    }

    setServerProcessing(true);
    setStreamingProgress(null);

    try {
      console.log('🚀 Starting server-side AI processing...');
      
      const requestData = {
        scheduleData,
        staffMembers,
        currentMonthIndex,
        options: {
          strictRuleEnforcement: true,
          useMLPredictions: true,
          enableProgressUpdates: true,
          ...options,
        },
      };

      // Use streaming approach for real-time progress
      if (progressCallback && typeof EventSource !== 'undefined') {
        return await processWithStreaming(requestData, progressCallback);
      } else {
        // Fallback to regular POST request
        return await processWithRegularRequest(requestData, progressCallback);
      }
    } catch (error) {
      console.error('❌ Server-side AI processing failed:', error);
      throw error;
    } finally {
      setServerProcessing(false);
      setStreamingProgress(null);
      
      // Cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [serverAvailable, serverProcessing]);

  /**
   * Process with Server-Sent Events streaming
   */
  const processWithStreaming = useCallback(async (requestData, progressCallback) => {
    return new Promise((resolve, reject) => {
      console.log('📡 Setting up Server-Sent Events for streaming progress...');
      
      // First, send the request to start processing
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      fetch(`${SERVER_AI_URL}/api/ai/predict`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestData),
      })
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        if (!response.body) {
          throw new Error('Stream not supported');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('📡 Stream completed');
              break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              
              if (line.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(line.slice(6));
                  
                  if (eventData.type === 'progress') {
                    const progressUpdate = {
                      stage: eventData.stage,
                      progress: eventData.progress,
                      message: eventData.message,
                      timestamp: eventData.timestamp,
                      requestId: eventData.requestId,
                    };
                    
                    setStreamingProgress(progressUpdate);
                    
                    if (progressCallback) {
                      progressCallback(progressUpdate);
                    }
                  } else if (eventData.type === 'complete') {
                    console.log('✅ Server processing completed via stream');
                    resolve(eventData.result);
                    return;
                  } else if (eventData.type === 'error') {
                    console.error('❌ Server processing error via stream:', eventData.error);
                    reject(new Error(eventData.error || 'Server processing failed'));
                    return;
                  }
                } catch (parseError) {
                  console.warn('⚠️ Failed to parse SSE data:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      })
      .catch(error => {
        if (error.name === 'AbortError') {
          console.log('🛑 Server request aborted');
          reject(new Error('Processing cancelled'));
        } else {
          console.error('❌ Streaming request failed:', error);
          reject(error);
        }
      });
      
      // Set timeout for the entire operation
      setTimeout(() => {
        if (controller) {
          controller.abort();
          reject(new Error('Server processing timeout'));
        }
      }, SERVER_TIMEOUT);
    });
  }, []);

  /**
   * Process with regular POST request (fallback)
   */
  const processWithRegularRequest = useCallback(async (requestData, progressCallback) => {
    console.log('📤 Using regular POST request for server processing...');
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // Simulate progress updates for regular requests
    const progressSimulator = progressCallback ? setInterval(() => {
      const elapsed = Date.now() - Date.now();
      const progress = Math.min(90, elapsed / 1000 * 5); // Simulate progress
      
      progressCallback({
        stage: 'processing',
        progress,
        message: 'サーバーで処理中...',
        timestamp: Date.now(),
      });
    }, 1000) : null;
    
    try {
      const response = await fetch(`${SERVER_AI_URL}/api/ai/predict`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (progressSimulator) {
        clearInterval(progressSimulator);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (progressCallback) {
        progressCallback({
          stage: 'completed',
          progress: 100,
          message: 'サーバー処理完了',
          timestamp: Date.now(),
        });
      }
      
      console.log('✅ Server processing completed via POST');
      return result.result;
    } catch (error) {
      if (progressSimulator) {
        clearInterval(progressSimulator);
      }
      throw error;
    }
  }, []);

  /**
   * Cancel current server processing
   */
  const cancelServerProcessing = useCallback(async () => {
    if (!serverProcessing) {
      return { success: false, reason: 'No server processing active' };
    }
    
    try {
      console.log('🛑 Cancelling server processing...');
      
      // Abort fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Close event source
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      setServerProcessing(false);
      setStreamingProgress(null);
      
      return { success: true, method: 'server_cancel' };
    } catch (error) {
      console.error('❌ Failed to cancel server processing:', error);
      return { success: false, error: error.message };
    }
  }, [serverProcessing]);

  /**
   * Get server AI status details
   */
  const getServerStatus = useCallback(async () => {
    if (!serverAvailable) {
      return {
        available: false,
        status: serverStatus,
        message: 'Server not available',
      };
    }
    
    try {
      const response = await fetch(`${SERVER_AI_URL}/api/ai/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const statusData = await response.json();
        return {
          available: true,
          ...statusData,
        };
      } else {
        return {
          available: false,
          status: 'error',
          message: `Status check failed: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        available: false,
        status: 'unreachable',
        message: error.message,
      };
    }
  }, [serverAvailable, serverStatus]);

  /**
   * Reset server AI system
   */
  const resetServerAI = useCallback(async () => {
    if (!serverAvailable) {
      throw new Error('Server not available');
    }
    
    try {
      const response = await fetch(`${SERVER_AI_URL}/api/ai/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server reset failed');
      }
    } catch (error) {
      console.error('❌ Server AI reset failed:', error);
      throw error;
    }
  }, [serverAvailable]);

  // Auto-check server health on mount
  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    // Server availability
    serverAvailable,
    serverStatus,
    isCheckingServer,
    checkServerHealth,
    
    // Server processing
    serverProcessing,
    processWithServerAI,
    cancelServerProcessing,
    streamingProgress,
    
    // Server management
    getServerStatus,
    resetServerAI,
    
    // Configuration
    serverUrl: SERVER_AI_URL,
    timeout: SERVER_TIMEOUT,
  };
};