import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";

export default function ResidentVisitorList({ user }) {
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, () => {
        fetchVisitors(householdId);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [householdId]);

  const fetchVisitors = async (hhId) => {
    if (!hhId) return;
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

    if (!confirm('Are you sure you want to delete this visitor?')) return;

    try {
      const resp = await fetch('/api/visitors/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ visitorId }),
      });
      if (!resp.ok) return alert('Failed to delete');
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
      if (!resp.ok) return alert('Failed');
      fetchVisitors(householdId);
    } catch (err) { console.error(err); alert('Network error'); }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'checked-in': return 'bg-blue-100 text-blue-800';
      case 'checked-out': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Visitors</h1>

        {visitors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
            <p className="text-gray-500">No visitors found.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visitors.map((v) => (
              <div key={v.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{v.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${getStatusColor(v.status)}`}>
                      {v.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{v.purpose}</p>
                  <div className="text-xs text-gray-400 mb-4">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex space-x-2 mt-auto border-t border-gray-50 pt-3">
                  {v.status === "pending" && (
                    <>
                      <button
                        className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-700 transition"
                        onClick={() => updateVisitorStatus(v.id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="flex-1 bg-red-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-red-700 transition"
                        onClick={() => updateVisitorStatus(v.id, "denied")}
                      >
                        Deny
                      </button>
                    </>
                  )}
                  <button
                    className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 transition"
                    onClick={() => deleteVisitor(v.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
