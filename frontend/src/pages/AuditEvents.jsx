import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function AuditEvents() {
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      const API = import.meta.env.VITE_API_URL || "";
      const resp = await fetch(`${API}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to fetch events");
      }

      const raw = json.events || [];

      const actorIds = [...new Set(raw.map(r => r.actor_user_id).filter(Boolean))];
      const subjectIds = [...new Set(raw.map(r => r.subject_id).filter(Boolean))];

      const [usersRes, visitorsRes] = await Promise.all([
        actorIds.length
          ? supabase.from("users").select("id, display_name").in("id", actorIds)
          : Promise.resolve({ data: [] }),
        subjectIds.length
          ? supabase.from("visitors").select("id, name").in("id", subjectIds)
          : Promise.resolve({ data: [] }),
      ]);

      const usersMap = Object.fromEntries(
        (usersRes.data || []).map(u => [u.id, u.display_name])
      );

      const visitorsMap = Object.fromEntries(
        (visitorsRes.data || []).map(v => [v.id, v.name])
      );

      const enriched = raw.map(e => ({
        ...e,
        actorName:
          (e.actor_user_id && usersMap[e.actor_user_id]) ||
          e.payload?.actorName ||
          "System",
        visitorName:
          (e.subject_id && visitorsMap[e.subject_id]) ||
          e.payload?.visitor?.name ||
          "—",
      }));

      setEvents(enriched);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (mounted) fetchEvents();

    const sub = supabase
      .channel("events-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(sub);
    };
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;

    return events.filter(e => {
      const hay = `
        ${e.type ?? ""}
        ${e.actorName ?? ""}
        ${e.visitorName ?? ""}
        ${e.payload?.note ?? ""}
        ${e.payload?.reason ?? ""}
      `.toLowerCase();

      return hay.includes(q);
    });
  }, [events, query]);

  const getEventColor = (type) => {
    switch (type) {
      case "CHECK_IN":
        return "bg-green-100 text-green-700";
      case "CHECK_OUT":
        return "bg-yellow-100 text-yellow-700";
      case "DELETE":
        return "bg-red-100 text-red-700";
      case "UPDATE":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Audit Log
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Monitor system activity in real time.
            </p>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by action, actor, visitor, or reason..."
            className="w-full sm:w-96 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-slate-200 focus:outline-none"
          />
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-8 text-center text-slate-500">
            Loading events...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-10 text-center">
            <p className="text-slate-700 font-medium">
              No matching events found
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Try adjusting your search.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase text-xs">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase text-xs">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase text-xs">
                      Actor
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase text-xs">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500 uppercase text-xs">
                      Details
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {formatDate(e.created_at)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventColor(
                            e.type
                          )}`}
                        >
                          {e.type}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                        {e.actorName}
                      </td>

                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {e.visitorName}
                      </td>

                      <td className="px-6 py-4 text-slate-500 max-w-sm">
                        <div
                          className="truncate"
                          title={JSON.stringify(e.payload, null, 2)}
                        >
                          {e.payload?.note ||
                            e.payload?.reason ||
                            "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-slate-50 text-xs text-slate-500">
              Showing {filtered.length} of {events.length} events
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
