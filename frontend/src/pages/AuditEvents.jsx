import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function AuditEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchEvents();
    const sub = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchEvents = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/events`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await resp.json();
      if (!resp.ok) return console.error(j);
      
      const raw = j.events || [];
      const actorIds = [...new Set(raw.map(r => r.actor_user_id).filter(Boolean))];
      const subjectIds = [...new Set(raw.map(r => r.subject_id).filter(Boolean))];

      const usersRes = actorIds.length ? await supabase.from('users').select('id, display_name').in('id', actorIds) : { data: [] };
      const visitorsRes = subjectIds.length ? await supabase.from('visitors').select('id, name').in('id', subjectIds) : { data: [] };

      const usersMap = Object.fromEntries((usersRes.data || []).map(u => [u.id, u.display_name]));
      const visitorsMap = Object.fromEntries((visitorsRes.data || []).map(v => [v.id, v.name]));

      const enriched = raw.map((e) => ({
        ...e,
        actorName: (e.actor_user_id && usersMap[e.actor_user_id]) || e.payload?.actorName || 'System',
        visitorName: (e.subject_id && visitorsMap[e.subject_id]) || e.payload?.visitor?.name || '—'
      }));

      setEvents(enriched);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                         {e.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                       {e.actorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                       {e.visitorName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                       <div className="max-w-xs truncate" title={JSON.stringify(e.payload)}>
                          {e.payload?.note || e.payload?.reason || '-'}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
