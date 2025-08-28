# Concurrent Processing Setup for Ollama Chat

This document explains how to configure your Ollama chat application to handle multiple concurrent requests instead of processing them sequentially.

## Problem

By default, Ollama processes requests sequentially. When one user is receiving a streamed response, other users have to wait until that response is complete before their requests are processed.

## Solutions Implemented

### 1. Ollama Configuration Parameters

The backend now sends specific configuration parameters to Ollama to enable concurrent processing:

```javascript
const OLLAMA_CONFIG = {
  num_ctx: 4096,           // Context window size
  num_thread: 4,           // Number of threads for parallel processing
  num_gpu: 1,              // Number of GPU layers (if available)
  num_parallel: 4,         // Number of parallel requests (Ollama 0.1.0+)
  temperature: 0.7,        // Sampling temperature
  top_p: 0.9,              // Top-p sampling
  repeat_penalty: 1.1,     // Repeat penalty
  seed: -1,                // Random seed (-1 for random)
};
```

### 2. Request Queue Management

A request queue system manages concurrent requests:

- **Max Concurrent Requests**: 4 (configurable)
- **Queue Management**: Requests beyond the limit are queued
- **Status Monitoring**: Real-time queue status available via `/api/queue-status`

### 3. Connection Pooling

HTTP/HTTPS connection pooling for better performance:

- **Max Connections**: 50 concurrent connections
- **Keep-Alive**: Enabled with 1-second timeout
- **Idle Connections**: Up to 10 connections kept in pool

### 4. Resource Management

Docker configuration includes resource limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

## Configuration

### Backend Configuration (`backend/config.js`)

You can adjust the concurrent processing settings in `backend/config.js`:

```javascript
// Request queue configuration
export const QUEUE_CONFIG = {
  maxConcurrent: 4,        // Maximum concurrent requests
  timeout: 300000,         // Request timeout (5 minutes)
  retryAttempts: 2,        // Number of retry attempts
  retryDelay: 1000,        // Delay between retries (ms)
};

// Connection pooling configuration
export const POOL_CONFIG = {
  maxSockets: 50,          // Maximum concurrent connections
  maxFreeSockets: 10,      // Maximum idle connections
  keepAlive: true,         // Enable keep-alive
  keepAliveMsecs: 1000,    // Keep-alive timeout
  timeout: 60000,          // Connection timeout
};
```

### Ollama Server Configuration

For optimal performance, ensure your Ollama server supports concurrent requests:

1. **Update Ollama**: Ensure you're using Ollama version 0.1.0 or higher
2. **Server Resources**: Allocate sufficient CPU and memory to Ollama
3. **Model Loading**: Consider using multiple model instances for high-traffic scenarios

### Environment Variables

You can override settings via environment variables:

```bash
# Backend environment variables
OLLAMA_HOST=https://vspace.store/ollama/
OLLAMA_MODEL=qwen3:1.7b
API_KEY=your-api-key  # Optional

# Docker resource limits (in docker-compose.yml)
deploy:
  resources:
    limits:
      cpus: '2.0'      # Adjust based on your server capacity
      memory: 2G       # Adjust based on your server capacity
```

## Monitoring

### Queue Status Endpoint

Monitor the request queue status:

```bash
curl http://localhost:8080/api/queue-status
```

Response:
```json
{
  "activeRequests": 2,
  "queuedRequests": 1,
  "maxConcurrent": 4
}
```

### Frontend Queue Indicator

The frontend displays a real-time queue status indicator showing:
- Active requests vs. maximum concurrent capacity
- Number of queued requests (if any)

## Performance Tuning

### For High Traffic

1. **Increase Concurrent Requests**:
   ```javascript
   maxConcurrent: 8  // or higher based on server capacity
   ```

2. **Adjust Connection Pool**:
   ```javascript
   maxSockets: 100,        // More concurrent connections
   maxFreeSockets: 20,     // More idle connections
   ```

3. **Resource Allocation**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '4.0'       # More CPU cores
         memory: 4G        # More memory
   ```

### For Low Traffic

1. **Reduce Resource Usage**:
   ```javascript
   maxConcurrent: 2,       // Fewer concurrent requests
   maxSockets: 25,         // Fewer connections
   ```

2. **Lower Resource Limits**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 1G
   ```

## Troubleshooting

### Common Issues

1. **Requests Still Sequential**:
   - Check Ollama version (must be 0.1.0+)
   - Verify `num_parallel` parameter is being sent
   - Check server resources

2. **High Memory Usage**:
   - Reduce `num_ctx` (context window size)
   - Lower `maxConcurrent` value
   - Monitor with `docker stats`

3. **Connection Timeouts**:
   - Increase `timeout` values in config
   - Check network connectivity to Ollama server
   - Verify Ollama server is responsive

### Monitoring Commands

```bash
# Check container resource usage
docker stats chat-backend

# View backend logs
docker logs chat-backend

# Test queue status
curl http://localhost:8080/api/queue-status

# Test health endpoint
curl http://localhost:8080/api/health
```

## Testing Concurrent Requests

You can test concurrent processing using multiple browser tabs or tools like `curl`:

```bash
# Test multiple concurrent requests
for i in {1..5}; do
  curl -X POST http://localhost:8080/api/chat \
    -H "Content-Type: application/json" \
    -d '{"prompt":"Hello, this is request '$i'"}' &
done
wait
```

## Security Considerations

1. **Rate Limiting**: Configured to prevent abuse
2. **API Key**: Optional authentication for public exposure
3. **Resource Limits**: Docker containers have resource constraints
4. **Input Validation**: All inputs are validated and sanitized

## Future Improvements

1. **Load Balancing**: Multiple Ollama instances
2. **Request Prioritization**: Priority queue for different user types
3. **Auto-scaling**: Dynamic resource allocation based on load
4. **Metrics Dashboard**: Real-time performance monitoring
5. **Circuit Breaker**: Automatic fallback for failed requests
