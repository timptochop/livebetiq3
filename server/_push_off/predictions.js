// api/predictions.js
// Proxy προς Google Apps Script Web App.
// Απαιτεί env: LOG_WEBHOOK_URL

export default async function handler(req, res) {
  const url = process.env.LOG_WEBHOOK_URL;
  if (!url) {
    return res.status(500).json({ ok: false, error: 'Missing LOG_WEBHOOK_URL' });
  }

  // Health check (π.χ. GET /api/predictions)
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, msg: 'predictions endpoint alive' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const payload = await readJson(req);
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const detail = await safeText(r);
      return res.status(502).json({ ok: false, error: 'Webhook error', status: r.status, detail });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Unknown error' });
  }
}

function readJson(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => {
      try { resolve(JSON.parse(s || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function safeText(r) {
  try { return await r.text(); } catch { return ''; }
}