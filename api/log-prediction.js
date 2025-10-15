// api/log-prediction.js
export default async function handler(req, res) {
  try {
    const url = process.env.LOG_WEBHOOK_URL;
    if (!url) return res.status(500).json({ ok:false, error: 'Missing LOG_WEBHOOK_URL' });

    const method = req.method || 'POST';
    let payload = {};
    if (method === 'POST') {
      try { payload = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}'); }
      catch { payload = {}; }
    } else {
      payload = Object.fromEntries(Object.entries(req.query || {}));
    }

    // enrich a bit
    payload._tsServer = Date.now();
    payload._ua = req.headers['user-agent'] || '';

    const f = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await f.text(); // δεν μας νοιάζει το σχήμα, απλά forward
    return res.status(200).json({ ok:true, data: String(data).slice(0,200) });
  } catch (err) {
    return res.status(500).json({ ok:false, error: err?.message || 'Unexpected' });
  }
}