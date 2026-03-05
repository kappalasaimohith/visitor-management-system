import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/dashboard", { replace: true });
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard", { replace: true });
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    if (loading) return;

    setLoading(true);
    setInfo("");

    try {
      const { data: user } = await supabase
        .from("users")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { redirectTo: window.location.origin + "/dashboard" },
      });

      if (error) {
        if (!user) setInfo("User not found. Please register first.");
        else if (error.message === "Invalid login credentials") setInfo("Invalid password. Please try again.");
        else setInfo(error.message);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      console.error(err);
      setInfo("Login failed. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-tr from-blue-50 via-white to-purple-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md border border-slate-200">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Login</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        </div>

        {info && (
          <div className="bg-rose-50 text-rose-700 p-3 rounded-lg mb-4 text-sm border border-rose-100">
            {info}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pr-20 text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 border border-slate-200"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-3 rounded-lg text-white font-semibold transition ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-500 text-sm">
          Don't have an account?{" "}
          <Link to="/register" className="text-blue-600 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
