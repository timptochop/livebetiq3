export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = body?.subscription;
    const title = body?.title || 'LiveBet IQ';
    const message = body?.body || 'Hello 👋';
    const url = body?.url || '/';

    if (!sub?.endpoint) {
      return res.status(400).json({ ok: false, error: 'No subscription' });
    }

    // Lazy require για να μην σπάει το bundling
    const webPush = require('web-push');

    const contact = process.env.PUSH_CONTACT || 'mailto:you@example.com';
    const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

    if (!pub || !priv) {
      return res.status(500).json({ ok: false, error: 'Missing VAPID envs' });
    }

    webPush.setVapidDetails(contact, pub, priv);

    const payload = JSON.stringify({ title, body: message, url });
    const result = await webPush.sendNotification(sub, payload);

    return res.status(200).json({ ok: true, id: result && result.headers ? result.headers.get?.('x-vercel-id') : null });
  } catch (e) {
    console.error('notify error:', e);
    // Το web-push πολλές φορές έχει e.body με λεπτομέρειες
    return res.status(500).json({ ok: false, error: e?.body || e?.message || 'notify failed' });
  }
}