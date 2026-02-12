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
      .channel('broadcasts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, () => {
        fetchBroadcasts();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
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
    } catch (err) { console.error(err); }
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Announcements</h1>

        {isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
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

        <div className="space-y-4">
          {broadcasts.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">
              No announcements yet.
            </div>
          ) : (
            broadcasts.map((b) => (
              <div key={b.id} className={`bg-white rounded-xl shadow-sm border border-l-4 p-5 ${b.is_urgent ? 'border-l-red-500 border-gray-200 bg-red-50/10' : 'border-l-blue-500 border-gray-200'
                }`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-bold text-lg ${b.is_urgent ? 'text-red-700' : 'text-gray-900'}`}>
                    {b.is_urgent && '🚨 '}{b.title}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{b.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
