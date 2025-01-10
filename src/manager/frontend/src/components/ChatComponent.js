import { useState } from "react";

const ChatComponent = () => {
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    setLoading(true);
    const response = await fetch("/api/container/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageHistory: messages,
        currentQuestion,
        serviceCategoryId: "yourServiceCategoryId",
        provinceId: "yourProvinceId",
      }),
    });

    if (!response.ok) {
      console.error("Error:", response.statusText);
      setLoading(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      const chunk = decoder.decode(value, { stream: true });
      // Assuming the response is JSON, you may need to parse it
      const parsedChunk = JSON.parse(chunk);
      setMessages((prevMessages) => [...prevMessages, parsedChunk]);
    }

    setLoading(false);
  };

  return (
    <div>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>{msg.content}</div>
        ))}
      </div>
      <input
        type="text"
        value={currentQuestion}
        onChange={(e) => setCurrentQuestion(e.target.value)}
      />
      <button onClick={handleSendMessage} disabled={loading}>
        {loading ? "Loading..." : "Send"}
      </button>
    </div>
  );
};

export default ChatComponent;
