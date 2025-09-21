// api/push/notify.js
const webpush = require('web-push');

const PUB = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const PRIV = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const CONTACT = process.env.PUSH_CONTACT || 'mailto:tptochop@gmail.com';

if (!PUB || !PRIV) {
  console.warn('[notify] Missing VAPID keys in env');
}
webpush.setVapidDetails(CONTACT, PUB, PRIV);

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }

    const {
      subscription,
      title = 'LiveBet IQ',
      body: text = 'New update',
      url = '/',
      tag,
      icon,
      data
    } = body || {};

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ ok: false, error: 'Missing push subscription' });
    }

    const payload = JSON.stringify({
      title,
      body: text,
      icon: icon || '/icon-192.PNG',     // στο project σου το αρχείο είναι με .PNG
      badge: '/icon-192.PNG',
      tag,
      data: { url, ...(data || {}) }
    });

    const result = await webpush.sendNotification(subscription, payload, { TTL: 30 });

    return res.status(200).json({ ok: true, status: result?.statusCode ?? 201 });
  } catch (err) {
    console.error('[notify] error', err);
    return res.status(500).json({
      ok: false,
      error: err?.body || err?.message || 'server_error'
    });
  }
};