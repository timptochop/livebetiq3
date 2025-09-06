// File: api/_lib/goalServeLiveAPI.js v0.96.14-debug
import axios from 'axios';

export async function fetchLiveTennis() {
  const API_URL = 'https://www.goalserve.com/getfeed/f31155052f6749178f8808dde8bc3095/tennis_scores/home?json=1';

  try {
    const response = await axios.get(API_URL);
    const data = response.data;

    console.log('🧪 [DEBUG] Raw GoalServe response type:', typeof data);
    console.log('🧪 [DEBUG] Raw GoalServe keys:', Object.keys(data || {}));
    console.log('🧪 [DEBUG] Full Response Preview (first 500 chars):\n', JSON.stringify(data).slice(0, 500));

    let matches = [];

    if (Array.isArray(data?.scores)) {
      matches = data.scores;
      console.log('✅ [PARSING] data.scores is an array');
    } else if (Array.isArray(data?.scores?.match)) {
      matches = data.scores.match;
      console.log(`✅ [PARSING] data.scores.match is array (${matches.length} matches)`);
    } else if (data?.scores?.match) {
      matches = [data.scores.match];
      console.log('⚠️ [PARSING] Single match object found. Wrapped in array.');
    } else {
      console.warn('❌ [WARNING] Unexpected GoalServe format:', JSON.stringify(data).slice(0, 500));
    }

    console.table(
      (matches || []).map((m, i) => ({
        index: i,
        id: m.id || m['@id'],
        status: m.status || m['@status'],
        players: Array.isArray(m.player) ? m.player.map(p => p.name || p['@name']).join(' vs ') : '',
      }))
    );

    return matches;
  } catch (error) {
    console.error('[FETCH ERROR] GoalServe tennis failed:', error.message);
    return [];
  }
}