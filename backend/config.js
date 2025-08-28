// Ollama Configuration for Concurrent Processing
export const OLLAMA_CONFIG = {
    // Model configuration
    num_ctx: 4096,           // Context window size
    num_thread: 4,           // Number of threads for parallel processing
    num_gpu: 1,              // Number of GPU layers (if available)
    num_parallel: 4,         // Number of parallel requests (Ollama 0.1.0+)

    // Sampling parameters
    temperature: 0.7,        // Sampling temperature
    top_p: 0.9,              // Top-p sampling
    repeat_penalty: 1.1,     // Repeat penalty
    seed: -1,                // Random seed (-1 for random)

    // Performance settings
    num_batch: 512,          // Batch size for prompt processing
    num_keep: 0,             // Number of tokens to keep from initial prompt
    tfs_z: 1.0,              // Tail free sampling
    typical_p: 1.0,          // Typical sampling
    mirostat: 0,             // Mirostat sampling algorithm
    mirostat_tau: 5.0,       // Mirostat target entropy
    mirostat_eta: 0.1,       // Mirostat learning rate
};

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

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
    windowMs: 60 * 1000,     // 1 minute window
    max: 60,                 // Maximum 60 requests per window
    standardHeaders: true,   // Return rate limit info in headers
    legacyHeaders: false,    // Disable legacy headers
};
