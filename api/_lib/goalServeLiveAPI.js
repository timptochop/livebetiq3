// File: api/_lib/goalServeLiveAPI.js

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

export async function fetchLiveTennis() {
  const url = 'https://www.goalserve.com/getfeed/tennis?json=1&key=f0ad5b615f0b4febb29408dddb0d1d39';

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[GoalServe API] Response Error:', response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log('[GoalServe API] Raw Response:', JSON.stringify(data).slice(0, 500)); // for debug
    const matches = data?.scores?.category?.flatMap(cat =>
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

    console.log('[GoalServe API] Parsed Matches:', matches.length);
    return matches;
  } catch (error) {
    console.error('[GoalServe API] Fetch Error:', error);
    throw error;
  }
}