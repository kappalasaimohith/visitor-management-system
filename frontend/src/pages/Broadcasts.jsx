import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);

  useEffect(() => {
    fetchBroadcasts();
    checkAdminRole();
    const sub = supabase
      .channel('broadcasts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, payload => {
        console.log('broadcasts realtime event', payload);
        fetchBroadcasts();
      })
      .subscribe();

    const pollInterval = setInterval(() => {
      if (Date.now() - (lastUpdate || 0) > 20000) {
        console.log('broadcasts: realtime stale, polling...');
        fetchBroadcasts();
      }
    }, 15000);

    return () => { supabase.removeChannel(sub); clearInterval(pollInterval); };
  }, [lastUpdate]);

  const checkAdminRole = async () => {
    const sessionResp = await supabase.auth.getSession();
    const token = sessionResp?.data?.session?.access_token || sessionResp?.session?.access_token || null;
    if (!token) {
      console.warn('checkAdminRole: no token');
      return;
    }

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await resp.text();
      if (!resp.ok) {
        console.warn('checkAdminRole: non-ok response', resp.status, text.slice(0, 1000));
        return;
      }

      let data = null;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.warn('checkAdminRole: invalid JSON response, raw:', text.slice(0, 1000));
        return;
      }

      setIsAdmin(data.user?.role === 'admin');
    } catch (err) {
      console.error('Failed to check admin role:', err);
    }
  };

  const fetchBroadcasts = async () => {
    try {
      const sessionResp = await supabase.auth.getSession();
      const token = sessionResp?.data?.session?.access_token || sessionResp?.session?.access_token || null;
      if (!token) {
        console.warn('fetchBroadcasts: no token');
        setBroadcasts([]);
        return;
      }

      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/broadcasts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await resp.text();
      if (!resp.ok) {
        console.warn('fetchBroadcasts: non-ok response', resp.status, text.slice(0, 1000));
        setBroadcasts([]);
        return;
      }

      let data = null;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.warn('fetchBroadcasts: failed to parse JSON, raw:', text.slice(0, 1000));
        setBroadcasts([]);
        return;
      }

      setBroadcasts(data.broadcasts || []);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
    }
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

      const data = await resp.json();
      if (resp.ok) {
        alert('Broadcast sent successfully!');
        e.target.reset();
        if (data?.broadcast) setBroadcasts(b => [data.broadcast, ...b]);
        fetchBroadcasts();
        setLastUpdate(Date.now());
      } else {
        console.warn('sendBroadcast failed', data);
        alert(data.error || 'Failed to send broadcast');
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="p-6">
        <h1 className="text-2xl mb-4">Society Broadcasts</h1>
        
        {isAdmin && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">Send Broadcast (Admin Only)</h2>
            <form onSubmit={sendBroadcast} className="space-y-3">
              <input
                name="title"
                placeholder="Broadcast Title"
                className="w-full border p-2 rounded"
                required
              />
              <textarea
                name="message"
                placeholder="Broadcast Message"
                className="w-full border p-2 rounded h-20"
                required
              />
              <label className="flex items-center">
                <input type="checkbox" name="isUrgent" className="mr-2" />
                Mark as urgent
              </label>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Broadcast'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Broadcasts</h2>
          {broadcasts.length === 0 ? (
            <p className="text-gray-500">No broadcasts yet</p>
          ) : (
            broadcasts.map((broadcast) => (
              <div key={broadcast.id} className={`border p-4 rounded ${
                broadcast.is_urgent ? 'border-red-500 bg-red-50' : 'border-gray-200'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`font-semibold ${broadcast.is_urgent ? 'text-red-700' : ''}`}>
                      {broadcast.is_urgent ? '🚨 ' : '📢 '}{broadcast.title}
                    </h3>
                    <p className="text-gray-700 mt-1">{broadcast.message}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(broadcast.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
