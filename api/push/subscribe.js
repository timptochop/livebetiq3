// api/push/subscribe.js
module.exports = async (req, res) => {
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
    const sub = body && body.subscription;

    if (!sub || !sub.endpoint) {
      return res.status(400).json({ ok: false, error: 'No subscription' });
    }

    // εδώ θα έκανες persist (DB). Για το test, απλώς απαντάμε ok.
    return res.status(200).json({ ok: true, saved: true });
  } catch (e) {
    console.error('subscribe error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'subscribe failed' });
  }
};