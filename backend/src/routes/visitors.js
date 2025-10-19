import express from 'express';
const router = express.Router();
import supabaseAdmin from '../supabaseClient.js';
import notify from '../notify.js';

// GET /api/visitors - List visitors with RBAC
router.get('/', async (req, res) => {
  const { profile } = req;
  const limit = parseInt(req.query.limit || '100', 10);

  try {
    if (!profile) return res.status(403).json({ error: 'Missing profile' });

    const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
    const isGuard = (profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard'));

    if (isAdmin) {
      // Admin can see all visitors
      const { data, error } = await supabaseAdmin
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ visitors: data });
    }

    if (isGuard) {
      // Guards see approved and checked-in visitors
      const { data, error } = await supabaseAdmin
        .from('visitors')
        .select('*')
        .in('status', ['approved', 'checked_in'])
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ visitors: data });
    }

    // Residents see only their household's visitors
    const householdId = profile.household_id;
    if (!householdId) return res.status(403).json({ error: 'Resident missing household' });

    const { data, error } = await supabaseAdmin
      .from('visitors')
      .select('*')
      .eq('host_household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ visitors: data });

  } catch (err) {
    console.error('visitors list error', err);
    return res.status(500).json({ error: 'Failed to fetch visitors' });
  }
});

// Helper: Append audit event
async function appendEvent(type, actorUserId, subjectId, payload) {
  await supabaseAdmin
    .from('events')
    .insert([
      {
        type,
        actor_user_id: actorUserId,
        subject_id: subjectId,
        payload,
        created_at: new Date().toISOString(),
      },
    ]);
}

// 🏠 Resident creates visitor
router.post('/create', async (req, res) => {
  console.log('[POST] /api/visitors/create', { user: req.profile?.id, body: req.body });
  const { profile } = req;
  const { name, phone, purpose, scheduled_from, scheduled_to } = req.body;

  if (!profile || !profile.household_id)
    return res.status(403).json({ error: 'Missing household' });

  // Only residents or admins can create visitors
  const role = profile.role || (Array.isArray(profile.roles) ? profile.roles[0] : null);
  if (!role || (role !== 'resident' && role !== 'admin')) {
    return res.status(403).json({ error: 'Only residents/admins can create visitors' });
  }

  const { data, error } = await supabaseAdmin
    .from('visitors')
    .insert([
      {
        name,
        phone,
        purpose,
        host_household_id: profile.household_id,
        status: 'pending',
        created_at: new Date().toISOString(),
        // schema has no scheduled_from/scheduled_to in your DB snapshot
      },
    ])
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  await appendEvent('create', profile.id, data.id, { visitor: data });
  // Notify household topic and guards
  try {
    const title = 'New visitor pending approval';
    const body = `${data.name} is pending for ${profile.household_id}`;
    await notify.sendFcmToTopic(`household_${profile.household_id}`, title, body, { visitorId: data.id, status: 'pending' });
    await notify.sendFcmToTopic('guards', title, body, { visitorId: data.id, status: 'pending' });
  } catch (err) {
    console.error('notify error', err);
  }
  res.json({ visitor: data });
});

// ✅ Approve visitor (resident or admin)
router.post('/approve', async (req, res) => {
  console.log('[POST] /api/visitors/approve', { user: req.profile?.id, body: req.body });
  const { visitorId } = req.body;
  const { profile } = req;

  const { data: v, error: vErr } = await supabaseAdmin
    .from('visitors')
    .select('*')
    .eq('id', visitorId)
    .maybeSingle();

  if (vErr || !v) return res.status(404).json({ error: 'Visitor not found' });

  const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
  const isGuard = (profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard'));
  const isHostResident = profile.household_id === v.host_household_id;

  // Allow admin, host resident, or guards to approve
  if (!isAdmin && !isHostResident && !isGuard)
    return res.status(403).json({ error: 'Not allowed to approve' });

  if (v.status !== 'pending')
    return res.status(400).json({ error: 'Invalid state — must be pending' });

  const { data, error } = await supabaseAdmin
    .from('visitors')
    .update({
      status: 'approved',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', visitorId)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  await appendEvent('approval', profile.id, visitorId, {
    prevStatus: v.status,
    newStatus: 'approved',
  });

  // Notify household and guards
  try {
    const title = 'Visitor approved';
    const body = `${data.name || 'Visitor'} was approved`;
    await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId });
    await notify.sendFcmToTopic('guards', title, body, { visitorId });
  } catch (err) { console.error('notify error', err); }

  res.json({ visitor: data });
});

