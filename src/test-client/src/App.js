import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const STRAPI_URL = 'http://localhost:1338';
const socket = io(STRAPI_URL, {
  withCredentials: true,
});

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const socketId = useRef(null);
  const messageEndRef = useRef(null);

  // Socket.IO connection handling
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to Strapi Socket.IO');
      setConnected(true);
      socketId.current = socket.id;
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Strapi Socket.IO');
      setConnected(false);
    });

    // Listen for chat data from the server
    socket.on('chatData', (data) => {
      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    });

    socket.on('chatEnd', () => {
      setLoading(false);
    });

    socket.on('chatError', (error) => {
      console.error('Chat error:', error);
      setLoading(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('chatData');
      socket.off('chatEnd');
      socket.off('chatError');
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: inputMessage }]);
    setLoading(true);

    try {
      // Example payload - adjust according to your needs
      const payload = {
        messageHistory: messages,
        currentQuestion: inputMessage,
        serviceCategoryId: 'test-category',  // Replace with actual category ID
        provinceId: 'test-province',         // Replace with actual province ID
        socketId: socketId.current
      };

      // Make request to Strapi chat endpoint
      const response = await fetch(`${STRAPI_URL}/api/container/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Chat Test App</h1>
        <div className="connection-status">
          Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <main className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
            >
              <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
              <p>{msg.content}</p>
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