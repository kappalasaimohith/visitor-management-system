// Middleware to validate incoming Authorization: Bearer <access_token>
import supabaseAdmin from './supabaseClient.js';

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    // Verify Supabase access token
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach auth user info
    req.user = data.user;

    // Fetch from "users" table (not profiles). If missing, auto-bootstrap a minimal record
    let { data: userRow, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (userErr) {
      return res.status(500).json({ error: 'Failed to load user record' });
    }

    if (!userRow) {
      // Auto-create a household and user row with default resident role
      const displayName = data.user.user_metadata?.full_name || data.user.email || 'New User';

      const { data: household, error: hhErr } = await supabaseAdmin
        .from('households')
        .insert([{ name: `${displayName}'s Household`, flat_no: null }])
        .select('*')
        .maybeSingle();

      if (hhErr) {
        return res.status(500).json({ error: 'Failed to bootstrap household' });
      }

      // Check if role was set during registration
      const registeredRole = data.user.user_metadata?.role || 'resident';

      const { data: insertedUser, error: insErr } = await supabaseAdmin
        .from('users')
        .insert([
          {
            id: data.user.id,
            display_name: displayName,
            household_id: registeredRole === 'guard' ? null : household?.id, // guards don't need household
            role: registeredRole,
          },
        ])
        .select('*')
        .maybeSingle();

      if (insErr) {
        return res.status(500).json({ error: 'Failed to bootstrap user' });
      }

      userRow = insertedUser;
    }

    // Attach user record (has household_id, role, etc.)
    // Normalize roles: DB stores roles as text[] named 'roles'. For convenience set
    // profile.roles (array) and profile.role (first role string) for existing code.
    if (userRow.roles && Array.isArray(userRow.roles)) {
      userRow.roles = userRow.roles;
      userRow.role = userRow.roles[0] || null;
    } else if (userRow.role) {
      // legacy single role column
      userRow.roles = [userRow.role];
    } else {
      userRow.roles = ['resident'];
      userRow.role = 'resident';
    }

    req.profile = userRow; // keep same name "profile" to avoid editing all routes
    next();
  } catch (err) {
    console.error('auth error', err);
    return res.status(500).json({ error: 'Auth validation failed' });
  }
}
