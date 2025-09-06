// File: api/_lib/goalServeLiveAPI.js
const https = require('https');
const fetch = require('node-fetch');

const GOALSERVE_API_URL = 'https://www.goalserve.com/getfeed/tennis?json=1';
const API_KEY = 'f0ad5b615f0b4febb29408dddb0d1d39';

async function fetchLiveTennis() {
  const url = `${GOALSERVE_API_URL}&key=${API_KEY}`;
  const agent = new https.Agent({ rejectUnauthorized: false });

  try {
    const response = await fetch(url, { agent });

    if (!response.ok) {
      console.error('[GoalServe] ❌ Response failed with status:', response.status);
      return [];
    }

    const data = await response.json();
    const matches = [];

    const categories = data?.scores?.category ?? [];

    categories.forEach((cat) => {
      const tournaments = cat?.tournament ?? [];
      tournaments.forEach((tour) => {
        const tourMatches = tour?.match ?? [];
        tourMatches.forEach((match) => {
          matches.push({
            id: match?.id,
            player1: match?.player1,
            player2: match?.player2,
            status: match?.status,
            score: match?.score,
            tournament: tour?.name,
            category: cat?.name,
          });
        });
      });
    });

    console.log(`[GoalServe] ✅ Fetched ${matches.length} matches`);
    return matches;
  } catch (err) {
    console.error('[GoalServe] ❌ Error parsing GoalServe response:', err);
    return [];
  }
}

module.exports = { fetchLiveTennis };