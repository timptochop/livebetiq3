// File: api/gs/tennis-live.js
import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // ✅ Allow CORS for all origins (safe in read-only endpoints like this)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end(); // Preflight CORS check
    return;
  }

  try {
    const matches = await fetchLiveTennis();
    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] Error in /api/gs/tennis-live:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}