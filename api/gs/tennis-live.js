// File: api/gs/tennis-live.js

import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  // ✅ Enable CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const matches = await fetchLiveTennis();
    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] Error in /api/gs/tennis-live:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}