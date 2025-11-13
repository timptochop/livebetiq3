// api/predictions.js
// LiveBet IQ - unified prediction logger endpoint
// Receives POSTs from the frontend (predictionLogger.js)
// and forwards them to the Google Apps Script webhook (LOG_WEBHOOK_URL)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const url = process.env.LOG_WEBHOOK_URL;
  if (!url) {
    return res
      .status(500)
      .json({ ok: false, error: 'LOG_WEBHOOK_URL is not configured' });
  }

  try {
    const payload = req.body || {};

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Προσπαθούμε να διαβάσουμε JSON, αλλά αν είναι απλό text δεν σπάμε
    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = { raw: await resp.text() };
    }

    if (!resp.ok) {
      return res
        .status(502)
        .json({ ok: false, error: 'Webhook error', status: resp.status, data });
    }

    return res.status(200).json({ ok: true, forwarded: true, data });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: String(e || 'unknown error') });
  }
}