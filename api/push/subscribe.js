// api/push/subscribe.js  (CommonJS)
module.exports = async function handler(req, res) {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method !== 'POST') {
      return res
        .status(405)
        .json({ ok: false, error: 'Method not allowed', method: req.method });
    }

    // body (δέχομαι και string και object)
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ ok: false, error: 'Invalid JSON' }); }
    }

    const sub = body && body.subscription;
    if (!sub || !sub.endpoint) {
      return res.status(400).json({ ok: false, error: 'No subscription' });
    }

    // εδώ κανονικά θα γινόταν persist σε DB – για τώρα απλά OK
    return res.status(200).json({ ok: true, saved: true });
  } catch (e) {
    console.error('subscribe crash:', e);
    return res.status(500).json({ ok: false, error: e.message || 'subscribe failed' });
  }
};