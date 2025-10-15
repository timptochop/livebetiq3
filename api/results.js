// api/results.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  const webhook = process.env.LOG_WEBHOOK_URL; // ίδιο που βάλαμε για το Sheet
  if (!webhook) return res.status(500).json({ ok: false, error: 'Missing LOG_WEBHOOK_URL' });

  const payload = {
    ts: new Date().toISOString(),
    event: 'result',
    data: req.body || {},
  };

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    // Προσπάθησε να γυρίσεις JSON του Apps Script (ή σκέτο ok)
    try { return res.status(200).json(JSON.parse(text)); }
    catch { return res.status(200).json({ ok: true, raw: text }); }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}