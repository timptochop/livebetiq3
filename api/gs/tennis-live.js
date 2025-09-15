// api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')   return res.status(405).json({ error: 'Method Not Allowed' });

  // ασφαλής ανάγνωση query (να μη βασιστούμε στο req.query)
  const url = new URL(req.url, 'http://localhost');
  const debug = url.searchParams.get('debug') === '1';

  try {
    const { matches, error, meta } = await fetchLiveTennis({ debug });
    // ΠΟΤΕ 500 στο client – πάντα 200 με διάγνωση.
    return res.status(200).json({ matches, error, meta });
  } catch (err) {
    console.error('[API /api/gs/tennis-live] crash:', err);
    return res.status(200).json({ matches: [], error: err?.message || 'Internal error' });
  }
}