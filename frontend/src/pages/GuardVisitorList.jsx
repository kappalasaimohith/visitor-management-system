import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function GuardVisitorList() {
  const [visitors, setVisitors] = useState([]);

  useEffect(() => {
    fetchVisitors();
    const sub = supabase
      .channel('visitors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, payload => {
        fetchVisitors();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchVisitors = async () => {
    const { data, error } = await supabase
      .from("visitors")
      .select(`
        *,
        host_household:households(
          flat_no,
          name
        )
      `)
      // allow guards to see pending visitors at gate along with approved/checked_in
      .in("status", ["pending", "approved", "checked_in"])
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else {
      // enrich visitors with creator display name by looking up the 'create' event
      try {
        const enriched = await Promise.all(data.map(async (v) => {
          try {
            const { data: ev } = await supabase
              .from('events')
              .select('actor_user_id, payload')
              .eq('type', 'create')
              .eq('subject_id', v.id)
              .limit(1)
              .maybeSingle();

            let creatorName = null;
            if (ev?.actor_user_id) {
              const { data: u } = await supabase.from('users').select('display_name').eq('id', ev.actor_user_id).maybeSingle();
              creatorName = u?.display_name || ev?.payload?.actorName || null;
            } else if (ev?.payload) {
              creatorName = ev.payload?.actorName || ev.payload?.actor?.displayName || null;
            }
            return { ...v, created_by_name: creatorName };
          } catch (err) {
            console.warn('enrich visitor failed', err);
            return { ...v, created_by_name: null };
          }
        }));
        setVisitors(enriched);
      } catch (err) {
        console.error('Error enriching visitors', err);
        setVisitors(data);
      }
    }
  };

  const updateVisitorStatus = async (visitorId, status) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert('Not authenticated');

    const endpoint = status === 'checked_in' ? '/api/visitors/checkin' : '/api/visitors/checkout';

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ visitorId }),
      });
      const j = await resp.json();
      if (!resp.ok) return alert(j.error || 'Failed');
      fetchVisitors();
    } catch (err) { console.error(err); alert('Network error'); }
  };

  const approveVisitor = async (visitorId) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert('Not authenticated');
    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/visitors/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ visitorId }),
      });
      const j = await resp.json();
      if (!resp.ok) return alert(j.error || 'Failed to approve');
      fetchVisitors();
    } catch (err) { console.error(err); alert('Network error'); }
  };

  const denyVisitor = async (visitorId) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert('Not authenticated');
    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/visitors/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ visitorId }),
      });
      const j = await resp.json();
      if (!resp.ok) return alert(j.error || 'Failed to deny');
      fetchVisitors();
    } catch (err) { console.error(err); alert('Network error'); }
  };

  return (
    <div>
      <h2 className="text-xl mb-2">Visitors at Gate</h2>
      {visitors.map((v) => (
        <div key={v.id} className="border p-2 mb-2 flex justify-between items-center">
          <div>
            <p><strong>{v.name}</strong> - {v.purpose}</p>
            <p>Visiting: Room {v.host_household?.flat_no} ({v.host_household?.name})</p>
            <p>Status: {v.status}</p>
            {v.created_by_name && <p className="text-sm text-gray-600">Created by: {v.created_by_name}</p>}
          </div>
          {v.status === "pending" && (
            <div className="space-x-2">
              <button
                className="bg-green-500 text-white px-2 py-1 rounded"
                onClick={() => approveVisitor(v.id)}
              >
                Approve
              </button>
              <button
                className="bg-red-500 text-white px-2 py-1 rounded"
                onClick={() => denyVisitor(v.id)}
              >
                Deny
              </button>
            </div>
          )}
          {v.status === "approved" && (
            <button
              className="bg-green-500 text-white px-2 py-1 rounded"
              onClick={() => updateVisitorStatus(v.id, "checked_in")}
            >
              Check In
            </button>
          )}
          {v.status === "checked_in" && (
            <button
              className="bg-blue-500 text-white px-2 py-1 rounded"
              onClick={() => updateVisitorStatus(v.id, "checked_out")}
            >
              Check Out
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
