// File: /api/gs/tennis-live.js
import fetchLiveTennis from '../_lib/goalServeLiveAPI';

export default async function handler(req, res) {
  try {
    const { matches } = await fetchLiveTennis();

    console.log('[API] ✅ Returned matches:', matches.length);
    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] ❌ Handler error in /api/gs/tennis-live:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}