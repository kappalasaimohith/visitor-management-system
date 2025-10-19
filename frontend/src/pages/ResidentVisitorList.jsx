import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ResidentVisitorList() {
  const [visitors, setVisitors] = useState([]);
  const [householdId, setHouseholdId] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return;
      const { data: userRow } = await supabase.from('users').select('household_id').eq('id', uid).maybeSingle();
      if (userRow?.household_id) setHouseholdId(userRow.household_id);
      fetchVisitors(userRow?.household_id);
    };
    init();
    const sub = supabase
      .channel('visitors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, payload => {
        fetchVisitors(householdId);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [householdId]);

  const fetchVisitors = async (hhId) => {
    const { data, error } = await supabase
      .from("visitors")
      .select("*")
      .eq("host_household_id", hhId)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else setVisitors(data);
  };

  const deleteVisitor = async (visitorId) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert('Not authenticated');

    try {
      const resp = await fetch('/api/visitors/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ visitorId }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) return alert(j.error || 'Failed to delete');
      fetchVisitors(householdId);
    } catch (err) { console.error(err); alert('Network error'); }
  };

  const updateVisitorStatus = async (visitorId, status) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert('Not authenticated');

    const endpoint = status === 'approved' ? '/api/visitors/approve' : '/api/visitors/deny';
    const body = status === 'approved' ? { visitorId } : { visitorId, reason: 'Denied via app' };

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await resp.json();
      if (!resp.ok) return alert(j.error || 'Failed');
      fetchVisitors();
    } catch (err) { console.error(err); alert('Network error'); }
  };

  return (
    <div>
      <h2 className="text-xl mb-2">My Visitors</h2>
      {visitors.map((v) => (
        <div key={v.id} className="border p-2 mb-2 flex justify-between items-center">
          <div>
            <p><strong>{v.name}</strong> - {v.purpose}</p>
            <p>Status: {v.status}</p>
          </div>
          {v.status === "pending" && (
            <div className="space-x-2">
              <button
                className="bg-green-500 text-white px-2 py-1 rounded"
                onClick={() => updateVisitorStatus(v.id, "approved")}
              >
                Approve
              </button>
              <button
                className="bg-red-500 text-white px-2 py-1 rounded"
                onClick={() => updateVisitorStatus(v.id, "denied")}
              >
                Deny
              </button>
              <button
                className="bg-gray-600 text-white px-2 py-1 rounded"
                onClick={() => deleteVisitor(v.id)}
              >
                Delete
              </button>
            </div>
          )}
          {v.status === "denied" && (
            <div>
              <button
                className="bg-gray-600 text-white px-2 py-1 rounded"
                onClick={() => deleteVisitor(v.id)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
