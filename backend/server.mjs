import express from "express";
import cors from "cors";
import axios from "axios";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { collectDefaultMetrics, Registry } from "prom-client";
import { OLLAMA_CONFIG, QUEUE_CONFIG, POOL_CONFIG, RATE_LIMIT_CONFIG } from "./config.js";
import http from "http";
import https from "https";

// Create axios instance with connection pooling for better concurrent performance
const ollamaClient = axios.create({
  baseURL: process.env.OLLAMA_HOST || "https://vspace.store/ollama",
  timeout: QUEUE_CONFIG.timeout,
  maxRedirects: 5,
  // Connection pooling settings
  httpAgent: new http.Agent({
    keepAlive: POOL_CONFIG.keepAlive,
    keepAliveMsecs: POOL_CONFIG.keepAliveMsecs,
    maxSockets: POOL_CONFIG.maxSockets,
    maxFreeSockets: POOL_CONFIG.maxFreeSockets,
    timeout: POOL_CONFIG.timeout,
  }),
  httpsAgent: new https.Agent({
    keepAlive: POOL_CONFIG.keepAlive,
    keepAliveMsecs: POOL_CONFIG.keepAliveMsecs,
    maxSockets: POOL_CONFIG.maxSockets,
    maxFreeSockets: POOL_CONFIG.maxFreeSockets,
    timeout: POOL_CONFIG.timeout,
  }),
});

const app = express();
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// Conditionally enable CORS only when ALLOWED_ORIGINS is provided
const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS || "";
const ALLOWED_ORIGINS_LIST = ALLOWED_ORIGINS_ENV
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);
if (ALLOWED_ORIGINS_LIST.length > 0) {
  app.use(
    cors({
      origin: ALLOWED_ORIGINS_LIST,
      credentials: false,
    })
  );
}

// Parse JSON with a safe limit
app.use(express.json({ limit: "1mb" }));

// Request logging
app.use(morgan("combined"));

// Basic rate limiting to protect upstream resources
const limiter = rateLimit(RATE_LIMIT_CONFIG);
app.use(limiter);

// Configuration via environment variables with safe defaults
// Normalize to avoid double slashes when composing URLs
const OLLAMA_BASE = (process.env.OLLAMA_HOST || "https://vspace.store/ollama").replace(/\/+$/, "");
// Default to a smaller model to reduce upstream errors on constrained hosts
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:1.7b";
const PORT = Number(process.env.PORT || 3001);



// Whitelist of allowed models for safety; extend as needed
const ALLOWED_MODELS = new Set(["qwen3:1.7b", "qwen3:8b", "qwen2:1.5b", "codegemma:2b", "codegemma:7b", "deepseek-r1:7b", "gpt-oss:20b"]);

// Metrics setup
const register = new Registry();
collectDefaultMetrics({ register });

// Request queue management for concurrent processing
class RequestQueue {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.activeRequests = 0;
    this.queue = [];
  }

  async execute(fn) {
    return new Promise((resolve, reject) => {
      const task = { fn, resolve, reject };

      if (this.activeRequests < this.maxConcurrent) {
        this.executeTask(task);
      } else {
        this.queue.push(task);
      }
    });
  }

  async executeTask(task) {
    this.activeRequests++;
    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.activeRequests--;
      if (this.queue.length > 0) {
        const nextTask = this.queue.shift();
        this.executeTask(nextTask);
      }
    }
  }

  getStatus() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}

const requestQueue = new RequestQueue(QUEUE_CONFIG.maxConcurrent);

// Health and readiness endpoints
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.get("/ready", async (_req, res) => {
  try {
    // Shallow check to confirm Ollama is reachable
    await ollamaClient.get("/api/tags", { timeout: 2000 });
    res.status(200).json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});
app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).json({ error: "metrics_unavailable", details: err?.message || String(err) });
  }
});

// Queue status endpoint
app.get("/queue-status", (_req, res) => {
  res.json(requestQueue.getStatus());
});

// Forward request to Ollama running on host (or configured host)
// Optional API key guard for public exposure
const API_KEY = process.env.API_KEY || "";
function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const presented = req.header("x-api-key");
  if (presented && presented === API_KEY) return next();
  return res.status(401).json({ error: "unauthorized" });
}

app.post("/chat", requireApiKey, async (req, res) => {
  // Abort upstream if client disconnects
  const abortController = new AbortController();
  let upstreamStream = null;

  function handleClientGone() {
    try { abortController.abort(); } catch { /* ignore */ }
    try { upstreamStream?.destroy?.(); } catch { /* ignore */ }
  }
  req.on("aborted", handleClientGone);
  req.on("close", handleClientGone);
  res.on("close", handleClientGone);

  try {
    const { prompt, model } = req.body ?? {};
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "'prompt' must be a non-empty string" });
    }

    // Choose model from request when valid, otherwise fall back to default
    const requestedModel = typeof model === "string" ? model.trim() : "";
    const effectiveModel = ALLOWED_MODELS.has(requestedModel) ? requestedModel : OLLAMA_MODEL;

    // Execute request through queue for better concurrent handling
    const response = await requestQueue.execute(async () => {
      return await ollamaClient.post(
        "/api/generate",
        {
          model: effectiveModel,
          prompt,
          ...OLLAMA_CONFIG  // Include concurrent processing configuration
        },
        { responseType: "stream", signal: abortController.signal }
      );
    });

    // Stream Ollama’s response back to the client
    upstreamStream = response.data;
    upstreamStream.pipe(res);
  } catch (err) {
    const message = err?.message || "Unknown error";
    const status = err?.response?.status || 500;
    const hasUpstreamData = Boolean(err?.response?.data);
    console.error(`Chat request failed: ${message}${hasUpstreamData ? " (upstream error)" : ""}`);

    // If upstream provided a textual body, forward it
    if (typeof err?.response?.data === "string") {
      return res.status(status).send(err.response.data);
    }

    // If upstream provided a stream, buffer it to return meaningful details
    if (err?.response?.data && typeof err.response.data.pipe === "function") {
      try {
        let body = "";
        for await (const chunk of err.response.data) {
          body += chunk.toString();
        }
        if (body) {
          return res.status(status).send(body);
        }
      } catch (streamErr) {
        console.error(`Failed to read upstream error stream: ${streamErr?.message || streamErr}`);
      }
    }

    if (!res.headersSent) {
      return res.status(status).json({ error: "Error connecting to Ollama", details: message });
    }
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
