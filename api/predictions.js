// api/predictions.js
// LiveBet IQ - unified prediction logger endpoint (server → GAS)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const url = process.env.LOG_WEBHOOK_URL;
  const secret = process.env.LBQ_SECRET;

  if (!url) {
    return res.status(500).json({
      ok: false,
      error: 'LOG_WEBHOOK_URL is not configured',
    });
  }

  if (!secret) {
    return res.status(500).json({
      ok: false,
      error: 'LBQ_SECRET is not configured',
    });
  }

  try {
    let payload = req.body || {};

    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = { raw: payload };
      }
    }

    const finalBody =
      payload && typeof payload === 'object'
        ? { ...payload, secret }
        : { data: payload, secret };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalBody),
    });

    const text = await resp.text();
    let data;

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