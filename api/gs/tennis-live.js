// File: api/gs/tennis-live.js

import { fetchLiveTennis } from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  try {
    const matches = await fetchLiveTennis();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] Error in /api/gs/tennis-live:', error);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'Internal Server Error' });
  }
}