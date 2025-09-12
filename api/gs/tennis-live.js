// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

// Force Node runtime (όχι Edge)
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  // CORS (safe για preview/prod)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const matches = await fetchLiveTennis(); // ΠΑΝΤΑ array
    return res.status(200).json({ matches });
  } catch (err) {
    console.error('[API] /api/gs/tennis-live error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}