import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function GuardVisitorList() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isGuardOrAdmin, setIsGuardOrAdmin] = useState(false);

  useEffect(() => {
    fetchVisitors();
    const sub = supabase
      .channel("visitors-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        fetchVisitors();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setVisitors([]);
        setLoading(false);
        return;
      }

      const API = import.meta.env.VITE_API_URL || "";
      // Get profile (role) + visitors in parallel
      const [profileResp, visitorsResp] = await Promise.all([
        fetch(`${API}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/api/visitors`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const profileJson = await profileResp.json();
      if (profileResp.ok) {
        const role = profileJson.user?.role;
        setIsGuardOrAdmin(role === "guard" || role === "admin");
      }

      const visitorsJson = await visitorsResp.json();
      if (!visitorsResp.ok) {
        console.error("GuardVisitorList load error", visitorsJson);
        setVisitors([]);
        setLoading(false);
        return;
      }

      // Backend has already enforced RBAC; now keep only relevant statuses for gate view
      const base = (visitorsJson.visitors || []).filter((v) =>
        ["pending", "approved", "checked_in"].includes(String(v.status || "").toLowerCase())
      );

      // Enrich with household info (flat_no, name) without touching visitors table directly
      const hostIds = [
        ...new Set(base.map((v) => v.host_household_id).filter(Boolean)),
      ];
      let householdsMap = {};
      if (hostIds.length) {
        const { data: households, error: hErr } = await supabase
          .from("households")
          .select("id, flat_no, name")
          .in("id", hostIds);
        if (!hErr) {
          householdsMap = Object.fromEntries(
            (households || []).map((h) => [h.id, h])
          );
        }
      }

      // (Optional) keep "created_by_name" enrichment as before
      const enriched = await Promise.all(
        base.map(async (v) => {
          let created_by_name = null;
          try {
            const { data: ev } = await supabase
              .from("events")
              .select("actor_user_id, payload")
              .eq("type", "create")
              .eq("subject_id", v.id)
              .limit(1)
              .maybeSingle();

            if (ev?.actor_user_id) {
              const { data: u } = await supabase
                .from("users")
                .select("display_name")
                .eq("id", ev.actor_user_id)
                .maybeSingle();
              created_by_name = u?.display_name;
            } else if (ev?.payload) {
              created_by_name =
                ev.payload?.actorName || ev.payload?.actor?.displayName;
            }
          } catch {
            created_by_name = null;
          }

          return {
            ...v,
            host_household: householdsMap[v.host_household_id] || null,
            created_by_name,
          };
        })
      );

      setVisitors(enriched);
    } catch (err) {
      console.error(err);
      setVisitors([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (String(status ?? "").toLowerCase()) {
      case "pending":
        return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
      case "approved":
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
      case "checked_in":
        return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
      default:
        return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
    }
  };

  const formatDeviceDateTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter((v) => {
      const hay = `${v?.name ?? ""} ${v?.purpose ?? ""} ${v?.host_household?.flat_no ?? ""} ${v?.host_household?.name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [visitors, query]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Gate Control</h1>
            <p className="text-sm text-slate-500 mt-1">Approve, deny, and check visitors in/out.</p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, flat, purpose…"
            className="w-full sm:w-80 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
          />
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="animate-pulse">
                  <div className="h-4 w-32 bg-slate-100 rounded" />
                  <div className="mt-3 h-3 w-2/3 bg-slate-100 rounded" />
                  <div className="mt-5 h-9 w-full bg-slate-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
            <p className="text-slate-700 font-medium">No matching visitors</p>
            <p className="text-slate-500 text-sm mt-1">Try a different search.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v) => (
              <div key={v.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base text-slate-900 truncate">{v.name}</h3>
                    <p className="text-sm text-slate-600 mt-0.5 truncate">{v.purpose || "—"}</p>
                    {v.created_by_name && (
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        Created by: <span className="text-slate-700">{v.created_by_name}</span>
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold text-slate-800">{v.host_household?.flat_no}</div>
                    <div className="text-xs text-slate-400">Flat</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusBadge(v.status)}`}>
                    {String(v.status ?? "").replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDeviceDateTime(v.created_at)}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
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
        )}
      </div>
    </div>
  );
}
