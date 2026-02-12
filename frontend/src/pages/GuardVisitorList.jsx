import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function GuardVisitorList() {
  const [visitors, setVisitors] = useState([]);

  useEffect(() => {
    fetchVisitors();
    const sub = supabase
      .channel('visitors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, () => {
        fetchVisitors();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchVisitors = async () => {
    const { data, error } = await supabase
      .from("visitors")
      .select(`*, host_household:households(flat_no, name)`)
      .in("status", ["pending", "approved", "checked_in"])
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else {
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
              creatorName = u?.display_name;
            } else if (ev?.payload) {
              creatorName = ev.payload?.actorName || ev.payload?.actor?.displayName;
            }
            return { ...v, created_by_name: creatorName };
          } catch (err) {
            return { ...v, created_by_name: null };
          }
        }));
        setVisitors(enriched);
      } catch (err) {
        setVisitors(data);
      }
    }
  };

  const updateStatus = async (visitorId, action) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert('Not authenticated');

    const endpoints = {
      approve: '/api/visitors/approve',
      deny: '/api/visitors/deny',
      checkin: '/api/visitors/checkin',
      checkout: '/api/visitors/checkout'
    };

    const body = action === 'deny' ? { visitorId, reason: 'Denied at gate' } : { visitorId };

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}${endpoints[action]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return alert('Failed to update status');
      fetchVisitors();
    } catch (err) { console.error(err); alert('Network error'); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Gate Control</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visitors.map((v) => (
            <div key={v.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{v.name}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide mt-1 ${v.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      v.status === 'approved' ? 'bg-green-100 text-green-800' :
                        v.status === 'checked_in' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                    {v.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-700">{v.host_household?.flat_no}</div>
                  <div className="text-xs text-gray-400">Flat No</div>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-1 mb-4">
                <p><span className="font-medium text-gray-500">Purpose:</span> {v.purpose}</p>
                <p><span className="font-medium text-gray-500">Host:</span> {v.host_household?.name}</p>
                {v.created_by_name && <p><span className="font-medium text-gray-500">Created by:</span> {v.created_by_name}</p>}
                <p className="text-xs text-gray-400 pt-2">{new Date(v.created_at).toLocaleString()}</p>
              </div>

              <div className="mt-auto pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
                {v.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(v.id, "approve")} className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition">Approve</button>
                    <button onClick={() => updateStatus(v.id, "deny")} className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium transition">Deny</button>
                  </>
                )}
                {v.status === "approved" && (
                  <button onClick={() => updateStatus(v.id, "checkin")} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition">Check In</button>
                )}
                {v.status === "checked_in" && (
                  <button onClick={() => updateStatus(v.id, "checkout")} className="col-span-2 bg-gray-800 hover:bg-gray-900 text-white py-2 rounded-lg text-sm font-medium transition">Check Out</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
