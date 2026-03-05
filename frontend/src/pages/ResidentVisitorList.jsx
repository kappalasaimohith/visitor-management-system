import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function ResidentVisitorList({ user }) {
  const [visitors, setVisitors] = useState([]);
  const [householdId, setHouseholdId] = useState(null);

  // UX state
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // track current household for realtime refresh
  const householdIdRef = useRef(null);

  // fetch visitors for a given household (frontend Supabase, filtered)
  const fetchVisitors = async (hhId) => {
    if (!hhId) return;
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("visitors")
      .select("*")
      .eq("host_household_id", hhId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErrorMsg("Could not load visitors. Please try again.");
      setVisitors([]);
    } else {
      setVisitors(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg("");

      // get current auth user
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        setLoading(false);
        setErrorMsg("You’re not signed in.");
        return;
      }

      // load user row to get household_id
      const { data: userRow, error } = await supabase
        .from("users")
        .select("household_id")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.error(error);
        setLoading(false);
        setErrorMsg("Could not load your profile.");
        return;
      }

      const hh = userRow?.household_id ?? null;
      setHouseholdId(hh);
      householdIdRef.current = hh;

      if (hh) {
        await fetchVisitors(hh);
      } else {
        setLoading(false);
        setErrorMsg("No household is linked to your account.");
      }
    };

    init();

    // realtime refresh for this household
    const sub = supabase
      .channel("visitors-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitors" },
        () => {
          const hh = householdIdRef.current;
          if (hh) fetchVisitors(hh);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep ref in sync
  useEffect(() => {
    householdIdRef.current = householdId;
  }, [householdId]);

  const deleteVisitor = async (visitorId) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert("Not authenticated");

    if (!confirm("Are you sure you want to delete this visitor?")) return;

    try {
      const API = import.meta.env.VITE_API_URL || "";
      const resp = await fetch(`${API}/api/visitors/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visitorId }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        const msg = data?.error || "Failed to delete";
        alert(msg);
        return;
      }

      const hh = householdIdRef.current;
      if (hh) fetchVisitors(hh);
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  };

  const updateVisitorStatus = async (visitorId, status) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return alert("Not authenticated");

    const endpoint =
      status === "approved" ? "/api/visitors/approve" : "/api/visitors/deny";
    const body =
      status === "approved"
        ? { visitorId }
        : { visitorId, reason: "Denied via app" };

    try {
      const API = import.meta.env.VITE_API_URL || "";
      const resp = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return alert("Failed");
      const hh = householdIdRef.current;
      if (hh) fetchVisitors(hh);
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  };

  const getStatusColor = (status) => {
    const s = String(status ?? "").toLowerCase();
    switch (s) {
      case "approved":
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
      case "rejected":
      case "denied":
        return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
      case "pending":
        return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
      case "checked_in":
      case "checked-in":
        return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
      case "checked_out":
      case "checked-out":
        return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
      default:
        return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
    }
  };

  const formatStatus = (status) =>
    status ? String(status).replace(/[-_]/g, " ") : "unknown";

  const formatDeviceDateTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  };

  const filteredVisitors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (visitors ?? []).filter((v) => {
      const matchesQuery =
        !q ||
        v?.name?.toLowerCase()?.includes(q) ||
        v?.purpose?.toLowerCase()?.includes(q);
      const statusLower = String(v?.status ?? "").toLowerCase();
      const matchesStatus =
        statusFilter === "all" || statusLower === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [visitors, query, statusFilter]);

  const stats = useMemo(() => {
    const counts = { total: visitors.length, pending: 0, approved: 0, denied: 0 };
    for (const v of visitors) {
      const s = String(v?.status ?? "").toLowerCase();
      if (s === "pending") counts.pending += 1;
      else if (s === "approved") counts.approved += 1;
      else if (s === "denied" || s === "rejected") counts.denied += 1;
    }
    return counts;
  }, [visitors]);

  const handleRefresh = () => {
    const hh = householdIdRef.current;
    if (hh) fetchVisitors(hh);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              My Visitors
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Search, filter by status, and manage approvals.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or purpose…"
                className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                aria-label="Filter by status"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="checked_in">Checked-in</option>
                <option value="checked_out">Checked-out</option>
              </select>
            </div>

            <button
              onClick={handleRefresh}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              Total: {stats.total}
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              Pending: {stats.pending}
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              Approved: {stats.approved}
            </span>
            <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
              Denied: {stats.denied}
            </span>
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-medium text-slate-700">{filteredVisitors.length}</span> of{" "}
            <span className="font-medium text-slate-700">{visitors.length}</span>
          </div>
        </div>

        {errorMsg ? (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-rose-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-rose-700">Something went wrong</p>
                <p className="text-sm text-slate-600 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={handleRefresh}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"
              >
                <div className="animate-pulse">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-5 w-40 rounded bg-slate-100" />
                    <div className="h-5 w-20 rounded-full bg-slate-100" />
                  </div>
                  <div className="mt-3 h-4 w-3/4 rounded bg-slate-100" />
                  <div className="mt-4 h-3 w-32 rounded bg-slate-100" />
                  <div className="mt-5 h-px w-full bg-slate-100" />
                  <div className="mt-4 flex gap-2">
                    <div className="h-9 flex-1 rounded bg-slate-100" />
                    <div className="h-9 w-24 rounded bg-slate-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredVisitors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
            <p className="text-slate-700 font-medium">No visitors found</p>
            <p className="text-slate-500 text-sm mt-1">
              Try clearing filters or searching for a different name.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVisitors.map((v) => {
              const statusLower = String(v.status ?? "").toLowerCase();
              const canDelete =
                statusLower === "pending" || statusLower === "denied";

              return (
                <div
                  key={v.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base text-slate-900 truncate">
                          {v.name}
                        </h3>
                        <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                          {v.purpose || "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusColor(
                          v.status
                        )}`}
                        title={formatStatus(v.status)}
                      >
                        {formatStatus(v.status)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500">
                      Requested:{" "}
                      <span className="text-slate-700">
                        {formatDeviceDateTime(v.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 border-t border-slate-100 pt-4">
                    {statusLower === "pending" && (
                      <>
                        <button
                          className="flex-1 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800"
                          onClick={() => updateVisitorStatus(v.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="flex-1 rounded-lg bg-rose-600 text-white px-3 py-2 text-sm font-medium hover:bg-rose-700 active:bg-rose-800"
                          onClick={() => updateVisitorStatus(v.id, "denied")}
                        >
                          Deny
                        </button>
                      </>
                    )}

                    {canDelete && (
                      <button
                        className="rounded-lg border border-slate-200 bg-white text-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-50 active:bg-slate-100"
                        onClick={() => deleteVisitor(v.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
