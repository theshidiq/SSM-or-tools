# Shift Schedule Server - AI Processing Backend

This Express.js server provides server-side AI processing capabilities for the Shift Schedule Manager application.

## Features

- **TensorFlow.js Node.js Processing**: Heavy AI computation on server with CPU optimizations
- **Streaming Progress Updates**: Real-time progress via Server-Sent Events
- **Business Rule Validation**: Full integration with existing constraint validation
- **Automatic Fallback**: Client can fallback to local processing if server unavailable
- **Memory Management**: Automatic tensor cleanup and memory monitoring
- **Performance Optimized**: Batch processing and non-blocking operations

## Quick Start

1. **Install Dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp ../.env.server.example .env
   # Edit .env with your configuration
   ```

3. **Start Server**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

4. **Verify Server**
   ```bash
   # Check health
   curl http://localhost:3001/api/health
   
   # Check AI status
   curl http://localhost:3001/api/ai/status
   ```

## API Endpoints

### Health Check
```http
GET /api/health
```
Returns server health status and AI availability.

### AI Prediction (Streaming)
```http
POST /api/ai/predict
Accept: text/event-stream
Content-Type: application/json

{
  "scheduleData": {...},
  "staffMembers": [...],
  "currentMonthIndex": 0,
  "options": {
    "strictRuleEnforcement": true,
    "useMLPredictions": true
  }
}
```
Returns streaming progress updates followed by final result.

### AI Prediction (Standard)
```http
POST /api/ai/predict
Content-Type: application/json

{
  "scheduleData": {...},
  "staffMembers": [...],
  "currentMonthIndex": 0
}
```
Returns complete result when processing finishes.

### AI Status
```http
GET /api/ai/status
```
Returns detailed AI system status and metrics.

### AI Reset
```http
POST /api/ai/reset
```
Resets the AI system and clears memory.

## Client Integration

The client automatically detects server availability and uses server-side processing when available, falling back to client-side processing when the server is unavailable.

### Using Enhanced Hook

```javascript
import { useAIAssistantEnhanced } from '../hooks/useAIAssistantEnhanced';

const MyComponent = () => {
  const {
    autoFillSchedule,
    serverAvailable,
    processingMode,
    streamingProgress,
    // ... other properties
  } = useAIAssistantEnhanced(
    scheduleData,
    staffMembers,
    currentMonthIndex,
    updateSchedule
  );

  const handleAIFill = async () => {
    const result = await autoFillSchedule();
    if (result.success) {
      console.log('Schedule filled:', result.data);
    }
  };

  return (
    <div>
      <p>Processing Mode: {processingMode}</p>
      <p>Server Available: {serverAvailable ? 'Yes' : 'No'}</p>
      {streamingProgress && (
        <div>
          <p>Progress: {streamingProgress.progress}%</p>
          <p>Stage: {streamingProgress.message}</p>
        </div>
      )}
      <button onClick={handleAIFill}>Fill Schedule</button>
    </div>
  );
};
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Server port | `3001` |
| `CLIENT_URL` | Allowed client origin | `http://localhost:3000` |
| `ENABLE_AI_PROCESSING` | Enable AI endpoints | `true` |
| `MAX_CONCURRENT_REQUESTS` | Max concurrent AI requests | `5` |
| `PROCESSING_TIMEOUT` | Processing timeout (ms) | `120000` |
| `TF_BACKEND` | TensorFlow backend | `cpu` |
| `ENABLE_TF_OPTIMIZATIONS` | Enable TF optimizations | `true` |

### TensorFlow Configuration

The server automatically configures TensorFlow.js for optimal CPU performance:
- CPU backend with optimizations
- Automatic memory cleanup
- Batch processing for efficiency
- Memory usage monitoring

## Architecture

```
Client (React) ──────────────── Server (Express.js)
       │                              │
       ├── Server Available?          ├── AI Processing
       │   ├── Yes → Server AI        │   ├── Feature Generation
       │   └── No → Client AI         │   ├── TensorFlow Prediction
       │                              │   ├── Business Rule Validation
       └── Fallback Processing        │   └── Result Streaming
           ├── Enhanced AI            │
           └── Legacy AI              └── Health Monitoring
```

## Performance Considerations

### Server-Side Benefits
- **CPU Optimizations**: Node.js TensorFlow backend optimized for server CPUs
- **Memory Management**: Automatic tensor cleanup and memory monitoring
- **Batch Processing**: Efficient processing of multiple predictions
- **No UI Blocking**: Heavy computation doesn't affect client UI

### Memory Usage
- Automatic tensor disposal after processing
- Memory usage monitoring and warnings
- Configurable cleanup intervals
- Peak memory tracking

### Processing Speed
- Typically 2-3x faster than client-side processing
- Batch processing for multiple staff members
- Optimized feature generation
- Parallel constraint validation

## Error Handling

The server provides comprehensive error handling:

1. **Request Validation**: Validates input data before processing
2. **Timeout Management**: Configurable processing timeouts
3. **Memory Protection**: Prevents memory leaks from tensor operations
4. **Graceful Degradation**: Client falls back automatically if server fails
5. **Error Recovery**: Automatic cleanup on errors

## Security

- CORS protection with configurable origins
- Request size limits (10MB default)
- Rate limiting capabilities
- Input validation and sanitization
- Secure HTTP headers via Helmet

## Monitoring

### Health Endpoint Response
```json
{
  "status": "ok",
  "timestamp": "2025-08-26T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "heapUsed": 45.2,
    "heapTotal": 67.8
  },
  "ai": {
    "initialized": true,
    "ready": true,
    "status": "ready"
  }
}
```

### Performance Metrics
- Request processing times
- Memory usage patterns
- Success/failure rates
- Concurrent request handling
- AI model performance

## Troubleshooting

### Server Won't Start
- Check port availability: `lsof -i :3001`
- Verify Node.js version: `node --version` (requires 16+)
- Check dependencies: `npm install`

### AI Processing Fails
- Check TensorFlow installation: Server logs show TF initialization
- Verify memory availability: Monitor server memory usage
- Check input data format: Ensure correct data structure

### Client Can't Connect
- Verify CORS settings in server configuration
- Check CLIENT_URL environment variable
- Ensure server is running: `curl http://localhost:3001/api/health`

### Performance Issues
- Monitor memory usage via `/api/ai/status`
- Check processing timeouts
- Review batch sizes for large datasets
- Consider server hardware resources

## Development

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev  # Auto-restarts on file changes
```

### Production Deployment
1. Set `NODE_ENV=production`
2. Configure appropriate memory limits
3. Set up process monitoring (PM2, systemd, etc.)
4. Configure reverse proxy (nginx, etc.)
5. Set up health checks and monitoring

## License

Same as the main Shift Schedule Manager application.