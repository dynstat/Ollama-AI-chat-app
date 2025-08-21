import { useState } from "react";

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendPrompt = async () => {
    setError("");
    setResponse("");
    setIsLoading(true);
    try {
      const urlBase = import.meta.env.VITE_BACKEND_URL || ""; // use proxy if empty
      const res = await fetch(`${urlBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Request failed with status ${res.status}`);
      }

      // Stream NDJSON from the backend and append only the "response" field
      if (!res.body) {
        // Fallback: no streaming support
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

        // Process complete lines; keep partial in buffer
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
              // Drain any remaining bytes and exit
              try { await reader.cancel(); } catch (_) { /* ignore */ }
              buffer = "";
              break;
            }
          } catch (parseErr) {
            // Ignore malformed lines (e.g., partial JSON)
          }
        }
      }

      // Attempt to parse any trailing buffered line
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
    <div style={{ padding: "20px" }}>
      <h1>Ollama Chat</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: "100%", height: "100px" }}
      />
      <br />
      <button onClick={sendPrompt} disabled={isLoading || !prompt.trim()}>
        {isLoading ? "Sending..." : "Send"}
      </button>
      {error && (
        <pre style={{ color: "#b00020" }}>{error}</pre>
      )}
      {response && (
        <pre>{response}</pre>
      )}
    </div>
  );
}

export default App;
