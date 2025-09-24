// CommonJS + require για web-push (όχι ESM)
const webPush = require('web-push');

module.exports = async (req, res) => {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed', method: req.method });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = body && body.subscription;
    const title = (body && body.title) || 'LiveBet IQ';
    const message = (body && body.body) || 'Hello 👋';
    const url = (body && body.url) || '/';

    if (!sub || !sub.endpoint) {
      return res.status(400).json({ ok: false, error: 'No subscription' });
    }

    const contact = process.env.PUSH_CONTACT || 'mailto:you@example.com';
    const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

    if (!pub || !priv) {
      return res.status(500).json({ ok: false, error: 'Missing VAPID envs' });
    }

    webPush.setVapidDetails(contact, pub, priv);

    const payload = JSON.stringify({ title, body: message, url });
    const result = await webPush.sendNotification(sub, payload);

    return res.status(200).json({ ok: true, status: result && result.statusCode ? result.statusCode : 200 });
  } catch (e) {
    console.error('notify error:', e);
    return res.status(500).json({ ok: false, error: (e && (e.body || e.message)) || 'notify failed' });
  }
};