/**
 * Express.js Server for AI-Powered Shift Schedule Processing
 * 
 * This server provides heavy AI computation capabilities with:
 * - TensorFlow.js server-side processing
 * - Streaming progress updates via Server-Sent Events
 * - Business rule validation and constraint checking
 * - Fallback-compatible with client-side processing
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
require('dotenv').config();

// Import server-side AI processing
const { ServerAIProcessor } = require('./ai/serverAI');

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize AI processor
let aiProcessor = null;

const initializeAI = async () => {
  try {
    console.log('🚀 Initializing server-side AI processor...');
    aiProcessor = new ServerAIProcessor();
    await aiProcessor.initialize({
      modelPath: './models',
      maxConcurrentRequests: 5,
      enableProgressStreaming: true,
      businessRuleValidation: true,
    });
    console.log('✅ AI processor initialized successfully');
  } catch (error) {
    console.error('❌ AI processor initialization failed:', error);
    // Server continues without AI (fallback mode)
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    ai: aiProcessor ? {
      initialized: aiProcessor.isInitialized(),
      ready: aiProcessor.isReady(),
      status: aiProcessor.getStatus(),
    } : { available: false }
  };

  res.json(health);
});

// AI prediction endpoint with streaming progress
app.post('/api/ai/predict', async (req, res) => {
  if (!aiProcessor || !aiProcessor.isReady()) {
    return res.status(503).json({
      success: false,
      error: 'AI processor not available',
      fallbackRequired: true,
      message: 'Server AI unavailable, please use client-side processing',
    });
  }

  try {
    const { scheduleData, staffMembers, currentMonthIndex, options } = req.body;

    if (!scheduleData || !staffMembers || currentMonthIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: scheduleData, staffMembers, currentMonthIndex',
      });
    }

    // Set up Server-Sent Events for streaming progress
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Progress callback for streaming updates
      const progressCallback = (progress) => {
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          ...progress,
          timestamp: Date.now(),
        })}\n\n`);
      };

      try {
        console.log(`🎯 Processing AI prediction request for ${staffMembers.length} staff members`);
        
        const result = await aiProcessor.predictSchedule({
          scheduleData,
          staffMembers,
          currentMonthIndex,
          options: {
            strictRuleEnforcement: true,
            useMLPredictions: true,
            enableProgressUpdates: true,
            ...options,
          }
        }, progressCallback);

        // Send final result
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          result,
          timestamp: Date.now(),
        })}\n\n`);

        res.end();
      } catch (error) {
        console.error('❌ AI prediction failed:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message,
          fallbackRequired: true,
          timestamp: Date.now(),
        })}\n\n`);
        res.end();
      }
    } else {
      // Standard JSON response (non-streaming)
      const result = await aiProcessor.predictSchedule({
        scheduleData,
        staffMembers,
        currentMonthIndex,
        options: {
          strictRuleEnforcement: true,
          useMLPredictions: true,
          ...options,
        }
      });

      res.json({
        success: true,
        result,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('❌ AI prediction request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      fallbackRequired: true,
      timestamp: Date.now(),
    });
  }
});

// AI system status endpoint
app.get('/api/ai/status', (req, res) => {
  if (!aiProcessor) {
    return res.json({
      available: false,
      initialized: false,
      message: 'AI processor not initialized',
    });
  }

  const status = aiProcessor.getDetailedStatus();
  res.json({
    available: true,
    ...status,
    timestamp: Date.now(),
  });
});

// AI system reset endpoint
app.post('/api/ai/reset', async (req, res) => {
  if (!aiProcessor) {
    return res.status(503).json({
      success: false,
      error: 'AI processor not available',
    });
  }

  try {
    await aiProcessor.reset();
    res.json({
      success: true,
      message: 'AI system reset successfully',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('❌ AI reset failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    fallbackRequired: true,
    timestamp: Date.now(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: Date.now(),
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('🔄 Shutting down server gracefully...');
  
  if (aiProcessor) {
    try {
      await aiProcessor.cleanup();
      console.log('✅ AI processor cleaned up');
    } catch (error) {
      console.error('❌ AI processor cleanup failed:', error);
    }
  }
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    // Initialize AI processor
    await initializeAI();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Shift Schedule Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🤖 AI Status: http://localhost:${PORT}/api/ai/status`);
      console.log(`🎯 AI Prediction: POST http://localhost:${PORT}/api/ai/predict`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

startServer();

module.exports = app;