// File: api/_lib/goalServeLiveAPI.js
const https = require('https');
const fetch = require('node-fetch');

const GOALSERVE_API_URL = 'https://www.goalserve.com/getfeed/tennis?json=1';
const API_KEY = 'f0ad5b615f0b4febb29408dddb0d1d39'; // αντικατάστησέ το αν αλλάξει

module.exports = async function fetchLiveTennisMatches() {
  const url = `${GOALSERVE_API_URL}&key=${API_KEY}`;

  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await fetch(url, { agent });

    if (!response.ok) {
      console.error('[GoalServe] ❌ Bad response status:', response.status);
      return { matches: [], error: true };
    }

    const data = await response.json();
    const matches = data?.scores?.category?.flatMap(cat =>
      cat.tournament?.flatMap(tour =>
        tour.match?.map(match => ({
          id: match?.id,
          player1: match?.player1,
          player2: match?.player2,
          status: match?.status,
          score: match?.score,
          tournament: tour?.name,
          category: cat?.name,
        })) || []
      ) || []
    ) || [];

    console.log(`[GoalServe] ✅ ${matches.length} matches fetched`);
    return { matches, error: false };
  } catch (err) {
    console.error('[GoalServe] ❌ Exception during fetch:', err);
    return { matches: [], error: true };
  }
};