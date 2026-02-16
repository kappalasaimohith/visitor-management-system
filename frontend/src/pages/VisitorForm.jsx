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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getUserProfile();
      setProfile(p);
    })();
  }, []);

  const toIsoFromDeviceLocalDateTime = (value) => {
    // value is from <input type="datetime-local"> => "YYYY-MM-DDTHH:mm"
    if (!value) return null;
    const [datePart, timePart] = String(value).split("T");
    if (!datePart || !timePart) return null;

    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null;

    // Construct as device-local time explicitly
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setFormError("");

    if (profile?.role === "guard") return alert("Guards cannot create visitors");
    if (!name.trim()) return setFormError("Visitor name is required.");
    if (!purpose.trim()) return setFormError("Purpose is required.");

    const sessionResp = await supabase.auth.getSession();
    const accessToken =
      sessionResp?.data?.session?.access_token || sessionResp?.session?.access_token || null;
    if (!accessToken) return alert("Please sign in again");

    setSubmitting(true);
    try {
      const API = import.meta.env.VITE_API_URL || "";
      const resp = await fetch(`${API}/api/visitors/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          purpose: purpose.trim(),
          scheduled_time: toIsoFromDeviceLocalDateTime(scheduled_time),
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Create visitor failed", text);
        setFormError("Failed to create visitor.");
        return;
      }

      setName("");
      setPhone("");
      setPurpose("");
      setScheduledTime("");
      alert("Visitor created!");
    } catch (err) {
      console.error("API error", err);
      setFormError("Error creating visitor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const API = import.meta.env.VITE_API_URL || "";
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      setChatMessages((m) => [...m, { from: "bot", text: "Please sign in again." }]);
      return;
    }

    const msgText = chatInput.trim();
    setChatMessages((m) => [...m, { from: "user", text: msgText }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const resp = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ message: msgText }),
      });
      const data = await resp.json().catch(() => null);
      const botText = data?.reply || data?.message || "No response";
      setChatMessages((m) => [...m, { from: "bot", text: botText }]);
    } catch (err) {
      console.error("Chat error", err);
      setChatMessages((m) => [...m, { from: "bot", text: "Error: could not reach chat service" }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
            <h1 className="text-xl font-semibold tracking-tight text-white">Create Visitor Pass</h1>
            <p className="text-blue-100 text-sm">Schedule a visit or create an instant pass</p>
          </div>

          <div className="p-8 space-y-6">
            {formError && (
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Visitor Name</label>
                <input
                  placeholder="Enter name"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter phone"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purpose of Visit</label>
              <input
                placeholder="e.g. Delivery, Guest, Maintenance"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Time (Optional)</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300"
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
              />
              <label htmlFor="notify" className="ml-2 block text-sm text-slate-800">
                Notify host on creation
              </label>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => setChatOpen(true)}
                className="text-blue-700 hover:text-blue-800 font-medium text-sm"
                type="button"
              >
                Use AI Copilot
              </button>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`px-6 py-2.5 rounded-lg transition font-medium ${
                  submitting ? "bg-blue-300 text-white cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                }`}
                type="button"
              >
                {submitting ? "Creating..." : "Create Pass"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px] border border-slate-200">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-semibold tracking-tight">AI Assistant</h3>
              <button onClick={() => setChatOpen(false)} className="text-slate-300 hover:text-white" type="button">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
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

            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChatSend();
                }}
                className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300"
                placeholder="Type a message..."
                autoFocus
                disabled={chatLoading}
              />
              <button
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                  chatLoading || !chatInput.trim()
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                type="button"
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
