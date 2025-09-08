// /api/_lib/goalServeLiveAPI.js
import axios from 'axios';

const GOALSERVE_KEY = process.env.GOALSERVE_KEY || 'f31155052f6749178f8808dde8bc3095'; // fallback dev key

// ✅ Fixed base URL — must end with /home?json=1 (no placeholder in the path)
const GOALSERVE_URL = `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${GOALSERVE_KEY}`;

export default async function fetchLiveTennis() {
  try {
    const response = await axios.get(GOALSERVE_URL, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = response.data;

    if (!data || !data.scores) {
      console.error('[GS-ERROR] Invalid or empty data structure from GoalServe');
      return { matches: [] };
    }

    const categories = data.scores.category || [];
    const matches = [];

    const categoryList = Array.isArray(categories) ? categories : [categories];

    for (const category of categoryList) {
      const tournament = category?.$?.name || 'Unknown Tournament';
      const matchList = category.match || [];

      const matchesArray = Array.isArray(matchList) ? matchList : [matchList];

      for (const match of matchesArray) {
        const home = match?.player?.[0]?._ || match?.player?.[0];
        const away = match?.player?.[1]?._ || match?.player?.[1];
        const status = match?.status || '';
        const time = match?.time || '';
        const id = match?.id || '';
        const odds = match?.odds || null;

        matches.push({
          id,
          tournament,
          home,
          away,
          status,
          time,
          odds,
          raw: match,
        });
      }
    }

    console.log(`[GS] ✅ Fetched ${matches.length} matches`);
    return { matches };
  } catch (err) {
    console.error('[GS-ERROR] Failed to fetch GoalServe data:', err.message);

    // fallback log of full response if available
    if (err.response) {
      console.error('[GS-ERROR] Response:', err.response.data);
    }

    return { matches: [] };
  }
}