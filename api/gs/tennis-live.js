// /api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // CORS (αν χρειαστεί από άλλο origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const debug = (req.query?.debug === '1');

  try {
    const { matches, meta } = await fetchLiveTennis();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(debug ? { matches, meta } : { matches });
  } catch (e) {
    const payload = {
      matches: [],
      error: e?.message || 'internal_error',
    };
    if (debug) {
      payload.meta = {
        urlTried: e?.urlTried || e?.meta?.urlTried || [],
        cause: e?.cause?.message || null,
        causePayload: e?.cause?.payload || undefined,
      };
    }
    return res.status(200).json(payload);
  }
}