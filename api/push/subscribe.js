// api/push/subscribe.js
const webpush = require('web-push');

const PUB = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const PRIV = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const CONTACT = process.env.PUSH_CONTACT || 'mailto:tptochop@gmail.com';

if (!PUB || !PRIV) {
  console.warn('[subscribe] Missing VAPID keys in env');
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
    const sub = body && body.subscription;

    if (!sub || !sub.endpoint) {
      return res.status(400).json({ ok: false, error: 'Missing push subscription' });
    }

    // Δεν αποθηκεύουμε server-side (serverless). Ο client θα ξαναστέλνει το sub όπου χρειάζεται.
    return res.status(200).json({
      ok: true,
      received: true,
      endpointTail: sub.endpoint.slice(-16)
    });
  } catch (err) {
    console.error('[subscribe] error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'server_error' });
  }
};