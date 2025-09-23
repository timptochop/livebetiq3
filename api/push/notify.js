export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = await readJson(req);
    const sub = body?.subscription;
    const title = body?.title || 'LiveBet IQ';
    const message = body?.body || 'Hello 👋';
    const url = body?.url || '/';

    if (!sub?.endpoint) return res.status(400).json({ ok: false, error: 'No subscription' });

    // ESM import για Node 22 serverless
    const { default: webPush } = await import('web-push');

    const contact = process.env.PUSH_CONTACT || 'mailto:you@example.com';
    const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    if (!pub || !priv) return res.status(500).json({ ok: false, error: 'Missing VAPID envs' });

    webPush.setVapidDetails(contact, pub, priv);

    const payload = JSON.stringify({ title, body: message, url });
    const result = await webPush.sendNotification(sub, payload);

    return res.status(200).json({ ok: true, status: result?.statusCode || 200 });
  } catch (e) {
    console.error('notify error:', e);
    return res.status(500).json({ ok: false, error: e?.body || e?.message || 'notify failed' });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) raw += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}