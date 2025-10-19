import express from 'express';
import supabaseAdmin from '../supabaseClient.js';

const router = express.Router();

// List events. RBAC:
// - admin or guard: can see all events
// - resident: can see events related to their household's visitors
router.get('/', async (req, res) => {
  console.log('[GET] /api/events', { user: req.profile?.id, query: req.query });
  const { profile } = req;
  const limit = parseInt(req.query.limit || '100', 10);

  try {
    if (!profile) return res.status(403).json({ error: 'Missing profile' });

    const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
    const isGuard = (profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard'));

    if (isAdmin || isGuard) {
      const { data, error } = await supabaseAdmin.from('events').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ events: data });
    }

    // Resident: fetch visitor ids for this household and return events where subject_id in that list
    const householdId = profile.household_id;
    if (!householdId) return res.status(403).json({ error: 'Resident missing household' });

    const { data: visitors, error: vErr } = await supabaseAdmin.from('visitors').select('id').eq('host_household_id', householdId);
    if (vErr) return res.status(500).json({ error: vErr.message });

    const visitorIds = (visitors || []).map((v) => v.id);
    if (!visitorIds.length) return res.json({ events: [] });

    const { data: events, error: eErr } = await supabaseAdmin.from('events').select('*').in('subject_id', visitorIds).order('created_at', { ascending: false }).limit(limit);
    if (eErr) return res.status(500).json({ error: eErr.message });
    return res.json({ events });
  } catch (err) {
    console.error('events error', err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
