export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = await readJson(req);
    const sub = body?.subscription;

    if (!sub?.endpoint) {
      return res.status(400).json({ ok: false, error: 'No subscription' });
    }

    // εδώ (προαιρετικά) θα έκανες persist σε DB
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'subscribe failed' });
  }
}

async function readJson(req) {
  // Αν το body το έχει ήδη “δώσει” το Vercel
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);

  // Διαφορετικά διάβασέ το από το stream
  let raw = '';
  for await (const chunk of req) raw += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}