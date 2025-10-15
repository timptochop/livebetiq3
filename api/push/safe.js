// /api/push/safe.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const title = body?.title || 'SAFE match';
    const text  = body?.text  || 'Βρέθηκε SAFE';
    const url   = body?.url   || '/';

    const appId = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!appId || !apiKey) {
      return res.status(500).json({ ok:false, error:'Missing OneSignal envs' });
    }

    const r = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ['Subscribed Users'],
        headings: { en: title, el: title },
        contents: { en: text, el: text },
        url,
        ttl: 180, // 3 λεπτά - αν είναι live
        priority: 10,
        android_channel_id: undefined // optional
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok:false, error:data?.errors || data });

    return res.status(200).json({ ok:true, id:data?.id });
  } catch (e) {
    console.error('[OneSignal] push error:', e);
    return res.status(500).json({ ok:false, error:e?.message || 'push failed' });
  }
}