import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function AuditEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchEvents();
    const sub = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
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

      // Batch resolve actor display names and visitor subjects
      const actorIds = [...new Set(raw.map(r => r.actor_user_id).filter(Boolean))];
      const subjectIds = [...new Set(raw.map(r => r.subject_id).filter(Boolean))];

      const usersRes = actorIds.length ? await supabase.from('users').select('id, display_name').in('id', actorIds) : { data: [] };
      const visitorsRes = subjectIds.length ? await supabase.from('visitors').select('id, name, purpose').in('id', subjectIds) : { data: [] };

      const users = usersRes?.data || [];
      const visitors = visitorsRes?.data || [];
      const usersMap = Object.fromEntries(users.map(u => [u.id, u.display_name]));
      const visitorsMap = Object.fromEntries(visitors.map(v => [v.id, v]));

      const enriched = raw.map((e) => {
        const actorName = (e.actor_user_id && usersMap[e.actor_user_id]) || e.payload?.actorName || e.payload?.actor?.display_name || 'Unknown';
        const visitorRecord = e.subject_id ? visitorsMap[e.subject_id] : (e.payload?.visitor || e.payload?.subject || null);
        const subjectPurpose = visitorRecord?.purpose || e.payload?.purpose || (visitorRecord?.name ? visitorRecord.name : null);
        const visitorName = visitorRecord?.name || null;
        return { ...e, actorName, subjectPurpose, visitorName };
      });

      setEvents(enriched);
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <Navbar />
      <div className="p-6">
        <h1 className="text-2xl mb-4">Audit Events</h1>
        <div className="space-y-2">
          {events.map((e) => {
            const note = e.payload?.note || e.payload?.reason || null;
            return (
              <div key={e.id} className="border p-2">
                <div className="text-sm text-gray-500">{new Date(e.created_at).toLocaleString()} · {e.type}</div>
                <div><strong>Actor:</strong> {e.actorName || 'Unknown'}</div>
                <div><strong>Subject:</strong> {e.subjectPurpose || (e.visitorName ? e.visitorName : '—')}</div>
                {e.visitorName && <div className="text-sm">Visitor: {e.visitorName}</div>}
                {note && <div className="mt-1 text-sm text-gray-700">{note}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
