// api/log-prediction.js

export default async function handler(req, res) {
  try {
    const url = process.env.LOG_WEBHOOK_URL;
    if (!url) {
      return res.status(500).json({
        ok: false,
        error: 'Missing LOG_WEBHOOK_URL env var',
      });
    }

    const method = (req.method || 'POST').toUpperCase();
    let payload;

    if (method === 'POST') {
      // Try to διαβάσουμε JSON σώμα
      if (
        req.headers['content-type'] &&
        req.headers['content-type'].includes('application/json') &&
        typeof req.body === 'object'
      ) {
        payload = { ...req.body };
      } else {
        try {
          payload = JSON.parse(req.body || '{}');
        } catch {
          payload = {};
        }
      }
    } else {
      // Για GET (π.χ. /api/log-prediction?test=1)
      payload = { ...(req.query || {}) };
    }

    // ✅ ΠΑΝΤΑ στέλνουμε το secret προς Apps Script
    const secret = process.env.LBQ_SECRET;
    if (secret && !payload.secret) {
      payload.secret = secret;
    }

    // Λίγα debug fields
    payload._tsServer = Date.now();
    payload._ua = req.headers['user-agent'] || '';
    payload._via = 'vercel-log-prediction';

    const f = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await f.text();
    const status = f.status;

    // Επιστρέφουμε μικρή περίληψη μόνο για debug
    return res.status(200).json({
      ok: true,
      forwardedStatus: status,
      sample: String(text).slice(0, 300),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Unexpected',
    });
  }
}