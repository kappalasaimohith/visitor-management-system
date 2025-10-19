import { Link } from "react-router-dom";
import { supabase, getUserProfile } from "../supabaseClient";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      const p = await getUserProfile();
      setProfile(p);
    })();
  }, []);
  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });

      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between">
      <div className="flex space-x-4">
        <Link to="/dashboard">Dashboard</Link>
        {/* Don't show Create Visitor or My Visitors to guards */}
        {profile && profile?.role !== 'guard' && profile?.role!=='admin' && (
          <>
            <Link to="/visitor">Create Visitor</Link>
            <Link to="/resident-visitors">My Visitors</Link>
          </>
        )}
        <Link to="/guard-visitors">Gate</Link>
        <Link to="/chat">AI Copilot</Link>
        <Link to="/broadcasts">Broadcasts</Link>
        
        { profile && profile?.role === 'admin' &&
            (<Link to="/audit">Audit</Link>)
        }
      </div>
      <button onClick={logout} className="bg-red-600 px-3 py-1 rounded">
        Logout
      </button>
    </nav>
  );
}
