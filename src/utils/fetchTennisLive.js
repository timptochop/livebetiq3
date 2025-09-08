// src/utils/fetchTennisLive.js
const API_URL = 'https://livebetiq3.vercel.app/api/gs/tennis-live'; // production-only

export default async function fetchTennisLive() {
  try {
    const response = await fetch(API_URL, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      console.error(`[fetchTennisLive] ❌ HTTP Error ${response.status}`);
      return { matches: [] };
    }

    const json = await response.json();

    if (!json || !Array.isArray(json.matches)) {
      console.error('[fetchTennisLive] ❌ API Error: Invalid JSON structure');
      return { matches: [] };
    }

    console.log(`[fetchTennisLive] ✅ Loaded ${json.matches.length} matches`);
    return json;
  } catch (err) {
    console.error('[fetchTennisLive] ❌ Network/API Error:', err.message);
    return { matches: [] };
  }
}