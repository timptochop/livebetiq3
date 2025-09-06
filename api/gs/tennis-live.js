// File: api/gs/tennis-live.js
const fetchLiveTennisMatches = require('../_lib/goalServeLiveAPI.js');

module.exports = async function handler(req, res) {
  try {
    const response = await fetchLiveTennisMatches();

    if (response.error) {
      return res.status(500).json({ matches: [], error: true, reason: 'fetch failed' });
    }

    res.status(200).json({ matches: response.matches });
  } catch (error) {
    console.error('[API] ❌ Error in tennis-live:', error);
    res.status(500).json({ matches: [], error: true, reason: 'unhandled exception' });
  }
};