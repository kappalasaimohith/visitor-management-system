import { useEffect, useState } from "react";
import { getUserProfile } from "../supabaseClient";

export default function Profile() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const data = await getUserProfile();
    setProfile(data);
  };

  if (!profile)
    return (
      <div className="flex justify-center items-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      </div>
    );

  const initial = (profile.display_name?.trim()?.[0] || "U").toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="h-14 w-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xl font-semibold">
          {initial}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 truncate">{profile.display_name || "User"}</h2>
          <span className="inline-flex items-center mt-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize">
            {profile.role}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-slate-500 text-sm">Email</span>
          <span className="text-slate-900 font-medium text-sm">{profile.email}</span>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-slate-500 text-sm">Phone</span>
          <span className="text-slate-900 font-medium text-sm">{profile.phone || "Not set"}</span>
        </div>

        {profile.household && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Household Details
            </h4>
            <div className="flex justify-between items-center gap-3">
              <span className="text-slate-900 font-medium truncate">{profile.household.name}</span>
              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-700">
                {profile.household.flat_no}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
