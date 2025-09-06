// File: api/_lib/goalServeLiveAPI.js

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

export async function fetchLiveTennis() {
  const API_KEY = 'f0ad5b615f0b4febb29408dddb0d1d39';
  const url = `https://www.goalserve.com/getfeed/tennis?json=1&key=${API_KEY}`;

  console.log('[fetchLiveTennis] Fetching from:', url);

  try {
    const response = await fetch(url);
    console.log('[fetchLiveTennis] HTTP Status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('[fetchLiveTennis] Response not OK:', text);
      throw new Error(`GoalServe error: ${response.status} - ${text}`);
    }

    const raw = await response.json();

    console.log('[fetchLiveTennis] Raw JSON preview:', JSON.stringify(raw).slice(0, 500));

    const matches = raw?.scores?.category?.flatMap(cat =>
      cat?.matches?.map(match => ({
        id: match.id,
        player1: match.player1,
        player2: match.player2,
        status: match.status,
        score: match.ss,
        tournament: cat.name,
        tournamentId: cat.id,
      })) || []
    ) || [];

    console.log(`[fetchLiveTennis] Parsed matches: ${matches.length}`);
    return matches;
  } catch (err) {
    console.error('[fetchLiveTennis] Fetch error:', err);
    throw err;
  }
}