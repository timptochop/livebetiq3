export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = body?.subscription;
    if (!sub?.endpoint) return res.status(400).json({ ok: false, error: 'No subscription' });

    // TODO: save sub (DB). Για τώρα, OK μόνο.
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('subscribe error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'subscribe failed' });
  }
}