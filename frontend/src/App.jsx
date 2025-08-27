import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

// LocalStorage key for persisting conversations across sessions
const STORAGE_KEY = "ollama-chat-conversations-v1";

// Generate a compact unique id for chats/messages
const generateId = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function App() {
  // Model selection state
  const [model, setModel] = useState("qwen2:1.5b");

  // Input composer state
  const [prompt, setPrompt] = useState("");

  // Request/stream control and error state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const abortControllerRef = useRef(null);
  const readerRef = useRef(null);
  const activeRequestIdRef = useRef("");

  // Conversations state: list and selection
  const [conversations, setConversations] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [currentConversationId, setCurrentConversationId] = useState(() => conversations[0]?.id || "");

  // Derived: current conversation selected
  const currentConversation = useMemo(() => {
    return conversations.find(c => c.id === currentConversationId) || null;
  }, [conversations, currentConversationId]);

  // Persist conversations to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // ignore storage errors
    }
  }, [conversations]);

  // Ensure a conversation exists on first load
  useEffect(() => {
    if (!currentConversation) {
      handleCreateNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom on new messages
  const scrollAnchorRef = useRef(null);
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [currentConversation?.messages?.length]);

  // Create a new chat conversation
  const handleCreateNewChat = () => {
    const newChatId = generateId("chat");
    const newConversation = {
      id: newChatId,
      title: "New chat",
      createdAt: Date.now(),
      messages: [],
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newChatId);
    setPrompt("");
    setError("");
  };

  // Select an existing conversation
  const handleSelectConversation = (chatId) => {
    if (isLoading) return; // avoid switching while streaming
    setCurrentConversationId(chatId);
    setError("");
  };

  // Build contextual prompt from conversation history
  const buildContextualPrompt = (userPrompt) => {
    const history = (currentConversation?.messages || [])
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
    const contextPrefix = history ? history + "\n" : "";
    return `${contextPrefix}User: ${userPrompt}\nAssistant:`;
  };

  // Send prompt and stream response, supporting abort/stop
  const sendPrompt = async () => {
    if (!prompt.trim() || !currentConversation) return;
    setError("");
    setIsLoading(true);

    // If a previous stream is active, abort and cancel its reader first
    try {
      abortControllerRef.current?.abort();
    } catch { /* ignore */ }
    try {
      await readerRef.current?.cancel?.();
    } catch { /* ignore */ }
    readerRef.current = null;

    // Create new message entries (user + placeholder assistant)
    const userMessageId = generateId("msg");
    const assistantMessageId = generateId("msg");
    const userMessage = { id: userMessageId, role: "user", content: prompt.trim(), createdAt: Date.now() };
    const assistantMessage = { id: assistantMessageId, role: "assistant", content: "", createdAt: Date.now() };

    // Update conversation with new messages and title if needed
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversation.id) return conv;
      const updated = { ...conv };
      if (!updated.title || updated.title === "New chat") {
        const titleBase = prompt.trim().slice(0, 60);
        updated.title = titleBase || "New chat";
      }
      updated.messages = [...(updated.messages || []), userMessage, assistantMessage];
      return updated;
    }));

    // Prepare streaming request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = generateId("req");
    activeRequestIdRef.current = requestId;

    try {
      const urlBase = import.meta.env.VITE_BACKEND_URL || "/api";
      const fullPrompt = buildContextualPrompt(prompt.trim());
      setPrompt("");

      const res = await fetch(`${urlBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, model }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Request failed with status ${res.status}`);
      }

      // If server did not stream, read as text and set
      if (!res.body) {
        const text = await res.text();
        appendToAssistant(assistantMessageId, text);
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // If a new request started, stop processing this one
        if (activeRequestIdRef.current !== requestId) {
          try { await reader.cancel(); } catch { /* ignore */ }
          break;
        }
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
              appendToAssistant(assistantMessageId, json.response);
            }
            if (json.done === true) {
              try { await reader.cancel(); } catch { /* ignore */ }
              buffer = "";
              break;
            }
          } catch {
            // Ignore malformed lines (e.g., partial JSON)
          }
        }
      }

      const last = buffer.trim();
      if (last) {
        try {
          const json = JSON.parse(last);
          if (typeof json.response === "string" && json.response.length > 0) {
            appendToAssistant(assistantMessageId, json.response);
          }
        } catch { /* ignore */ }
      }
    } catch (e) {
      if (e?.name === "AbortError") {
        // Stopped by user; not an error
      } else {
        setError(e?.message || "Unknown error");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      readerRef.current = null;
      // Clear activeRequestId only if it belongs to this invocation
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = "";
      }
    }
  };

  // Append chunk text to the assistant message by id
  const appendToAssistant = (assistantMessageId, textChunk) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversationId) return conv;
      const updated = { ...conv };
      updated.messages = (updated.messages || []).map(m => {
        if (m.id !== assistantMessageId) return m;
        return { ...m, content: (m.content || "") + textChunk };
      });
      return updated;
    }));
  };

  // Stop the current streaming response
  const handleStop = () => {
    try { abortControllerRef.current?.abort(); } catch { /* ignore */ }
    try { readerRef.current?.cancel?.(); } catch { /* ignore */ }
    readerRef.current = null;
    activeRequestIdRef.current = "";
    setIsLoading(false);
  };

  // Send on Enter, newline on Shift+Enter
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && prompt.trim()) {
        sendPrompt();
      }
    }
  };

  return (
    <div className="app-shell">
      {/* Sticky top navigation */}
      <header className="top-nav">
        <div className="brand">Ollama Chat</div>
        <div className="controls">
          <button className="new-chat-btn" onClick={handleCreateNewChat} aria-label="Start new chat">+ New chat</button>
          <label htmlFor="model-select" className="sr-only">Model</label>
          <select
            id="model-select"
            value={model}
            onChange={e => setModel(e.target.value)}
            className="model-select"
          >
            <option value="qwen2:1.5b">qwen2:1.5b</option>
            <option value="qwen2:7b">qwen2:7b</option>
            <option value="codegemma:2b">codegemma:2b</option>
            <option value="codegemma:7b">codegemma:7b</option>
            <option value="deepseek-r1:7b">deepseek-r1:7b</option>
            <option value="gpt-oss:20b">gpt-oss:20b</option>
          </select>
        </div>
      </header>

      {/* Two-column layout: sidebar + chat */}
      <main className="content-area">
        <div className="layout">
          {/* Sidebar with conversation list */}
          <aside className="sidebar" aria-label="Conversations">
            <div className="sidebar-header">Conversations</div>
            <div className="chat-list">
              {conversations.length === 0 && (
                <div className="chat-list-empty">No chats yet</div>
              )}
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  className={`chat-item ${conv.id === currentConversationId ? "active" : ""}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="chat-item-title">{conv.title || "Untitled"}</div>
                  <div className="chat-item-sub">{new Date(conv.createdAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* Chat panel */}
          <section className="chat-card" aria-live="polite" aria-busy={isLoading}>
            <div className="messages" role="log">
              {currentConversation?.messages?.length ? (
                currentConversation.messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.role}`}>
                    <div className="avatar" aria-hidden="true">{msg.role === "user" ? "🧑" : "🤖"}</div>
                    <div className="bubble">
                      {msg.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="placeholder">Start a conversation by typing below. Shift+Enter for newline.</div>
              )}
              <div ref={scrollAnchorRef} />
            </div>

            {/* Composer anchored to bottom of card */}
            <div className="composer">
              <textarea
                className="chat-input"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={false}
              />
              <button
                className={`send-btn ${isLoading ? "stop" : ""}`}
                onClick={isLoading ? handleStop : sendPrompt}
                disabled={!isLoading && !prompt.trim()}
                aria-label={isLoading ? "Stop generating" : "Send prompt"}
              >
                {isLoading ? (
                  <span className="loader"></span>
                ) : (
                  <span>Send</span>
                )}
              </button>
            </div>

            {error && <div className="error-msg" role="alert">{error}</div>}
          </section>
        </div>
      </main>

      <footer className="chat-footer">
        <span>Local models</span>
      </footer>
    </div>
  );
}

export default App;
