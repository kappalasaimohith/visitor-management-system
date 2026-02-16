import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/", { replace: true });
      } else {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/", { replace: true });
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <div>
              <p className="text-sm font-medium text-slate-900">Loading</p>
              <p className="text-xs text-slate-500">Checking your session…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
