import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";
import ReactMarkdown from "react-markdown";

const STRAPI_URL = "aiapi.lawvo.com";
const socket = io(STRAPI_URL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
  cors: {
    origin: "http://localhost:5173", // Replace with your frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const socketId = useRef(null);
  const messageEndRef = useRef(null);
  let currentMessageDataRef = "";
  let currentMessageRef = "";
  let currentPartialDateRef = "";

  console.log({ messages });
  function decodeUnicode(unicodeString) {
    return unicodeString;
    return unicodeString
      .replace(/\\u([\dA-F]{4})/gi, (match, grp) => {
        return String.fromCharCode(parseInt(grp, 16));
      })
      .replace(/\\n/g, ""); // Removes newline placeholders (\n) if present
  }
  // Convert the Unicode string to readable text

  // Socket.IO connection handling
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to Strapi Socket.IO");
      setConnected(true);
      socketId.current = socket.id;
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from Strapi Socket.IO");
      setConnected(false);
    });

    // Listen for chat data from the server
    socket.on("chatData", (data) => {
      const decoder = new TextDecoder();
      const chunk = decoder.decode(data, { stream: true });
      // Accumulate all chunks into currentMessageRef

      const chunks = chunk.split(/(0|8):/);
      chunks.forEach((subChunk, index) => {
        if (index === 0) return; // Skip the first chunk which is before the first delimiter
        const code = chunks[index - 1];
        const data = subChunk;
        if (code === "0") {
          currentMessageRef += decodeUnicode(JSON.parse(data));
        } else if (code === "8") {
          currentPartialDateRef += decodeUnicode(data);
        }
      });
    });

    socket.on("chatEnd", () => {
      try {
        if (currentPartialDateRef?.length > 0) {
          const partialDates = currentPartialDateRef.split("\n");
          console.log({ partialDates });
          partialDates.forEach((partialDate) => {
            try {
              currentMessageDataRef = [
                ...currentMessageDataRef,
                ...JSON.parse(partialDate),
              ];
            } catch (error) {
              console.error("Error parsing JSON:", { error, partialDate });
            }
          });
        }

        const content = currentMessageRef;
        const annotations = currentMessageDataRef;
        console.log({ content, annotations });

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content,
            annotations,
          },
        ]);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      } finally {
        // Reset current message after processing
        currentPartialDateRef = "";
        currentMessageRef = "";
        currentMessageDataRef = "";
        setLoading(false);
      }
    });

    socket.on("chatError", (error) => {
      console.error("Chat error:", error);
      setLoading(false);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("chatData");
      socket.off("chatEnd");
      socket.off("chatError");
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: inputMessage }]);
    setLoading(true);

    try {
      // Example payload - adjust according to your needs
      const payload = {
        messageHistory: messages,
        currentQuestion: inputMessage,
        serviceCategoryId: "1", // Replace with actual category ID
        provinceId: "1", // Replace with actual province ID
        socketId: socketId.current,
      };

      // Make request to Strapi chat endpoint
      const response = await fetch(`${STRAPI_URL}/api/containers/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setInputMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Chat Test App</h1>
        <div className="connection-status">
          Status: {connected ? "🟢 Connected" : "🔴 Disconnected"}
        </div>
      </header>

      <main className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.role === "user" ? "user" : "assistant"
              }`}
            >
              <strong>{msg.role === "user" ? "You" : "Assistant"}:</strong>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ))}
          {loading && <div className="loading">Assistant is typing...</div>}
          <div ref={messageEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;
