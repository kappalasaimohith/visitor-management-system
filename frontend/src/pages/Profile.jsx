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

  if (!profile) return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg ">
      <div className="flex items-center space-x-4 mb-6">
        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
          {profile.display_name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{profile.display_name}</h2>
          <p className="text-sm text-gray-500 capitalize">{profile.role}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex border-b border-gray-50 pb-3">
          <span className="text-gray-500 w-24 text-sm">Email</span>
          <span className="text-gray-800 font-medium text-sm">{profile.email}</span>
        </div>

        <div className="flex border-b border-gray-50 pb-3">
          <span className="text-gray-500 w-24 text-sm">Phone</span>
          <span className="text-gray-800 font-medium text-sm">{profile.phone || 'Not set'}</span>
        </div>

        {profile.household && (
          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Household Details</h4>
            <div className="flex justify-between items-center">
              <span className="text-gray-900 font-medium">{profile.household.name}</span>
              <span className="bg-white border border-gray-200 px-2 py-1 rounded text-xs font-mono text-gray-600">
                {profile.household.flat_no}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
