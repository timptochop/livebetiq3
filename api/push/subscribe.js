module.exports = (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method !== 'POST') {
      // GET test: να μη σκάει 500, να δείχνει ότι ζει
      return res.status(200).json({ ok: true, method: req.method, note: 'use POST to save subscription' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = body?.subscription;
    if (!sub?.endpoint) return res.status(400).json({ ok: false, error: 'No subscription' });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('subscribe error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'subscribe failed' });
  }
};