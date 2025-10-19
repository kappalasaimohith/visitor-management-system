import axios from 'axios';
import 'dotenv/config';

// Minimal FCM HTTP v1 wrapper using legacy server key if provided.
// For production use, prefer OAuth2 service account tokens.
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || null;

export async function sendFcmToToken(token, title, body, data = {}) {
  if (!FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not set, skipping push');
    return;
  }

  try {
    const res = await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: token,
        notification: { title, body },
        data,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${FCM_SERVER_KEY}`,
        },
      }
    );
    return res.data;
  } catch (err) {
    console.error('FCM send error', err.response?.data || err.message || err);
  }
}

export async function sendFcmToTopic(topic, title, body, data = {}) {
  if (!FCM_SERVER_KEY) return;
  try {
    const res = await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: `/topics/${topic}`,
        notification: { title, body },
        data,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${FCM_SERVER_KEY}`,
        },
      }
    );
    return res.data;
  } catch (err) {
    console.error('FCM send error', err.response?.data || err.message || err);
  }
}

export default { sendFcmToToken, sendFcmToTopic };
