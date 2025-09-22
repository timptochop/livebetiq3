// api/push/subscribe.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = raw?.subscription;
    if (!sub) return res.status(400).json({ error: 'Missing subscription' });

    // Εδώ απλώς επιβεβαιώνουμε ότι το πήραμε (δεν αποθηκεύουμε DB προς το παρόν)
    return res.status(200).json({ ok: true, received: sub.endpoint ? 'ok' : 'no-endpoint' });
  } catch (e) {
    console.error('subscribe error:', e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}