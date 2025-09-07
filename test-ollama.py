import requests
from prompt_toolkit import PromptSession
from prompt_toolkit.history import InMemoryHistory
import json

# Ollama endpoint (replace if needed)
OLLAMA_URL = "https://vspace.store/ollama/api/chat"

# Model you want to chat with
MODEL = "qwen2:1.5b"  # try also "gpt-oss20b", "deepspek-r1:7b"


def chat_with_ollama(messages):
    """
    Sends a chat request to the Ollama API and streams the model response.
    """
    payload = {"model": MODEL, "messages": messages, "stream": True}

    try:
        with requests.post(OLLAMA_URL, json=payload, stream=True, timeout=300) as resp:
            resp.raise_for_status()
            reply_content = ""

            for line in resp.iter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line.decode("utf-8"))
                except Exception as e:
                    return f"[JSON Error] {e}: {line}"

                # Each line has "message" or "done"
                if "message" in data:
                    delta = data["message"]["content"]
                    print(delta, end="", flush=True)  # live stream
                    reply_content += delta
                elif data.get("done"):
                    break

            print()  # newline after model finishes
            return reply_content
    except Exception as e:
        return f"[Error] {e}"


def main():
    print("=== Ollama Chat TUI ===")
    print(f"Connected to: {OLLAMA_URL}, using model: {MODEL}")
    print("Type 'exit' to quit.\n")

    # Conversation history to maintain context
    messages = []
    session = PromptSession(history=InMemoryHistory())

    while True:
        user_input = session.prompt("You: ")

        if user_input.lower() in {"exit", "quit"}:
            break

        # Append user message
        messages.append({"role": "user", "content": user_input})

        # Get response from Ollama
        print("Ollama: ", end="", flush=True)
        reply = chat_with_ollama(messages)

        # Append assistant message
        messages.append({"role": "assistant", "content": reply})


if __name__ == "__main__":
    main()