// ❌ Deny visitor (resident or admin)
router.post('/deny', async (req, res) => {
  console.log('[POST] /api/visitors/deny', { user: req.profile?.id, body: req.body });
  const { visitorId, reason } = req.body;
  const { profile } = req;

  const { data: v } = await supabaseAdmin
    .from('visitors')
    .select('*')
    .eq('id', visitorId)
    .maybeSingle();

  if (!v) return res.status(404).json({ error: 'Visitor not found' });

  const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
  const isGuard = (profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard'));
  const isHostResident = profile.household_id === v.host_household_id;

  // Allow admin, host resident, or guards to deny
  if (!isAdmin && !isHostResident && !isGuard)
    return res.status(403).json({ error: 'Not allowed to deny' });

  if (v.status !== 'pending')
    return res.status(400).json({ error: 'Invalid state — must be pending' });

  const { data, error } = await supabaseAdmin
    .from('visitors')
    .update({ status: 'denied' })
    .eq('id', visitorId)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  await appendEvent('deny', profile.id, visitorId, { reason });
  try {
    const title = 'Visitor denied';
    const body = `${v.name || 'Visitor'} was denied`;
    await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId });
    await notify.sendFcmToTopic('guards', title, body, { visitorId });
  } catch (err) { console.error('notify error', err); }
  res.json({ visitor: data });
});

// 🚪 Guard check-in
router.post('/checkin', async (req, res) => {
  console.log('[POST] /api/visitors/checkin', { user: req.profile?.id, body: req.body });
  const { visitorId } = req.body;
  const { profile } = req;

  if (!((profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard'))))
    return res.status(403).json({ error: 'Only guards can check-in visitors' });

  const { data: v } = await supabaseAdmin
    .from('visitors')
    .select('*')
    .eq('id', visitorId)
    .maybeSingle();

  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  if (v.status !== 'approved')
    return res.status(400).json({ error: 'Can only check-in approved visitors' });

  const { data, error } = await supabaseAdmin
    .from('visitors')
    .update({ status: 'checked_in' })
    .eq('id', visitorId)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  await appendEvent('checkin', profile.id, visitorId, {});
  try {
    const title = 'Visitor checked in';
    const body = `${data.name || 'Visitor'} has checked in`;
    await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId });
    await notify.sendFcmToTopic('guards', title, body, { visitorId });
  } catch (err) { console.error('notify error', err); }
  res.json({ visitor: data });
});

// 🚗 Guard check-out
router.post('/checkout', async (req, res) => {
  console.log('[POST] /api/visitors/checkout', { user: req.profile?.id, body: req.body });
  const { visitorId } = req.body;
  const { profile } = req;

  if (!((profile.role === 'guard') || (Array.isArray(profile.roles) && profile.roles.includes('guard'))))
    return res.status(403).json({ error: 'Only guards can check-out visitors' });

  const { data: v } = await supabaseAdmin
    .from('visitors')
    .select('*')
    .eq('id', visitorId)
    .maybeSingle();

  if (!v) return res.status(404).json({ error: 'Visitor not found' });
  if (v.status !== 'checked_in')
    return res.status(400).json({ error: 'Can only check-out checked-in visitors' });

  const { data, error } = await supabaseAdmin
    .from('visitors')
    .update({ status: 'checked_out' })
    .eq('id', visitorId)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  await appendEvent('checkout', profile.id, visitorId, {});
  try {
    const title = 'Visitor checked out';
    const body = `${data.name || 'Visitor'} has checked out`;
    await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId });
    await notify.sendFcmToTopic('guards', title, body, { visitorId });
  } catch (err) { console.error('notify error', err); }
  res.json({ visitor: data });
});

// 🗑️ Delete visitor (resident can delete pending/denied in own household; admin can delete any non-active)
router.post('/delete', async (req, res) => {
  console.log('[POST] /api/visitors/delete', { user: req.profile?.id, body: req.body });
  const { visitorId } = req.body;
  const { profile } = req;

  if (!visitorId) return res.status(400).json({ error: 'visitorId required' });

  const { data: v, error: vErr } = await supabaseAdmin
    .from('visitors')
    .select('*')
    .eq('id', visitorId)
    .maybeSingle();

  if (vErr || !v) return res.status(404).json({ error: 'Visitor not found' });

  const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
  const isHostResident = profile.household_id === v.host_household_id;

  // Only allow delete for safe states
  const deletableStatuses = ['pending', 'denied'];
  if (isAdmin) {
    // admin cannot delete active/approved in-progress records to avoid audit gaps
    if (!deletableStatuses.includes(v.status)) {
      return res.status(400).json({ error: 'Only pending or denied visitors can be deleted' });
    }
  } else if (isHostResident) {
    if (!deletableStatuses.includes(v.status)) {
      return res.status(403).json({ error: 'Residents may delete only pending or denied visitors' });
    }
  } else {
    return res.status(403).json({ error: 'Not allowed to delete this visitor' });
  }

  const { error: delErr } = await supabaseAdmin
    .from('visitors')
    .delete()
    .eq('id', visitorId);

  if (delErr) return res.status(500).json({ error: delErr.message });

  await appendEvent('delete', profile.id, visitorId, { prevStatus: v.status });
  try {
    const title = 'Visitor deleted';
    const body = `${v.name || 'Visitor'} was deleted`;
    await notify.sendFcmToTopic(`household_${v.host_household_id}`, title, body, { visitorId });
  } catch (err) { console.error('notify error', err); }

  res.json({ ok: true });
});

export default router;
