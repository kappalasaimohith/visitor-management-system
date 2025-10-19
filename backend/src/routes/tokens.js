import express from 'express';
import notify from '../notify.js';
const router = express.Router();

// POST /api/tokens/register { fcmToken, topics[] }
router.post('/register', async (req, res) => {
  console.log('[POST] /api/tokens/register', { body: req.body });
  const { fcmToken, topics } = req.body;
  if (!fcmToken) return res.status(400).json({ error: 'Missing fcmToken' });
  // Subscribe token to topics
  try {
    for (const topic of topics || []) {
      await notify.sendFcmToTopic(topic, 'Subscribed', 'You are now subscribed', { fcmToken });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

export default router;
