export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    let body; try { body = JSON.parse(raw); } catch { return res.status(400).json({ ok:false, error:'Invalid JSON' }); }

    const sub = body?.subscription;
    const title = body?.title || 'LiveBet IQ';
    const message = body?.body || 'Hello 👋';
    const url = body?.url || '/';
    if (!sub?.endpoint) return res.status(400).json({ ok:false, error:'No subscription' });

    const { default: webPush } = await import('web-push');
    const contact = process.env.PUSH_CONTACT || 'mailto:you@example.com';
    const pub = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    if (!pub || !priv) return res.status(500).json({ ok:false, error:'Missing VAPID envs' });

    webPush.setVapidDetails(contact, pub, priv);
    const payload = JSON.stringify({ title, body: message, url });

    let result;
    try { result = await webPush.sendNotification(sub, payload); }
    catch (e) {
      if (e?.statusCode === 410 || e?.statusCode === 404) return res.status(410).json({ ok:false, error:'Subscription gone' });
      throw e;
    }
    return res.status(200).json({ ok:true, status: result?.statusCode || 200 });
  } catch (e) {
    console.error('notify error:', e);
    return res.status(500).json({ ok:false, error: e?.body || e?.message || 'notify failed' });
  }
}