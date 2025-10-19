import { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { supabase } from "../supabaseClient";

export default function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVisitors();
  }, []);

  const fetchVisitors = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const resp = await fetch('/api/visitors', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await resp.json();
      if (resp.ok) {
        setVisitors(data.visitors || []);
      }
    } catch (err) {
      console.error('Failed to fetch visitors:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    const userMsg = { from: 'user', text: input };
    setMessages(m => [...m, userMsg]);
    const userInput = input;
    setInput('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      // Include visitor context in the message
      const visitorContext = visitors.length > 0 
        ? `\n\nCurrent visitors:\n${visitors.map(v => `- ${v.name} (${v.status}) - ID: ${v.id}`).join('\n')}`
        : '\n\nNo visitors found.';
      
      const fullMessage = userInput + visitorContext;
      
      const res = await axios.post('/api/chat', 
        { message: fullMessage }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const botText = res.data.reply || res.data.result || res.data.message || 'Done';
      setMessages(m => [...m, { from: 'bot', text: botText }]);
      
      // Refresh visitors after action
      if (res.data.result) {
        setTimeout(fetchVisitors, 1000);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err?.response?.data?.error || err.message || 'Could not reach AI service';
      setMessages(m => [...m, { from: 'bot', text: `Error: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div>
      <Navbar />
      <div className="p-6">
        <h1 className="text-2xl mb-4">AI Copilot</h1>
        <div className="border rounded-lg p-4 bg-gray-50 mb-4 h-96 overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-gray-500 text-sm">
              <div>Try "approve [visitor name]", "check in [visitor name]", "check out [visitor name]"</div>
              <div className="mt-1 text-xs">Multi-step: "create guest pass for John - gym - Friday 6pm to 8pm"</div>
              <div className="mt-1 text-xs">Admin: "broadcast: Water maintenance tomorrow 9am"</div>
              {visitors.length > 0 && (
                <div className="mt-2 text-xs">
                  <div className="font-semibold">Available visitors:</div>
                  {visitors.map(v => (
                    <div key={v.id}>• {v.name} ({v.status})</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 ${m.from === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block px-3 py-2 rounded-lg ${
                m.from === 'user' ? 'bg-blue-600 text-white' : 'bg-white border'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded p-2"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? "Processing..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
