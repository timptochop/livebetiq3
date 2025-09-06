// File: api/gs/tennis-live.js
const { fetchLiveTennis } = require('../_lib/goalServeLiveAPI.js');

module.exports = async (req, res) => {
  try {
    const matches = await fetchLiveTennis();

    if (!Array.isArray(matches) || matches.length === 0) {
      console.warn('[API] ⚠ No matches returned from fetchLiveTennis');
    }

    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] ❌ Handler error in /api/gs/tennis-live:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};