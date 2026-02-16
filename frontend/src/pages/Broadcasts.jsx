import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchBroadcasts();
    checkAdminRole();
    const sub = supabase
      .channel("broadcasts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, () => {
        fetchBroadcasts();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const checkAdminRole = async () => {
    const sessionResp = await supabase.auth.getSession();
    const token = sessionResp?.data?.session?.access_token;
    if (!token) return;

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.ok) setIsAdmin(data.user?.role === 'admin');
    } catch (err) { console.error(err); }
  };

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const sessionResp = await supabase.auth.getSession();
      const token = sessionResp?.data?.session?.access_token;
      if (!token) return;

      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/broadcasts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.ok) setBroadcasts(data.broadcasts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDeviceDate = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const title = formData.get('title');
    const message = formData.get('message');
    const isUrgent = formData.get('isUrgent') === 'on';

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/broadcasts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, message, is_urgent: isUrgent })
      });

      if (resp.ok) {
        alert('Broadcast sent!');
        e.target.reset();
        fetchBroadcasts();
      } else {
        alert('Failed to send broadcast');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Announcements</h1>
            <p className="text-sm text-slate-500 mt-1">Community updates and urgent notices.</p>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Post Announcement</h2>
            <form onSubmit={sendBroadcast} className="space-y-4">
              <div>
                <input
                  name="title"
                  placeholder="Title"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <textarea
                  name="message"
                  placeholder="Write your message here..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 h-24 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm text-gray-700">
                  <input type="checkbox" name="isUrgent" className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 rounded" />
                  Mark as Urgent
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="animate-pulse">
                  <div className="h-4 w-48 bg-slate-100 rounded" />
                  <div className="mt-3 h-3 w-full bg-slate-100 rounded" />
                  <div className="mt-2 h-3 w-5/6 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-10 text-slate-500 bg-white rounded-2xl border border-slate-200">
            No announcements yet.
          </div>
        ) : (
          <div className="space-y-4">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className={`bg-white rounded-2xl shadow-sm border p-5 ${
                  b.is_urgent ? "border-rose-200 bg-rose-50/30" : "border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start gap-4 mb-2">
                  <h3 className={`font-semibold text-lg ${b.is_urgent ? "text-rose-700" : "text-slate-900"}`}>
                    {b.title}
                  </h3>
                  <span className="text-xs text-slate-400 shrink-0">
                    {formatDeviceDate(b.created_at)}
                  </span>
                </div>

                {b.is_urgent && (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 mb-3">
                    Urgent
                  </span>
                )}

                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{b.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
