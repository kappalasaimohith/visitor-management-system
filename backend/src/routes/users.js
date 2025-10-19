import express from 'express';
import supabaseAdmin from '../supabaseClient.js';

const router = express.Router();

// GET /api/users/profile - return authenticated user's profile
router.get('/profile', async (req, res) => {
  const { profile } = req;
  if (!profile) return res.status(401).json({ error: 'Not authenticated' });
  return res.json({ user: profile });
});

async function appendEvent(type, actorUserId, subjectId, payload) {
  await supabaseAdmin.from('events').insert([{ type, actor_user_id: actorUserId, subject_id: subjectId, payload, ts: new Date().toISOString() }]);
}

// Delete own account (authenticated)
router.post('/delete', async (req, res) => {
  console.log('[POST] /api/users/delete', { user: req.profile?.id });
  const { profile } = req;
  if (!profile) return res.status(403).json({ error: 'Not authenticated' });

  try {
    // append event before deletion for audit
    await appendEvent('account_delete_requested', profile.id, profile.id, {});

    // Delete auth user using admin API
    const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
    if (error) return res.status(500).json({ error: error.message });

    // also append account_deleted event
    await appendEvent('account_deleted', profile.id, profile.id, {});

    return res.json({ ok: true });
  } catch (err) {
    console.error('delete user error', err);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Promote a user to admin (only callable by existing admins)
router.post('/promote', async (req, res) => {
  console.log('[POST] /api/users/promote', { user: req.profile?.id, body: req.body });
  const { profile } = req;
  if (!profile) return res.status(403).json({ error: 'Not authenticated' });

  const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
  if (!isAdmin) return res.status(403).json({ error: 'Only admins can promote users' });

  const { userId, email } = req.body;
  if (!userId && !email) return res.status(400).json({ error: 'userId or email required' });

  try {
    // Find the user row if email provided
    let targetQuery = supabaseAdmin.from('users');
    if (userId) targetQuery = targetQuery.eq('id', userId);
    if (email) targetQuery = targetQuery.eq('email', email);

    let { data: existing } = await targetQuery.select('*').maybeSingle();

    // If there's no users row, try to find the auth user by email and create a users row
    if (!existing && email) {
      try {
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
        const found = (allUsers?.users || []).find(u => u.email === email);
        if (found) {
          // insert minimal users row for this auth user
          const displayName = found.user_metadata?.name || found.email;
          const { data: inserted, error: insErr } = await supabaseAdmin
            .from('users')
            .insert([
              {
                id: found.id,
                display_name: displayName,
                email: found.email,
                phone: found.user_metadata?.phone || null,
                household_id: null,
                role: 'admin',
              },
            ])
            .select('*')
            .maybeSingle();
          if (insErr) throw insErr;
          existing = inserted;
        }
      } catch (err) {
        console.error('promote: failed to locate auth user', err);
      }
    }

    if (!existing) return res.status(404).json({ error: 'Target user not found' });

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ role: 'admin' })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    await appendEvent('promote', profile.id, existing.id, { newRole: 'admin' });
    return res.json({ user: data });
  } catch (err) {
    console.error('promote error', err);
    return res.status(500).json({ error: 'Failed to promote user' });
  }
});

export default router;
