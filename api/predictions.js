export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const webhookUrl = process.env.LOG_WEBHOOK_URL;
  const lbqSecret = process.env.LBQ_SECRET;

  if (!webhookUrl) {
    return res.status(500).json({
      ok: false,
      error: 'LOG_WEBHOOK_URL is not configured',
    });
  }

  if (!lbqSecret) {
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

    if (!payload || typeof payload !== 'object') {
      payload = { data: payload };
    }

    payload.secret = lbqSecret;

    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const txt = await upstream.text();
    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      data = { raw: txt };
    }

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: 'webhook_error',
        status: upstream.status,
        data,
      });
    }

    return res.status(200).json({
      ok: true,
      forwarded: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'proxy_failed',
      detail: String(err || 'unknown'),
    });
  }
}