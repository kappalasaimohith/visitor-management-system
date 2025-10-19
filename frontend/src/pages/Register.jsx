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
    console.log('[Register] Attempting registration', { email: formData.email, role: formData.role });
    // Require flatNo (room/household no) for residents only, format R-001
    if (formData.role === 'resident') {
      if (!formData.flatNo || !/^R-\d{3}$/.test(formData.flatNo)) {
        setError("Room/Household No is required for residents and must be in format R-001");
        setLoading(false);
        return;
      }
    }
    try {
      // 1️⃣ Create Supabase Auth user
      console.log('[Register] Creating Supabase auth user...');
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: window.location.origin + '/login',
          data: {
            name: formData.name,
            phone: formData.phone,
            role: formData.role  // Include role in auth metadata
          }
        }
      });
      
      // Debug log the full auth data
      console.log('[Register] Full auth data:', JSON.stringify(authData, null, 2));
      
      console.log('[Register] Auth response:', authData);

      if (signUpError) throw signUpError;
      const userId = authData.user.id;
      console.log('[Register] Supabase auth user created, ID:', userId); 

      // 2️⃣ Create a new household (only for residents)
      let household = null;
      if (formData.role === 'resident') {
        const { data: hhData, error: householdError } = await supabase
          .from("households")
          .insert([
            {
              name: formData.householdName || formData.name + "'s Household",
              flat_no: formData.flatNo,
            },
          ])
          .select()
          .single();

        if (householdError) throw householdError;
        if (!hhData?.id) throw new Error("Household creation failed");
        household = hhData;
      }

      // 3️⃣ Add user to users table (household_id only for residents)
      const { error: userInsertError } = await supabase.from("users").insert([
        {
          id: userId,
          display_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          household_id: household?.id || null, // null for guards
          role: formData.role
        },
      ]);

      if (userInsertError) throw userInsertError;

      alert("Registration successful! You MUST check your email and click the confirmation link before you can log in. Please check your inbox and spam folder.");
      // Don't auto-navigate to login, make user read the message
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Registration failed';
      setError(msg);
      // Handle Supabase 429 throttling with a visible cooldown
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md"
      >
        <label className="block mb-2">Room/Household No (format: R-001)</label>
        <input
          name="flatNo"
          value={formData.flatNo}
          onChange={handleChange}
          className="border p-2 mb-4 w-full"
          placeholder="R-001"
          required
        />
        <label className="block mb-2">Role</label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="border p-2 mb-4 w-full"
        >
          <option value="resident">Resident</option>
          <option value="guard">Guard</option>
          <option value="admin">Admin</option>
        </select>
        <h2 className="text-2xl font-semibold text-center mb-6">Register</h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
          <input
            type="text"
            name="phone"
            placeholder="Phone"
            onChange={handleChange}
            className="w-full border p-2 rounded"
            value={formData.phone}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            value={formData.password}
          />
          <input
            type="text"
            name="householdName"
            placeholder="Household Name (optional)"
            onChange={handleChange}
            className="w-full border p-2 rounded"
            value={formData.householdName}
          />
        </div>

        <button
          type="submit"
          disabled={loading || cooldownSec > 0}
          className="mt-6 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          {loading ? "Registering..." : cooldownSec > 0 ? `Wait ${cooldownSec}s` : "Register"}
        </button>

        <p className="text-center text-sm mt-4">
          Already have an account?{" "}
          <span
            className="text-blue-600 cursor-pointer"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </form>
    </div>

  );
}
