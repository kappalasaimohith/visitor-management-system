import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    flatNo: "",
    householdName: "",
    role: "resident",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.role === 'resident') {
      if (!formData.flatNo || !/^R-\d{3}$/.test(formData.flatNo)) {
        setError("Room/Household No is required (Format: R-001)");
        setLoading(false);
        return;
      }
    }

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: window.location.origin + '/login',
          data: {
            name: formData.name,
            phone: formData.phone,
            role: formData.role
          }
        }
      });

      if (signUpError) throw signUpError;
      const userId = authData.user.id;

      let household = null;
      if (formData.role === 'resident') {
        const { data: hhData, error: householdError } = await supabase
          .from("households")
          .insert([{
            name: formData.householdName || formData.name + "'s Household",
            flat_no: formData.flatNo,
          }])
          .select()
          .single();

        if (householdError) throw householdError;
        household = hhData;
      }

      const { error: userInsertError } = await supabase.from("users").insert([{
        id: userId,
        display_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        household_id: household?.id || null,
        role: formData.role
      }]);

      if (userInsertError) throw userInsertError;

      alert("Registration successful! Please check your email for the confirmation link.");
      setTimeout(() => navigate("/login"), 2000);

    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Registration failed';
      setError(msg);
      if (msg.includes('40 seconds') || err?.status === 429) {
        let remaining = 40;
        setCooldownSec(remaining);
        const interval = setInterval(() => {
          remaining -= 1;
          setCooldownSec(Math.max(remaining, 0));
          if (remaining <= 0) clearInterval(interval);
        }, 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-tr from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-lg border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Create Account</h1>
          <p className="text-gray-500 mt-2">Join the community</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white"
              >
                <option value="resident">Resident</option>
                <option value="guard">Guard</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
            <input
              type="text"
              name="phone"
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
              placeholder="+1 234 567 8900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {formData.role === 'resident' && (
            <div className="pt-2 border-t border-gray-100 mt-2">
              <p className="text-xs text-gray-400 mb-3 uppercase font-semibold tracking-wider">Resident Details</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room/Household No</label>
                  <input
                    name="flatNo"
                    value={formData.flatNo}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                    placeholder="R-001"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Format: R-001</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Household Name (Optional)</label>
                  <input
                    type="text"
                    name="householdName"
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors"
                    placeholder="The Smith's"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || cooldownSec > 0}
            className={`w-full py-3 rounded-lg text-white font-semibold transition-all shadow-md ${loading || cooldownSec > 0
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
              }`}
          >
            {loading ? "Creating Account..." : cooldownSec > 0 ? `Wait ${cooldownSec}s` : "Register"}
          </button>
        </form>

        <p className="text-center text-sm mt-6 text-gray-500">
          Already have an account?{" "}
          <span
            className="text-blue-600 font-medium cursor-pointer hover:underline"
            onClick={() => navigate("/login")}
          >
            Log in here
          </span>
        </p>
      </div>
    </div>
  );
}
