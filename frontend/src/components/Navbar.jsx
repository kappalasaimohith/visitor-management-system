import { Link, useLocation } from "react-router-dom";
import { supabase, getUserProfile } from "../supabaseClient";
import { useEffect, useMemo, useState } from "react";

export default function Navbar() {
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const p = await getUserProfile();
      setProfile(p);
    })();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const logout = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" });
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/";
    }
  };

  const isActive = (path) => location.pathname === path;

  const links = useMemo(() => {
    const items = [{ to: "/dashboard", label: "Dashboard" }];

    if (profile && profile.role !== "guard" && profile.role !== "admin") {
      items.push(
        { to: "/visitor", label: "Create Visitor" },
        { to: "/resident-visitors", label: "My Visitors" }
      );
    }

    if (profile && (profile.role === "guard" || profile.role === "admin")) {
      items.push({ to: "/guard-visitors", label: "Gate" });
    }

    items.push(
      { to: "/chat", label: "AI Copilot" },
      { to: "/broadcasts", label: "Broadcasts" }
    );

    if (profile && profile.role === "admin") items.push({ to: "/audit", label: "Audit" });

    return items;
  }, [profile]);

  const NavItem = ({ to, label, mobile = false }) => (
    <Link
      to={to}
      className={[
        "rounded-lg text-sm font-medium transition-colors",
        mobile ? "px-3 py-2" : "px-3 py-2",
        isActive(to)
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );

  const initial = (profile?.display_name?.trim()?.[0] || "U").toUpperCase();

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-lg font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"
            >
              VMS
            </Link>
          </div>

          {/* Right: Links + User */}
          <div className="flex items-center gap-6 ml-auto">
            {/* Navigation links (desktop only) */}
            <div className="hidden md:flex md:space-x-2 lg:space-x-3">
              {links.map((l) => (
                <NavItem key={l.to} to={l.to} label={l.label} />
              ))}
            </div>

            {/* User avatar + name */}
            <div className="hidden md:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                {initial}
              </div>
              <div className="text-sm text-slate-600">{profile?.display_name}</div>
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              className="hidden md:inline-flex bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Logout
            </button>

            {/* Mobile menu toggle */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
            >
              Menu
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4">
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-2 flex flex-col gap-1">
              {links.map((l) => (
                <NavItem key={l.to} to={l.to} label={l.label} mobile />
              ))}

              <div className="h-px bg-slate-100 my-1" />

              <button
                onClick={logout}
                className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}