import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

console.log('API URL:', import.meta.env.VITE_API_URL);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // If user already signed in, redirect to dashboard
        navigate("/dashboard");
      }
    };
    checkSession();

    // Optional: subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    console.log('[Login] Attempting login', { email });
    setLoading(true);
    setInfo("");
    try {
      // First check if user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();
      
      console.log('[Login] User check:', { user, userError });

      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password,
        options: {
          redirectTo: window.location.origin + '/dashboard'
        }
      });

      console.log('[Login] Auth response:', { data, error });

      if (error) {
        console.error('[Login] Login failed', error);
        if (!user) {
          setInfo('User not found. Please register first.');
        } else if (error.message === 'Invalid login credentials') {
          setInfo('Invalid password. Please try again.');
        } else {
          setInfo(error.message);
        }
      } else {
        console.log('[Login] Login successful', { email });
        navigate("/dashboard");
      }
    } catch (err) {
      console.error('[Login] Unexpected error', err);
      setInfo('Login failed. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return alert('Please enter your email in the email field above to resend confirmation.');
    setLoading(true);
    setInfo('');
    try {
      // send a magic link / otp which acts as a confirmation/resend pathway
      const { data, error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/login' } });
      if (error) {
        console.error('[Login] Resend failed', error);
        setInfo(error.message || 'Failed to resend confirmation');
      } else {
        console.log('[Login] Resend success', data);
        setInfo('Sent a magic link to your email. Check your inbox and spam folder. Use the link to complete login.');
      }
    } catch (err) {
      console.error('[Login] Resend unexpected error', err);
      setInfo('Failed to resend confirmation');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl mb-4">Login</h1>
      <input
        className="border p-2 mb-2 w-80"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border p-2 mb-4 w-80"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Login
      </button>
      <p className="mt-2 text-sm">
        Don't have an account? <a href="/register" className="text-blue-500">Register</a>
      </p>
    </div>
  );
}
