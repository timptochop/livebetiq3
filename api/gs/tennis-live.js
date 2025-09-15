// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Μην cache-άρεις το αποτέλεσμα της function
  res.setHeader('Cache-Control', 'no-store');

  const debug = req.query?.debug ? true : false;

  try {
    const data = await fetchLiveTennis();

    // Αν το upstream έσκασε, στείλε 200 με άδειο matches για να μη “κοκκινίζει” το UI.
    if (data?.error) {
      return res.status(200).json(
        debug ? data : { matches: [] }
      );
    }

    return res.status(200).json(data);
  } catch (err) {
    // Απόλυτο fallback — ποτέ 500 στο UI
    return res.status(200).json({ matches: [], error: 'INTERNAL_HANDLER_ERROR' });
  }
}