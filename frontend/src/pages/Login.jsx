import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/dashboard");
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setInfo("");
    try {
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password,
        options: { redirectTo: window.location.origin + '/dashboard' }
      });

      if (error) {
        if (!user) setInfo('User not found. Please register first.');
        else if (error.message === 'Invalid login credentials') setInfo('Invalid password. Please try again.');
        else setInfo(error.message);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setInfo('Login failed. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-tr from-blue-50 via-white to-purple-50 px-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-gray-200">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-6 text-center">Login</h1>

        {info && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm text-center">
            {info}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <input
            className="border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={handleLogin}
            className={`w-full py-3 rounded-lg text-white font-semibold transition ${
              loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>

        <p className="mt-6 text-center text-gray-500 text-sm">
          Don't have an account?{" "}
          <a href="/register" className="text-blue-600 font-medium hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
