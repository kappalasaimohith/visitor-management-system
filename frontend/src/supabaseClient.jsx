import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getUserProfile = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return null;

  const userId = sessionData.session.user.id;
  const { data, error } = await supabase
    .from("users")
    .select("id, display_name, email, phone, role, household_id")
    .eq("id", userId)
    .single();

  if (error) console.error(error);

  // If users table has no row for this auth user, build a minimal profile from auth session
  if (!data) {
    const authUser = sessionData.session.user;
    const fallback = {
      id: userId,
      display_name: authUser.user_metadata?.name || authUser.email,
      email: authUser.email,
      phone: authUser.user_metadata?.phone || null,
      role: authUser.user_metadata?.role || null,
      household: null,
    };
    return fallback;
  }

  // If user has a household_id, fetch household details (flat_no, name)
  if (data?.household_id) {
    const { data: hh, error: hhErr } = await supabase
      .from('households')
      .select('id, flat_no, name')
      .eq('id', data.household_id)
      .maybeSingle();
    if (hhErr) console.error('Error fetching household', hhErr);
    return { ...data, household: hh || null };
  }

  return { ...data, household: null };
};
