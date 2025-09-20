// api/push/send.js
import webpush from 'web-push';

const PUB  = process.env.VAPID_PUBLIC_KEY || process.env.REACT_APP_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJ = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (PUB && PRIV) {
  webpush.setVapidDetails(SUBJ, PUB, PRIV);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }
    if (!PUB || !PRIV) {
      res.status(500).json({ ok: false, error: 'Missing VAPID keys' });
      return;
    }

    // Vercel parses JSON automatically when header is application/json
    const { subscription, title, body, url } = req.body || {};
    if (!subscription) {
      res.status(400).json({ ok: false, error: 'Missing subscription' });
      return;
    }

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: title || 'LiveBet IQ', body: body || 'SAFE detected', url: url || '/' })
    );

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'push_failed' });
  }
}