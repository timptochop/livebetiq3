// api/_lib/goalServeLiveAPI.js
import fetch from 'node-fetch';

const GOALSERVE_KEY = 'f31155052f6749178f8808dde8bc3095'; // 🔑 Trial API key
const BASE_URL = `https://www.goalserve.com/getfeed/${GOALSERVE_KEY}/tennis_scores/home?json=1`;

/**
 * Fetches live tennis matches from GoalServe API in JSON format.
 * Handles parsing and error logging.
 */
export default async function fetchLiveTennisMatches() {
  try {
    const res = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'LiveBetIQ-Tennis/1.0',
        'Accept-Encoding': 'gzip'
      }
    });

    if (!res.ok) {
      console.error(`[GoalServe] ❌ Bad response: ${res.status} ${res.statusText}`);
      return { matches: [], error: true, status: res.status };
    }

    const data = await res.json();

    if (!data || !data.scores || !Array.isArray(data.scores.category)) {
      console.warn('[GoalServe] ⚠️ Unexpected structure in response:', JSON.stringify(data).slice(0, 300));
      return { matches: [], error: true, status: 200 };
    }

    const allMatches = [];

    data.scores.category.forEach((category) => {
      const { name: tournament, match } = category;
      if (!match) return;

      const matchList = Array.isArray(match) ? match : [match];

      matchList.forEach((m) => {
        allMatches.push({
          ...m,
          tournament,
        });
      });
    });

    return { matches: allMatches, error: false };
  } catch (err) {
    console.error('[GoalServe] 🛑 Failed to fetch matches:', err.message);
    return { matches: [], error: true };
  }
}