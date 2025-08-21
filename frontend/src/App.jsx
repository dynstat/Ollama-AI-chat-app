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
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Request failed with status ${res.status}`);
      }
      setResponse(text);
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
