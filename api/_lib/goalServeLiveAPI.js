// File: api/_lib/goalServeLiveAPI.js
const fetch = require('node-fetch');

const GOALSERVE_API_URL = 'https://www.goalserve.com/getfeed/tennis?json=1';
const API_KEY = 'f0ad5b615f0b4febb29408dddb0d1d39';

async function fetchLiveTennis() {
  const url = `${GOALSERVE_API_URL}&key=${API_KEY}`;
  console.log(`[GoalServe] Fetching from URL: ${url}`);

  try {
    const response = await fetch(url);

    console.log(`[GoalServe] Response Status: ${response.status}`);

    const contentType = response.headers.get('content-type');
    console.log(`[GoalServe] Content-Type: ${contentType}`);

    if (!response.ok) {
      console.error(`[GoalServe] ❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[GoalServe] ❌ Response Text: ${errorText}`);
      return [];
    }

    const data = await response.json();
    console.log(`[GoalServe] ✅ Response JSON received`);

    const matches = [];

    const categories = data?.scores?.category ?? [];
    console.log(`[GoalServe] Categories found: ${categories.length}`);

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

    console.log(`[GoalServe] ✅ Parsed ${matches.length} matches`);
    return matches;
  } catch (err) {
    console.error('[GoalServe] ❌ Error parsing GoalServe response:', err);
    return [];
  }
}

module.exports = { fetchLiveTennis };