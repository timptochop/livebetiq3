// src/utils/fetchTennisLive.js (v0.96.15-debug-log)

const API_URL = 'https://livebetiq3.vercel.app/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // 🔍 Full payload logging (for diagnostics)
    console.log('[fetchTennisLive] 🔍 Full data:', data);

    // ✅ Basic status log
    console.log('[fetchTennisLive] ✅ Matches fetched:', data.matches?.length || 0);
    console.log('[fetchTennisLive] Example match:', data.matches?.[0]);

    // 🧠 Optional filtering: exclude invalid matches (no players)
    const validMatches = Array.isArray(data.matches)
      ? data.matches.filter((m) => m?.home && m?.away)
      : [];

    return validMatches;
  } catch (error) {
    console.error('[fetchTennisLive] ❌ Failed to fetch:', error);
    return []; // fallback to empty list
  }
}