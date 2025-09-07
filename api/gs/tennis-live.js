// File: api/gs/tennis-live.js
const { fetchLiveTennis } = require('../_lib/goalServeLiveAPI.js');

module.exports = async (req, res) => {
  try {
    const matches = await fetchLiveTennis();
    res.status(200).json({ matches });
  } catch (error) {
    console.error('[API] ❌ Handler error in /api/gs/tennis-live:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};