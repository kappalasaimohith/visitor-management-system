import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";
import Profile from "./Profile";

export default function Dashboard() {
  const [visitors, setVisitors] = useState([]);
  const [profile, setProfile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loadingVisitors, setLoadingVisitors] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        navigate("/", { replace: true });
        return;
      }
      fetchVisitors();
    };
    init();
  }, [navigate]);

  const fetchVisitors = async () => {
    setLoadingVisitors(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        setVisitors([]);
        setLoadingVisitors(false);
        return;
      }

      // get current user's household_id
      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("household_id")
        .eq("id", uid)
        .maybeSingle();

      if (userErr) {
        console.error("Dashboard: failed to load user", userErr);
        setVisitors([]);
        setLoadingVisitors(false);
        return;
      }

      const hh = userRow?.household_id;
      if (!hh) {
        // same behaviour as My Visitors when no household
        setVisitors([]);
        setLoadingVisitors(false);
        return;
      }

      // load visitors for this household only (same as ResidentVisitorList)
      const { data, error: vErr } = await supabase
        .from("visitors")
        .select("*")
        .eq("host_household_id", hh)
        .order("created_at", { ascending: false });

      if (vErr) {
        console.error("Dashboard visitors error", vErr);
        setVisitors([]);
      } else {
        setVisitors(data || []);
      }
    } catch (err) {
      console.error("Dashboard visitors error", err);
      setVisitors([]);
    } finally {
      setLoadingVisitors(false);
    }
  };

  const fetchProfile = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (error) console.error(error);
    else setProfile(data);
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm('Delete your account? This is irreversible.');
    if (!confirmed) return;

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/users/delete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!resp.ok) throw new Error('Delete failed');
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    }

    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
    window.location.href = '/';
  };

  const getStatusColor = (status) => {
    const s = String(status ?? "").toLowerCase();
    switch (s) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
      case "denied":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "checked_in":
      case "checked-in":
        return "bg-blue-100 text-blue-800";
      case "checked_out":
      case "checked-out":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDeviceDate = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Overview of your visitors and activity</p>
          </div>
          <button
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-sm"
            onClick={() => {
              fetchProfile();
              setShowProfile(true);
            }}
          >
            Manage Profile
          </button>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Visitors</h2>

          {loadingVisitors ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="animate-pulse">
                    <div className="flex justify-between items-start gap-3">
                      <div className="h-4 w-36 bg-slate-100 rounded" />
                      <div className="h-5 w-20 bg-slate-100 rounded-full" />
                    </div>
                    <div className="mt-3 h-3 w-2/3 bg-slate-100 rounded" />
                    <div className="mt-5 h-px bg-slate-100" />
                    <div className="mt-3 h-3 w-28 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : visitors.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-slate-200">
              <p className="text-slate-600">No visitors found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visitors.map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-5"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{v.name}</h3>
                      <p className="text-sm text-gray-500">{v.purpose}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        v.status
                      )}`}
                    >
                      {String(v.status ?? "").replace(/[_-]/g, " ")}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 border-t border-gray-50 pt-3 flex justify-between">
                    <span>{formatDeviceDate(v.created_at)}</span>
                    <span>{v.phone}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showProfile && profile && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setShowProfile(false)}
                />
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Your Profile</h3>
                    <button onClick={() => setShowProfile(false)} className="text-gray-400 hover:text-gray-500">
                      <span className="text-2xl">&times;</span>
                    </button>
                  </div>
                  <div className="mt-2">
                    <Profile />
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleDeleteAccount}
                  >
                    Delete Account
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowProfile(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
