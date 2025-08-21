import { useState } from "react";

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  const sendPrompt = async () => {
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    setResponse(await res.text());
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Ollama Chat (via host)</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: "100%", height: "100px" }}
      />
      <br />
      <button onClick={sendPrompt}>Send</button>
      <pre>{response}</pre>
    </div>
  );
}

export default App;
