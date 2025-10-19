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
    // Call backend API; server auth middleware bootstraps user/household if missing
    // supabase.auth.getSession() shape can vary by client version. Be defensive.
    const sessionResp = await supabase.auth.getSession();
    const accessToken = sessionResp?.data?.session?.access_token || sessionResp?.session?.access_token || null;
    if (!accessToken) {
      console.warn('No access token present, sessionResp:', sessionResp);
      return alert('Not signed in or token expired - please sign in again');
    }

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

      let json = null;
      const text = await resp.text();
      if (text) { try { json = JSON.parse(text); } catch (_) {} }
      if (!resp.ok) {
        const msg = (json && json.error) ? json.error : `HTTP ${resp.status}`;
        console.error('Create visitor failed', msg, 'responseText:', text);
        return alert(msg || 'Failed to create visitor');
      }

      alert('Visitor created and pending approval!');
      // Optionally clear form
      setName('');
      setPhone('');
      setPurpose('');
      setScheduledTime('');

      // If notifyHost is checked, call backend notify endpoint. Don't treat failures as fatal.
      if (notifyHost) {
        (async () => {
          try {
            // If server returned created visitor id, include it; otherwise include minimal payload
            const visitorId = json?.id || null;
            await fetch(`${API}/api/notify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                type: 'visitor_created',
                visitorId,
                visitor: { name, phone, purpose, scheduled_time },
                householdId: profile?.householdId,
              }),
            });
          } catch (e) {
            // non-blocking
            console.warn('Notify call failed', e);
          }
        })();
      }
    } catch (err) {
      console.error('API error', err);
      alert('Error creating visitor');
    }
  };

  // Minimal chat send handler - posts to backend /api/chat which should proxy to Gemini
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
      const botText = data?.reply || data?.message || (await resp.text()) || 'No response';
      setChatMessages(m => [...m, { from: 'bot', text: botText }]);
    } catch (err) {
      console.error('Chat error', err);
      setChatMessages(m => [...m, { from: 'bot', text: 'Error: could not reach chat service' }]);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="p-6">
        <h1 className="text-2xl mb-4">Create Visitor</h1>
        <input
          placeholder="Name"
          className="border p-2 mb-2 w-80"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Phone"
          className="border p-2 mb-2 w-80"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          placeholder="Purpose"
          className="border p-2 mb-2 w-80"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
        <label className="block text-sm text-gray-700 mb-1">Scheduled time (optional)</label>
        <input
          type="datetime-local"
          className="border p-2 mb-2 w-80"
          value={scheduled_time}
          onChange={(e) => setScheduledTime(e.target.value)}
        />

        <label className="flex items-center mb-3">
          <input type="checkbox" checked={notifyHost} onChange={(e) => setNotifyHost(e.target.checked)} className="mr-2" />
          <span className="text-sm">Notify host on create</span>
        </label>

        <div className="mb-4">
          <button
            onClick={() => setChatOpen(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded mr-2"
          >
            Open AI Copilot
          </button>
        </div>
        {chatOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white w-full max-w-md rounded-lg p-4 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">AI Copilot</h3>
                <button onClick={() => setChatOpen(false)} className="text-sm text-gray-600">Close</button>
              </div>
              <div className="h-56 overflow-y-auto border p-2 mb-2 bg-gray-50">
                {chatMessages.length === 0 && <div className="text-sm text-gray-500">Ask the copilot to perform actions like "approve Ramesh" or "check in Mr Verma".</div>}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`mb-2 ${m.from === 'bot' ? 'text-left' : 'text-right'}`}>
                    <div className={`inline-block px-3 py-1 rounded ${m.from === 'bot' ? 'bg-gray-200 text-gray-800' : 'bg-blue-600 text-white'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend(); }}
                  className="flex-1 border p-2 mr-2"
                  placeholder="Ask Copilot..."
                />
                <button onClick={handleChatSend} className="bg-blue-600 text-white px-3 py-1 rounded">Send</button>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Create
        </button>
      </div>
    </div>
  );
}
