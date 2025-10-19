import { useEffect, useState } from "react";
import { supabase, getUserProfile } from "../supabaseClient";
// import Navbar from "../components/Navbar";

export default function Profile() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const data = await getUserProfile();
    setProfile(data);
    // console.log('[Profile] Fetched profile data:', data);
  };

  if (!profile) return <p>Loading profile...</p>;

  return (
    <div>
      {/* <Navbar /> */}
      <div className="p-6 max-w-md mx-auto">
        <p>
          <strong>Name:</strong> {profile.display_name}
        </p>
        <p>
          <strong>Email:</strong> {profile.email}
        </p>
        {profile.phone && (
          <p>
            <strong>Phone:</strong> {profile.phone}
          </p>
        )}
        {profile.role && (
          <p>
            <strong>Role:</strong> {profile.role}
          </p>
        )}
        {profile.household && (
          <p>
            <strong>Household:</strong> {profile.household.flat_no} — {profile.household.name}
          </p>
        )}
      </div>
    </div>
  );
}
