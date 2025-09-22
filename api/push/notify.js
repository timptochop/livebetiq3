// api/push/notify.js  (Vercel Node Function)
const webpush = require('web-push');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const contact = process.env.PUSH_CONTACT;
    const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    if (!contact || !pub || !priv) {
      return res.status(500).json({ ok: false, error: 'Missing VAPID envs' });
    }
    webpush.setVapidDetails(contact, pub, priv);

    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { return res.status(400).json({ ok: false, error: 'Invalid JSON' }); }
    }
    const { subscription, title = 'LiveBet IQ', body: msg = 'Push test ✅', url = '/' } = body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ ok: false, error: 'Missing subscription' });
    }

    const payload = JSON.stringify({ title, body: msg, url });

    try {
      const r = await webpush.sendNotification(subscription, payload);
      return res.status(200).json({ ok: true, statusCode: r.statusCode || 200 });
    } catch (err) {
      // Αν η συνδρομή έληξε/άκυρη
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        return res.status(410).json({ ok: false, error: 'Subscription gone/invalid' });
      }
      console.error('notify error:', err);
      return res.status(500).json({ ok: false, error: err.message || 'Send error' });
    }
  } catch (err) {
    console.error('notify top-level error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};