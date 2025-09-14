// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // CORS (ώστε να είμαστε ήσυχοι σε οποιοδήποτε origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { matches } = await fetchLiveTennis();
    res.status(200).json({ ok: true, matches });
  } catch (err) {
    console.error('[API /api/gs/tennis-live] ERROR:', err?.stack || err?.message || err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}