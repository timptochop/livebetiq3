// api/predictions.js
// LiveBet IQ - unified prediction logger endpoint
// Receives POSTs from the frontend (predictionLogger.js)
// and forwards them to the Google Apps Script webhook (LOG_WEBHOOK_URL)

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ ok: false, error: 'method_not_allowed' });
  }

  const url = process.env.LOG_WEBHOOK_URL;

  if (!url) {
    return res.status(500).json({
      ok: false,
      error: 'LOG_WEBHOOK_URL is not configured',
    });
  }

  try {
    // In some environments req.body may already be an object or a raw string
    let payload = req.body || {};

    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        // If parsing fails, keep the raw string; Apps Script will see it as text
      }
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data;

    // Try to decode JSON from Apps Script; fall back to raw text
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      return res.status(502).json({
        ok: false,
        error: 'webhook_error',
        status: resp.status,
        data,
      });
    }

    return res.status(200).json({
      ok: true,
      forwarded: true,
      data,
    });
  } catch (e) {
    console.error('[api/predictions] proxy error:', e);
    return res.status(500).json({
      ok: false,
      error: 'proxy_failed',
      detail: String(e || 'unknown error'),
    });
  }
}