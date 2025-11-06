// api/lbq-cc.js — Vercel proxy to GAS WebApp (v5.1-lockdown)

export default async function handler(req, res) {
  // --- CORS (allow browser POST from app) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-lbq-secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const GAS_URL = process.env.LBQ_GAS_URL;
  const LBQ_SECRET = process.env.LBQ_SECRET;

  if (!GAS_URL || !LBQ_SECRET) {
    return res.status(500).json({
      ok: false,
      error: 'Missing LBQ_GAS_URL or LBQ_SECRET in environment',
    });
  }

  try {
    if (req.method === 'GET') {
      // pass-through to doGet (config ping)
      const r = await fetch(`${GAS_URL}?t=${Date.now()}`, { method: 'GET' });
      const data = await r.json();
      return res.status(200).json({ ok: true, via: 'get', data });
    }

    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      // allow overriding via header, else use server secret
      const headerSecret = req.headers['x-lbq-secret'];
      const secret = headerSecret && String(headerSecret).trim().length > 0 ? headerSecret : LBQ_SECRET;

      const r = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, secret }),
      });

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      return res.status(r.ok ? 200 : r.status).json({ ok: r.ok, via: 'post', data });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}