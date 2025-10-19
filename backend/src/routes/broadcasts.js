import express from 'express';
import supabaseAdmin from '../supabaseClient.js';
import notify from '../notify.js';

const router = express.Router();

// GET /api/broadcasts - List broadcasts (all users can see)
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ broadcasts: data });
  } catch (err) {
    console.error('broadcasts list error', err);
    return res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

// POST /api/broadcasts - Create broadcast (admin only)
router.post('/', async (req, res) => {
  const { profile } = req;
  const { title, message, expires_at, is_urgent } = req.body;

  if (!profile) return res.status(403).json({ error: 'Missing profile' });
  
  const isAdmin = (profile.role === 'admin') || (Array.isArray(profile.roles) && profile.roles.includes('admin'));
  if (!isAdmin) return res.status(403).json({ error: 'Only admins can create broadcasts' });

  if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

  try {
    const { data, error } = await supabaseAdmin
      .from('broadcasts')
      .insert([{
        title,
        message,
        created_by: profile.id,
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        is_urgent: is_urgent || false
      }])
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Send push notification to all users
    try {
      const notificationTitle = is_urgent ? `🚨 URGENT: ${title}` : `📢 ${title}`;
      await notify.sendFcmToTopic('all_users', notificationTitle, message, { 
        broadcastId: data.id,
        type: 'broadcast'
      });
    } catch (err) {
      console.error('broadcast notification error', err);
    }

    return res.json({ broadcast: data });
  } catch (err) {
    console.error('broadcast create error', err);
    return res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

export default router;
