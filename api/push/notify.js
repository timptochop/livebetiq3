// api/push/notify.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const sub = body.subscription;
    if (!sub?.endpoint) return res.status(400).json({ ok: false, error: 'No subscription' });

    const title = body.title || 'LiveBet IQ';
    const text  = body.text  || body.body || 'Update'; // <— δέχεται ΚΑΙ text ΚΑΙ body
    const url   = body.url   || '/';
    const tag   = body.tag   || 'lbq';
    const icon  = body.icon  || '/logo192.png';
    const badge = body.badge || '/logo192.png';

    const { default: webPush } = await import('web-push');
    const contact = process.env.PUSH_CONTACT || 'mailto:you@example.com';
    const pub  = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      return res.status(500).json({ ok: false, error: 'Missing VAPID envs' });
    }

    webPush.setVapidDetails(contact, pub, priv);

    // Στέλνουμε και text ΚΑΙ body για συμβατότητα με το sw.js σου
    const payload = JSON.stringify({ title, text, body: text, url, tag, icon, badge });
    const result = await webPush.sendNotification(sub, payload);

    return res.status(200).json({ ok: true, status: result?.statusCode || 200 });
  } catch (e) {
    console.error('notify error:', e);
    return res.status(500).json({ ok: false, error: e?.body || e?.message || 'notify failed' });
  }
}