// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const debug = req.query?.debug === '1';

  try {
    const out = await fetchLiveTennis(debug);
    // Αν ο upstream έδωσε 500, απαντάμε 200 με κενή λίστα + meta, για να μην “σκάει” το UI.
    if (out.error) {
      if (debug) console.error('[API tennis-live] Upstream error:', out.error, out.meta);
      return res.status(200).json({ matches: [], error: out.error, meta: out.meta });
    }
    return res.status(200).json(out);
  } catch (err) {
    console.error('[API] Fatal error /api/gs/tennis-live:', err);
    return res.status(200).json({ matches: [], error: 'Internal error' });
  }
}