// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

// (προαιρετικά) Αν θες να εξαναγκάσεις Node runtime:
// export const config = { runtime: 'nodejs18.x' };

export default async function handler(req, res) {
  // CORS για preview/prod
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let matches = [];
  let error = null;

  try {
    matches = await fetchLiveTennis(); // επιστρέφει ΠΑΝΤΑ array
  } catch (e) {
    error = e?.message || 'unknown';
    console.error('[API] handler error:', e);
  }

  // ΠΟΤΕ 500 — αν κάτι πάει στραβά, γυρνάμε 200 με [] για να μην σπάει το UI
  return res.status(200).json({ matches: Array.isArray(matches) ? matches : [], error });
}