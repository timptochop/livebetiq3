// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { matches, error } = await fetchLiveTennis();
    if (error) {
      // 200 με άδειο payload αλλά ορατό diagnostic
      return res.status(200).json({ matches: [], error });
    }
    return res.status(200).json({ matches });
  } catch (err) {
    console.error('[API /api/gs/tennis-live] crash:', err);
    return res.status(200).json({ matches: [], error: err?.message || 'Internal error' });
  }
}