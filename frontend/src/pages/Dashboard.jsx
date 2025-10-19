import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Navbar from "../components/Navbar";
import Profile from "./Profile";
export default function Dashboard() {
  const [visitors, setVisitors] = useState([]);
  const [profile, setProfile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      console.log('Dashboard init, uid=', uid);
      if (!uid) {
        navigate('/');
        return;
      }
      fetchVisitors();
    };
    init();
  }, []);

  const fetchVisitors = async () => {
    const { data, error } = await supabase.from("visitors").select("*");
    if (error) console.error(error);
    else setVisitors(data);
  };

  const fetchProfile = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) console.error(error);
    else setProfile(data);
  };

  // ✅ Handle account deletion and logout
  const handleDeleteAccount = async () => {
    const confirmed = confirm('Delete your account? This is irreversible.');
    if (!confirmed) return;

    try {
      const API = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${API}/api/users/delete`, {
        method: 'POST',
        credentials: 'include', // optional, if server supports cookie auth
      });

      if (!resp.ok) throw new Error('Delete failed');
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    }

    try {
      await supabase.auth.signOut({ scope: 'global' }); // clears all sessions
    } catch (err) {
      console.error('Logout failed:', err);
    }

    window.location.href = '/';
  };

  return (
    <div>
      <Navbar />
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Visitors</h1>
          {/* <Profile /> */}
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={() => {
              fetchProfile();
              setShowProfile(true);
            }}
          >
            Profile
          </button>
        </div>

        {visitors.map((v) => (
          <div key={v.id} className="border p-3 mb-2 rounded flex justify-between">
            <div>
              <p>{v.name}</p>
              <p className="text-sm text-gray-500">{v.purpose}</p>
            </div>
            <span className="text-sm">{v.status}</span>
          </div>

        ))}

        {showProfile && profile && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="bg-white p-6 rounded w-96">
              <h2 className="text-xl font-bold mb-2">Profile</h2>
                <Profile />
              <div className="mt-4 flex justify-end">
                <button
                  className="bg-red-600 text-white px-3 py-1 rounded mr-2"
                  onClick={handleDeleteAccount}
                >
                  Delete Account
                </button>
                <button
                  className="bg-gray-300 px-3 py-1 rounded"
                  onClick={() => setShowProfile(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
