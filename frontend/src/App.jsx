import { useState } from "react";
import "./App.css";

function App() {
  // State for the user's prompt input
  const [prompt, setPrompt] = useState("");
  // State for the chat response
  const [response, setResponse] = useState("");
  // State for error messages
  const [error, setError] = useState("");
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(false);
  // State for selected model
  const [model, setModel] = useState("qwen:4b");

  // Sends the prompt to the backend with selected model
  const sendPrompt = async () => {
    setError("");
    setResponse("");
    setIsLoading(true);
    try {
      const urlBase = import.meta.env.VITE_BACKEND_URL || "";
      const res = await fetch(`${urlBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Request failed with status ${res.status}`);
      }

      // Stream NDJSON from the backend and append only the "response" field
      if (!res.body) {
        const text = await res.text();
        setResponse(text);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const json = JSON.parse(line);
            if (typeof json.response === "string" && json.response.length > 0) {
              setResponse(prev => prev + json.response);
            }
            if (json.done === true) {
              try { await reader.cancel(); } catch (_) { /* ignore */ }
              buffer = "";
              break;
            }
          } catch (_) {
            // Ignore malformed lines (e.g., partial JSON)
          }
        }
      }

      const last = buffer.trim();
      if (last) {
        try {
          const json = JSON.parse(last);
          if (typeof json.response === "string" && json.response.length > 0) {
            setResponse(prev => prev + json.response);
          }
        } catch (_) { /* ignore */ }
      }
    } catch (e) {
      setError(e?.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Sticky top navigation */}
      <header className="top-nav">
        <div className="brand">Ollama Chat</div>
        <div className="controls">
          <label htmlFor="model-select" className="sr-only">Model</label>
          <select
            id="model-select"
            value={model}
            onChange={e => setModel(e.target.value)}
            className="model-select"
          >
            <option value="qwen:4b">qwen:4b</option>
            <option value="gpt-oss:20b">gpt-oss:20b</option>
          </select>
        </div>
      </header>

      {/* Content area centered on large screens */}
      <main className="content-area">
        <section className="chat-card" aria-live="polite" aria-busy={isLoading}>
          <div className="response-area">
            {response ? (
              <pre>{response}</pre>
            ) : (
              <div className="placeholder">Type a prompt and press Send to start.</div>
            )}
          </div>

          {/* Composer anchored to bottom of card */}
          <div className="composer">
            <textarea
              className="chat-input"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ask anything..."
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={sendPrompt}
              disabled={isLoading || !prompt.trim()}
              aria-label="Send prompt"
            >
              {isLoading ? <span className="loader"></span> : <span>Send</span>}
            </button>
          </div>

          {error && <div className="error-msg" role="alert">{error}</div>}
        </section>
      </main>

      <footer className="chat-footer">
        <span>Local models</span>
      </footer>
    </div>
  );
}

export default App;
