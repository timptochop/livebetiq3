import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const result = await fetchLiveTennis();
    return res.status(200).json(result);
  } catch (e) {
    console.error('[API] /api/gs/tennis-live error:', e);
    return res.status(500).json({ matches: [] });
  }
}