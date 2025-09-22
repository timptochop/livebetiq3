// api/push/notify.js
import webpush from 'web-push';

const { WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, PUSH_CONTACT } = process.env;

// Αρχικοποίηση VAPID (χρειάζεται Node runtime, όχι Edge)
webpush.setVapidDetails(
  PUSH_CONTACT || 'mailto:example@example.com',
  WEB_PUSH_VAPID_PUBLIC_KEY,
  WEB_PUSH_VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { subscription, title = 'LiveBet IQ', body = 'Test', url = '/' } = raw || {};

    if (!subscription) return res.status(400).json({ error: 'Missing subscription' });

    const payload = JSON.stringify({ title, body, url });
    await webpush.sendNotification(subscription, payload);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify error:', e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}