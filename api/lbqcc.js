// api/lbqcc.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const GAS_URL = process.env.LBQ_GAS_URL;     // πλήρες .../exec
  const SECRET  = process.env.LBQ_SECRET || '';

  if (!GAS_URL) {
    return res.status(500).json({ ok: false, error: 'LBQ_GAS_URL missing' });
  }

  try {
    if (req.method === 'GET') {
      // health/config echo από GAS (ή απλό ping)
      const r = await fetch(GAS_URL, { method: 'GET' });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(r.ok ? 200 : r.status).json({ ok: true, via: 'get', data });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const payload = { ...body, secret: SECRET };

      const r = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(r.ok ? 200 : r.status).json({ ok: true, via: 'post', data });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}