import { Link, useLocation } from "react-router-dom";
import { supabase, getUserProfile } from "../supabaseClient";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [profile, setProfile] = useState(null);
  const location = useLocation();

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

  const isActive = (path) => location.pathname === path;

  const NavItem = ({ to, label }) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${isActive(to)
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-gray-800 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              VMS
            </Link>
            <div className="hidden md:ml-10 md:flex md:space-x-4">
              <NavItem to="/dashboard" label="Dashboard" />
              {profile && profile.role !== 'guard' && profile.role !== 'admin' && (
                <>
                  <NavItem to="/visitor" label="Create Visitor" />
                  <NavItem to="/resident-visitors" label="My Visitors" />
                </>
              )}
              <NavItem to="/guard-visitors" label="Gate" />
              <NavItem to="/chat" label="AI Copilot" />
              <NavItem to="/broadcasts" label="Broadcasts" />
              {profile && profile.role === 'admin' && (
                <NavItem to="/audit" label="Audit" />
              )}
            </div>
          </div>
          <div className="flex items-center">
            <div className="hidden md:block mr-4 text-sm text-gray-500">
              {profile?.display_name}
            </div>
            <button
              onClick={logout}
              className="ml-4 bg-white text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
