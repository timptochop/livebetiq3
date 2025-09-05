// File: api/gs/tennis-live.js

import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  try {
    const matches = await fetchLiveTennis();
    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] Error in /api/gs/tennis-live:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}