import { useState, useEffect } from "react";
import { supabase, getUserProfile } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function VisitorForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [profile, setProfile] = useState(null);
  const [scheduled_time, setScheduledTime] = useState("");
  const [notifyHost, setNotifyHost] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    (async () => {
      const p = await getUserProfile();
      setProfile(p);
    })();
  }, []);

  const handleSubmit = async () => {
    if (profile?.role === 'guard') return alert('Guards cannot create visitors');
    const sessionResp = await supabase.auth.getSession();
    const accessToken = sessionResp?.data?.session?.access_token || sessionResp?.session?.access_token || null;
    if (!accessToken) return alert('Please sign in again');

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/visitors/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, phone, purpose, scheduled_time: scheduled_time ? new Date(scheduled_time).toISOString() : null }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error('Create visitor failed', text);
        return alert('Failed to create visitor');
      }

      alert('Visitor created!');
      setName('');
      setPhone('');
      setPurpose('');
      setScheduledTime('');

      if (notifyHost) {
        // notification logic here (omitted for brevity)
      }
    } catch (err) {
      console.error('API error', err);
      alert('Error creating visitor');
    }
  };

  const handleChatSend = async () => {
    if (!chatInput) return;
    const API = import.meta.env.VITE_API_URL || '';
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const userMsg = { from: 'user', text: chatInput };
    setChatMessages(m => [...m, userMsg]);
    setChatInput('');

    try {
      const resp = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: chatInput }),
      });
      const data = await resp.json().catch(() => null);
      const botText = data?.reply || data?.message || 'No response';
      setChatMessages(m => [...m, { from: 'bot', text: botText }]);
    } catch (err) {
      console.error('Chat error', err);
      setChatMessages(m => [...m, { from: 'bot', text: 'Error: could not reach chat service' }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Create Visitor Pass</h1>
            <p className="text-blue-100 text-sm">Schedule a visit or create an instant pass</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name</label>
                <input
                  placeholder="Enter name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  placeholder="Enter phone"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Visit</label>
              <input
                placeholder="e.g. Delivery, Guest, Maintenance"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time (Optional)</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                value={scheduled_time}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="notify"
                checked={notifyHost}
                onChange={(e) => setNotifyHost(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="notify" className="ml-2 block text-sm text-gray-900">
                Notify me on creation
              </label>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-50">
              <button
                onClick={() => setChatOpen(true)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center"
              >
                <span className="mr-1">✨</span> Use AI Copilot
              </button>

              <button
                onClick={handleSubmit}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition shadow-md font-medium"
              >
                Create Pass
              </button>
            </div>
          </div>
        </div>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
            <div className="bg-gray-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-semibold">AI Assistant</h3>
              <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-500 mt-20">
                  <p className="mb-2">👋 How can I help?</p>
                  <p className="text-xs">Try "Schedule a guest for tomorrow 5pm"</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'bot' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.from === 'bot'
                      ? 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-tl-none'
                      : 'bg-blue-600 text-white shadow-sm rounded-tr-none'
                    }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend(); }}
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Type a message..."
                autoFocus
              />
              <button
                onClick={handleChatSend}
                className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 transition"
              >
                ➝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
