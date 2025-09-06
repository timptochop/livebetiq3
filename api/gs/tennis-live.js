// File: api/gs/tennis-live.js
import fetchLiveTennisMatches from '../_lib/goalServeLiveAPI.js';

export default async function handler(req, res) {
  try {
    const response = await fetchLiveTennisMatches(); // contains { matches, error }

    if (response.error) {
      return res.status(500).json({ matches: [], error: true, reason: 'fetch error' });
    }

    res.status(200).json({ matches: response.matches });
  } catch (error) {
    console.error('[API] ❌ Error in /api/gs/tennis-live:', error);
    res.status(500).json({ matches: [], error: true, reason: 'exception thrown' });
  }
}