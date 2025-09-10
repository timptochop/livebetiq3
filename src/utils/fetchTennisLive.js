// src/utils/fetchTennisLive.js (v0.96.16-cors-safe)

const API_URL = 'https://livebetiq3.vercel.app/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('[fetchTennisLive] ✅ Raw data:', data);

    const matches = Array.isArray(data?.matches) ? data.matches : [];

    console.log('[fetchTennisLive] ✅ Matches fetched:', matches.length);
    console.log('[fetchTennisLive] Example match:', matches[0]);

    const validMatches = matches.filter((m) => m?.home && m?.away);

    return validMatches;
  } catch (error) {
    console.error('[fetchTennisLive] ❌ Failed to fetch:', error);
    return [];
  }
}