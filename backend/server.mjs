import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// Configuration via environment variables with safe defaults
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://host.docker.internal:11434";
// Default to a smaller model to reduce upstream errors on constrained hosts
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen:4b";
const PORT = Number(process.env.PORT || 3001);

// Whitelist of allowed models for safety; extend as needed
const ALLOWED_MODELS = new Set(["qwen:4b", "gpt-oss:20b"]);

// Health endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Forward request to Ollama running on host (or configured host)
app.post("/chat", async (req, res) => {
  try {
    const { prompt, model } = req.body ?? {};
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "'prompt' must be a non-empty string" });
    }

    // Choose model from request when valid, otherwise fall back to default
    const requestedModel = typeof model === "string" ? model.trim() : "";
    const effectiveModel = ALLOWED_MODELS.has(requestedModel) ? requestedModel : OLLAMA_MODEL;

    const response = await axios.post(
      `${OLLAMA_HOST}/api/generate`,
      { model: effectiveModel, prompt },
      { responseType: "stream", timeout: 300000 }
    );

    // Stream Ollama’s response back to the client
    response.data.pipe(res);
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

    return res.status(status).json({ error: "Error connecting to Ollama", details: message });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
