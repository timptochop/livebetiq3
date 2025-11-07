// api/lbqcc.js
export default async function handler(req, res) {
  const GAS_URL = process.env.LOG_WEBHOOK_URL || '';
  const SECRET = process.env.LBQ_SECRET || '';

  if (!GAS_URL) {
    return res.status(500).json({ ok: false, error: 'missing LOG_WEBHOOK_URL' });
  }

  try {
    if (req.method === 'GET') {
      const mode = String(req.query.mode || 'config');
      const url = `${GAS_URL}${GAS_URL.includes('?') ? '&' : '?'}mode=${encodeURIComponent(
        mode
      )}&ts=${Date.now()}`;

      const r = await fetch(url, { method: 'GET', headers: { 'cache-control': 'no-cache' } });
      if (!r.ok) {
        return res.status(r.status).json({ ok: false, error: `gas http ${r.status}` });
      }
      const data = await r.json();
      return res.status(200).json({ ok: true, via: 'get', data });
    }

    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const url = `${GAS_URL}${GAS_URL.includes('?') ? '&' : '?'}ts=${Date.now()}${
        SECRET ? `&secret=${encodeURIComponent(SECRET)}` : ''
      }`;

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        return res.status(r.status).json({ ok: false, error: `gas http ${r.status}` });
      }
      const data = await r.json();
      return res.status(200).json({ ok: true, via: 'post', data });
    }

    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}