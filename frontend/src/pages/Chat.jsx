import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { supabase } from "../supabaseClient";

const apiurl = import.meta.env.VITE_API_URL || '';

export default function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchVisitors();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchVisitors = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const resp = await fetch(`${apiurl}/api/visitors`, {
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

    const userMsg = { from: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    const userInput = input;
    setInput("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const visitorContext = visitors.length > 0
        ? `\n\nCurrent visitors:\n${visitors.map(v => `- ${v.name} (${v.status}) - ID: ${v.id}`).join('\n')}`
        : '\n\nNo visitors found.';

      const fullMessage = userInput + visitorContext;

      const res = await axios.post(`${apiurl}/api/chat`,
        { message: fullMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const botText = res.data.reply || res.data.result || res.data.message || 'Done';
      setMessages((m) => [...m, { from: 'bot', text: botText }]);

      if (res.data.result) {
        setTimeout(fetchVisitors, 1000);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err?.response?.data?.error || err.message || 'Could not reach AI service';
      setMessages((m) => [...m, { from: 'bot', text: `Error: ${errorMsg}` }]);
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
    <div className="h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <Navbar />

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col h-[calc(100vh-64px)]">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">

          <div className="bg-white border-b border-gray-100 p-4">
            <h1 className="text-lg font-bold text-gray-800">AI Copilot</h1>
            <p className="text-xs text-gray-500">Assistant enables you to manage visitors via natural language</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/60">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <div className="inline-block p-4 bg-blue-50 rounded-full mb-4">
                  <span className="text-2xl">🤖</span>
                </div>
                <h3 className="text-gray-900 font-medium mb-2">How can I help you today?</h3>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Try "Check in John"</p>
                  <p>Try "Create a pass for Sarah tomorrow"</p>
                </div>

                {visitors.length > 0 && (
                  <div className="mt-8 text-left max-w-xs mx-auto bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Active Visitors</p>
                    {visitors.slice(0, 3).map(v => (
                      <div key={v.id} className="text-sm text-gray-600 py-1 border-b border-gray-50 last:border-0">
                        {v.name} <span className="text-xs text-gray-400">({v.status})</span>
                      </div>
                    ))}
                    {visitors.length > 3 && <p className="text-xs text-gray-400 mt-2">+ {visitors.length - 3} more</p>}
                  </div>
                )}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm text-sm leading-relaxed ${m.from === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                  }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl px-5 py-3 shadow-sm text-sm bg-white border border-slate-200 text-slate-700">
                  Thinking...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-100">
            <div className="relative flex items-center">
              <input
                className="w-full bg-gray-100 border-0 rounded-full pl-5 pr-12 py-3 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-sm"
                placeholder="Type your command..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                className={`absolute right-2 p-2 rounded-full transition-colors ${loading || !input.trim() ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  }`}
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              AI can make mistakes. Please verify important actions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
